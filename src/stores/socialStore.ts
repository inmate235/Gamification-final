/**
 * socialStore - phantom users, leaderboard, proximity alerts.
 *
 * Holds: phantoms, leaderboard, proximityAlerts, activeMetric.
 * Actions: movePhantoms, updateLeaderboard, triggerProximityAlert,
 *          generatePhantomActivity, dismissProximityAlert, setActiveMetric,
 *          addPhantom, adjustPhantom, reset.
 *
 * The leaderboard supports three metrics (tokens, time-in-mall, exploration %)
 * and is sortable between them (VAL-LEADER-019). The active metric drives
 * ranking. Phantoms are always kept just barely ahead of the real player on
 * the active metric by the phantomEngine (goalpost shifting). When the player
 * overtakes a phantom, a new one is fabricated just ahead so the player can
 * never permanently reach #1 (VAL-LEADER-014, VAL-LEADER-017).
 */

import { create } from "zustand";
import type {
  LeaderboardEntry,
  LeaderboardMetric,
  PhantomUser,
  ProximityAlert,
  SocialState,
} from "@/types";
import {
  phantoms as initialPhantoms,
  initialLeaderboard,
  wanderWithinZone,
  moveTowardTarget,
  moveTowardZone,
  pickStoreInZone,
  pickAdjacentZone,
  isNearTarget,
  storeInStoreAction,
  approachingAction,
  leavingAction,
  transitioningAction,
  idleWanderAction,
  noticeAction,
  getCorridorWaypoint,
} from "@/data/phantomData";
import { getStoreById, getZoneById, stores as allStores } from "@/data/mallData";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useEconomyStore } from "@/stores/economyStore";

/* ============================================================================
   Helpers
   ========================================================================== */

/** Simple deterministic string hash for deriving per-phantom behavioral variance. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/* ============================================================================
   Per-phantom behavior state machine
   (module-level — not stored on PhantomUser to keep the type shape intact)
   ========================================================================== */

type PhantomPhase =
  | "wandering"
  | "approaching-store"
  | "in-store"
  | "leaving"
  | "transitioning";

interface PhantomBehaviorState {
  phase: PhantomPhase;
  targetStoreId: string | null;
  targetZoneId: string | null;
  ticksInPhase: number;
  dwellTicks: number;
  /** Corridor waypoint passed — phantom can now head straight to zone center. */
  waypointReached: boolean;
  /** Stable in-store anchor set on arrival; avoids per-tick jitter. */
  anchorX: number | null;
  anchorY: number | null;
}

const phantomStates = new Map<string, PhantomBehaviorState>();

/** Track the player's previous zone to detect zone-entry events. */
let previousPlayerZone: string | null = null;

/** Create an initial FSM state for a newly observed phantom. */
function initFSMState(): PhantomBehaviorState {
  return {
    phase: "wandering",
    targetStoreId: null,
    targetZoneId: null,
    ticksInPhase: 0,
    dwellTicks: 0,
    waypointReached: false,
    anchorX: null,
    anchorY: null,
  };
}

/** Reset all FSM state (called from the store reset). */
function resetPhantomStates(): void {
  phantomStates.clear();
  previousPlayerZone = null;
}

/** Euclidean distance between two points. */
function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Identify the goalpost-pinned phantom — the closest phantom above the
 * player's token count within gap <= 3. Token bumps are skipped for this
 * phantom so the goalpost-shifting invariant (VAL-LEADER-010) is never
 * broken by in-store score bumps.
 */
function pinnedAbovePhantomId(playerTokens: number): string | null {
  const phantomsList = useSocialStore.getState().phantoms;
  const above = phantomsList
    .filter((p) => p.tokenCount > playerTokens)
    .sort((a, b) => a.tokenCount - b.tokenCount);
  const closest = above[0];
  if (!closest) return null;
  if (closest.tokenCount - playerTokens <= 3) return closest.id;
  return null;
}

/** Find active flash sales for a given store. */
function flashSalesForStore(storeId: string): Array<{ id: string }> {
  return useEconomyStore
    .getState()
    .flashSales.filter((s) => s.storeId === storeId && !s.claimed);
}

/* ============================================================================
   Helpers
   ========================================================================== */

/** Read a leaderboard entry's value for the active sort metric. */
function entryMetricValue(
  entry: LeaderboardEntry,
  metric: LeaderboardMetric,
): number {
  switch (metric) {
    case "tokens":
      return entry.tokenCount;
    case "time":
      return entry.timeInMall;
    case "exploration":
      return entry.explorationPercent;
  }
}

/* ============================================================================
   Store
   ========================================================================== */

let alertCounter = 0;
function nextAlertId(): string {
  alertCounter += 1;
  return `proximity-alert-${alertCounter}`;
}

/**
 * Build a `LeaderboardEntry` for the real player using their LIVE store
 * values. Used both at store-initialization time (so the player row is
 * present in the leaderboard from the very first render, before the first
 * `updateLeaderboard()` call) and inside `updateLeaderboard()`.
 */
function buildPlayerEntry(): LeaderboardEntry {
  return {
    rank: 0,
    name: "You",
    avatarSeed: "player-avatar",
    tier: usePlayerStore.getState().tier,
    tokenCount: usePlayerStore.getState().tokens,
    isPlayer: true,
    timeInMall: useSessionStore.getState().sessionMinutes,
    explorationPercent: useMapStore.getState().explorationPercent,
  };
}

/**
 * Compose the initial leaderboard: the static phantom entries plus the real
 * player row, sorted by the active metric and assigned contiguous 1-indexed
 * ranks. This guarantees the player is visible on the leaderboard from the
 * start (VAL-LEADER-004) without waiting for the first scheduler-driven
 * `updateLeaderboard()`.
 */
function buildInitialLeaderboardWithPlayer(): LeaderboardEntry[] {
  const metric: LeaderboardMetric = "tokens";
  const playerEntry = buildPlayerEntry();
  const phantomEntries: LeaderboardEntry[] = initialLeaderboard.map((e) => ({
    ...e,
    rank: 0,
  }));
  const combined = [playerEntry, ...phantomEntries].sort(
    (a, b) => entryMetricValue(b, metric) - entryMetricValue(a, metric),
  );
  combined.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });
  return combined;
}

export interface SocialStore extends SocialState {
  movePhantoms: () => void;
  updateLeaderboard: () => void;
  /**
   * Fire a proximity alert naming the phantom, the exact gap, the rank at
   * stake, and the metric (VAL-LEADER-011..013). `metricLabel` is the
   * pre-formatted gap string (e.g. "2 tokens", "1 min", "3%").
   */
  triggerProximityAlert: (
    targetName: string,
    tokenGap: number,
    rank: number,
    metric: LeaderboardMetric,
    metricLabel: string,
  ) => ProximityAlert;
  generatePhantomActivity: () => void;
  dismissProximityAlert: (alertId: string) => void;
  /** Switch the active sort metric (VAL-LEADER-019). */
  setActiveMetric: (metric: LeaderboardMetric) => void;
  /** Add a fabricated phantom (used by phantomEngine on overtake). */
  addPhantom: (phantom: PhantomUser) => void;
  /**
   * Apply a transform to a single phantom by id (goalpost shifting + score
   * evolution). No-op if the phantom is not found.
   */
  adjustPhantom: (
    phantomId: string,
    fn: (p: PhantomUser) => PhantomUser,
  ) => void;
  reset: () => void;
}

export const useSocialStore = create<SocialStore>((set, get) => ({
  phantoms: initialPhantoms.map((p) => ({ ...p })),
  leaderboard: buildInitialLeaderboardWithPlayer(),
  proximityAlerts: [],
  activeMetric: "tokens",

  movePhantoms: () => {
    const bartleType = usePlayerStore.getState().bartleType;
    const fogState = useMapStore.getState().fogState;
    const playerPos = useMapStore.getState().playerPosition;
    const playerTokens = usePlayerStore.getState().tokens;

    // Detect player zone entry for phantom reactivity.
    const playerChangedZone =
      previousPlayerZone !== null && previousPlayerZone !== playerPos.zoneId;
    previousPlayerZone = playerPos.zoneId;

    // Stores near the player (for "phantom leaves store" reaction).
    const storesNearPlayer = allStores.filter(
      (s) => s.zoneId === playerPos.zoneId && distance(s.position, playerPos) < 80,
    );

    // Identify the goalpost-pinned phantom (skip token bumps for it).
    const pinnedId = pinnedAbovePhantomId(playerTokens);

    // Collect flash-sale claim side effects to apply after set().
    const flashSalesToClaim: string[] = [];

    set((state) => {
      const newPhantoms = state.phantoms.map((p) => {
        // Get or initialize FSM state.
        let fsm = phantomStates.get(p.id) ?? initFSMState();
        const idHash = hashString(p.id);
        let position = p.position;
        let currentAction = p.currentAction;
        let tokenCount = p.tokenCount;

        // --- Player reactivity ---

        // When the player enters a zone, some phantoms already there notice.
        if (playerChangedZone && position.zoneId === playerPos.zoneId) {
          if (Math.random() < 0.4) {
            fsm = { ...initFSMState() };
            currentAction = noticeAction();
            phantomStates.set(p.id, fsm);
            return { ...p, position, currentAction, tokenCount, lastActivity: "just now" };
          }
        }

        // When the player is near a store with an in-store phantom, the
        // phantom may leave that store.
        if (fsm.phase === "in-store" && fsm.targetStoreId) {
          const nearStore = storesNearPlayer.find((s) => s.id === fsm.targetStoreId);
          if (nearStore && Math.random() < 0.5) {
            fsm = { ...fsm, phase: "leaving", ticksInPhase: 0 };
            currentAction = leavingAction(nearStore.name);
            phantomStates.set(p.id, fsm);
            return { ...p, position, currentAction, tokenCount, lastActivity: "just now" };
          }
        }

        // --- FSM transitions ---
        fsm = { ...fsm, ticksInPhase: fsm.ticksInPhase + 1 };

        switch (fsm.phase) {
          case "wandering": {
            const moveChance = 0.55 + (idHash % 30) / 100;
            if (Math.random() > moveChance) {
              // Idle — drift a little so no phantom fully freezes.
              if (Math.random() < 0.25) currentAction = idleWanderAction();
              position = wanderWithinZone(position, 14 + (idHash % 10));
              break;
            }

            // Zone-roam probability: phantoms get restless over time.
            // Base 40% chance to head to a new zone; rises to 65% after 3+
            // ticks of wandering so they don't park in one zone indefinitely.
            const roamChance = fsm.ticksInPhase >= 3 ? 0.65 : 0.40;
            const shouldRoam = Math.random() < roamChance;

            const store = shouldRoam ? null : pickStoreInZone(position.zoneId);
            if (store) {
              fsm = { ...fsm, phase: "approaching-store", targetStoreId: store.id, ticksInPhase: 0 };
              const stepSizeW = 55 + (idHash % 30);
              position = moveTowardTarget(position, store.position, stepSizeW);
              currentAction = approachingAction(store.name);
            } else {
              // Move to an adjacent zone.
              let adjZone = pickAdjacentZone(position.zoneId, fogState, bartleType);

              // Socializer-type players: phantoms drift toward the player's
              // zone when it is adjacent, creating a "following" crowd feel.
              if (bartleType === "socializer" && Math.random() < 0.5) {
                const curZone = getZoneById(position.zoneId);
                if (curZone && curZone.adjacentZoneIds.includes(playerPos.zoneId)) {
                  adjZone = playerPos.zoneId;
                }
              }

              if (adjZone) {
                fsm = { ...fsm, phase: "transitioning", targetZoneId: adjZone, ticksInPhase: 0, waypointReached: false };
                position = moveTowardZone(position, adjZone, 65);
                const zone = getZoneById(adjZone);
                currentAction = transitioningAction(zone?.name ?? adjZone);
              } else {
                // No adjacent zone available — wander locally.
                position = wanderWithinZone(position, 26 + (idHash % 16));
                currentAction = idleWanderAction();
              }
            }
            break;
          }

          case "approaching-store": {
            const store = fsm.targetStoreId ? getStoreById(fsm.targetStoreId) : null;
            if (!store) {
              fsm = { ...fsm, phase: "wandering", targetStoreId: null, ticksInPhase: 0 };
              currentAction = idleWanderAction();
              break;
            }
            const stepSize = 55 + (idHash % 30);
            position = moveTowardTarget(position, store.position, stepSize);
            if (isNearTarget(position, store.position, 25)) {
              // Arrived — spread anchor deterministically around the store so
              // multiple phantoms don't stack on the exact same pixel. The angle
              // is derived from idHash so each phantom occupies a different slot.
              const angle = ((idHash % 12) / 12) * Math.PI * 2;
              const radius = 28 + (idHash % 38);
              const anchorX = store.position.x + Math.cos(angle) * radius;
              const anchorY = store.position.y + Math.sin(angle) * radius;
              const dwellTicks = 2 + Math.floor(Math.random() * 4);
              fsm = { ...fsm, phase: "in-store", ticksInPhase: 0, dwellTicks, anchorX, anchorY };
              currentAction = storeInStoreAction(store.id);
              position = { x: anchorX, y: anchorY, zoneId: position.zoneId };
            } else {
              currentAction = approachingAction(store.name);
            }
            break;
          }

          case "in-store": {
            const store = fsm.targetStoreId ? getStoreById(fsm.targetStoreId) : null;
            if (!store) {
              fsm = { ...fsm, phase: "wandering", targetStoreId: null, ticksInPhase: 0 };
              currentAction = idleWanderAction();
              break;
            }
            // Drift gently around the anchor so the separation pass can push
            // overlapping in-store phantoms apart instead of snapping back.
            if (fsm.anchorX !== null && fsm.anchorY !== null) {
              const jx = (Math.random() - 0.5) * 10;
              const jy = (Math.random() - 0.5) * 10;
              position = {
                x: fsm.anchorX + jx,
                y: fsm.anchorY + jy,
                zoneId: position.zoneId,
              };
            }
            currentAction = storeInStoreAction(store.id);

            // Dwell complete — produce consequences and leave.
            if (fsm.ticksInPhase >= fsm.dwellTicks) {
              // Occasionally bump tokens (skip pinned phantom).
              if (p.id !== pinnedId && Math.random() < 0.35) {
                tokenCount += 1 + Math.floor(Math.random() * 2);
              }
              // Occasionally "claim" a flash sale for this store.
              if (Math.random() < 0.2) {
                const sales = flashSalesForStore(store.id);
                if (sales.length > 0) {
                  flashSalesToClaim.push(sales[0]!.id);
                }
              }
              fsm = { ...fsm, phase: "leaving", ticksInPhase: 0 };
              currentAction = leavingAction(store.name);
            }
            break;
          }

          case "leaving": {
            const storeName = fsm.targetStoreId
              ? getStoreById(fsm.targetStoreId)?.name ?? "the store"
              : "the store";
            const zone = getZoneById(position.zoneId);
            const target = zone?.center ?? position;
            position = moveTowardTarget(position, target, 30);
            if (fsm.ticksInPhase >= 2 || isNearTarget(position, target, 40)) {
              fsm = { ...fsm, phase: "wandering", targetStoreId: null, ticksInPhase: 0 };
              currentAction = idleWanderAction();
            } else {
              currentAction = leavingAction(storeName);
            }
            break;
          }

          case "transitioning": {
            const targetZoneId = fsm.targetZoneId;
            if (!targetZoneId) {
              fsm = { ...fsm, phase: "wandering", targetZoneId: null, ticksInPhase: 0, waypointReached: false };
              currentAction = idleWanderAction();
              break;
            }

            const zone = getZoneById(targetZoneId);
            currentAction = transitioningAction(zone?.name ?? targetZoneId);

            if (!fsm.waypointReached) {
              // Phase 1: walk toward the corridor waypoint first.
              const waypoint = getCorridorWaypoint(position.zoneId, targetZoneId);
              if (waypoint && !isNearTarget(position, waypoint, 35)) {
                const dx = waypoint.x - position.x;
                const dy = waypoint.y - position.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const step = Math.min(65, dist);
                position = {
                  x: position.x + (dx / dist) * step,
                  y: position.y + (dy / dist) * step,
                  zoneId: position.zoneId,
                };
                break;
              }
              // Waypoint reached (or no waypoint) — advance to phase 2.
              fsm = { ...fsm, waypointReached: true };
            }

            // Phase 2: head straight to the zone centre.
            position = moveTowardZone(position, targetZoneId, 65);
            if (position.zoneId === targetZoneId) {
              fsm = { ...fsm, phase: "wandering", targetZoneId: null, ticksInPhase: 0, waypointReached: false };
              currentAction = idleWanderAction();
            }
            break;
          }
        }

        phantomStates.set(p.id, fsm);
        return { ...p, position, currentAction, tokenCount, lastActivity: "just now" };
      });

      // --- Separation pass ---
      // Named phantom GIFs are 90px wide so they need at least ~90px clearance.
      // In-store phantoms are now included (with smaller threshold) since the
      // anchor now drifts per-tick, allowing pushes to have lasting effect.
      for (let i = 0; i < newPhantoms.length; i++) {
        const p1 = newPhantoms[i]!;
        const fsm1 = phantomStates.get(p1.id);
        const p1InStore = fsm1?.phase === "in-store";
        const minDist1 = p1InStore ? 55 : 95;
        const force1 = p1InStore ? 0.3 : 0.5;

        // Separate from player.
        if (p1.position.zoneId === playerPos.zoneId) {
          const dx = p1.position.x - playerPos.x;
          const dy = p1.position.y - playerPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < minDist1) {
            const push = (minDist1 - dist) * force1;
            p1.position = wanderWithinZone(
              {
                x: p1.position.x + (dx / dist) * push,
                y: p1.position.y + (dy / dist) * push,
                zoneId: p1.position.zoneId,
              },
              0,
            );
          }
        }

        // Separate from other phantoms.
        for (let j = i + 1; j < newPhantoms.length; j++) {
          const p2 = newPhantoms[j]!;
          const fsm2 = phantomStates.get(p2.id);
          // Skip pairs that are both actively approaching — let them walk freely.
          if (fsm1?.phase === "approaching-store" && fsm2?.phase === "approaching-store") continue;
          if (p1.position.zoneId === p2.position.zoneId) {
            const p2InStore = fsm2?.phase === "in-store";
            const minDist = Math.min(minDist1, p2InStore ? 55 : 95);
            const force = Math.min(force1, p2InStore ? 0.3 : 0.5) * 0.5;
            const dx = p1.position.x - p2.position.x;
            const dy = p1.position.y - p2.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < minDist) {
              const push = (minDist - dist) * force;
              p1.position = wanderWithinZone(
                {
                  x: p1.position.x + (dx / dist) * push,
                  y: p1.position.y + (dy / dist) * push,
                  zoneId: p1.position.zoneId,
                },
                0,
              );
              p2.position = wanderWithinZone(
                {
                  x: p2.position.x - (dx / dist) * push,
                  y: p2.position.y - (dy / dist) * push,
                  zoneId: p2.position.zoneId,
                },
                0,
              );
            }
          }
        }
      }

      return { phantoms: newPhantoms };
    });

    // Apply flash-sale claim side effects after set().
    for (const saleId of flashSalesToClaim) {
      useEconomyStore.getState().removeFlashSale(saleId);
    }
  },

  updateLeaderboard: () => {
    const state = get();
    const metric = state.activeMetric;

    // Build a combined list including the player with their LIVE values
    // (VAL-LEADER-004..006, VAL-LEADER-015, VAL-LEADER-024).
    const playerEntry = buildPlayerEntry();

    const phantomEntries: LeaderboardEntry[] = state.phantoms.map((p) => ({
      rank: 0,
      name: p.name,
      avatarSeed: p.avatarSeed,
      tier: p.tier,
      tokenCount: p.tokenCount,
      isPlayer: false,
      timeInMall: p.timeInMall,
      explorationPercent: p.explorationPercent,
    }));

    // Sort by the active metric, descending.
    const combined = [playerEntry, ...phantomEntries].sort(
      (a, b) => entryMetricValue(b, metric) - entryMetricValue(a, metric),
    );

    // Assign contiguous 1-indexed ranks (VAL-LEADER-021, VAL-LEADER-024).
    combined.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    set({ leaderboard: combined });
  },

  triggerProximityAlert: (targetName, tokenGap, rank, metric, metricLabel) => {
    const alert: ProximityAlert = {
      id: nextAlertId(),
      message:
        metric === "tokens"
          ? `You're only ${metricLabel} behind ${targetName} for #${rank}!`
          : metric === "time"
            ? `Only ${metricLabel} behind ${targetName} for #${rank}!`
            : `Just ${metricLabel} behind ${targetName} for #${rank}!`,
      targetName,
      tokenGap,
      rank,
      metric,
    };
    set((state) => ({ proximityAlerts: [...state.proximityAlerts, alert] }));
    return alert;
  },

  generatePhantomActivity: () => {
    get().movePhantoms();
    get().updateLeaderboard();
  },

  dismissProximityAlert: (alertId) =>
    set((state) => ({
      proximityAlerts: state.proximityAlerts.filter((a) => a.id !== alertId),
    })),

  setActiveMetric: (metric) => {
    set({ activeMetric: metric });
    // Re-rank immediately so the displayed order reflects the new metric.
    get().updateLeaderboard();
  },

  addPhantom: (phantom) =>
    set((state) => ({ phantoms: [...state.phantoms, phantom] })),

  adjustPhantom: (phantomId, fn) =>
    set((state) => ({
      phantoms: state.phantoms.map((p) =>
        p.id === phantomId ? fn(p) : p,
      ),
    })),

  reset: () => {
    resetPhantomStates();
    set({
      phantoms: initialPhantoms.map((p) => ({ ...p })),
      leaderboard: buildInitialLeaderboardWithPlayer(),
      proximityAlerts: [],
      activeMetric: "tokens",
    });
  },
}));

export default useSocialStore;
