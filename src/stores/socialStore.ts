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
  samplePhantomAction,
  PHANTOM_ZONE_POSITIONS,
} from "@/data/phantomData";
import { usePlayerStore } from "./playerStore";
import { useMapStore } from "./mapStore";
import { useSessionStore } from "./sessionStore";

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
  leaderboard: initialLeaderboard.map((e) => ({ ...e })),
  proximityAlerts: [],
  activeMetric: "tokens",

  movePhantoms: () =>
    set((state) => ({
      phantoms: state.phantoms.map((p) => {
        const zoneKeys = Object.keys(PHANTOM_ZONE_POSITIONS);
        const nextKey = zoneKeys[
          Math.floor(Math.random() * zoneKeys.length)
        ];
        const nextPos = nextKey
          ? PHANTOM_ZONE_POSITIONS[nextKey]
          : p.position;
        return {
          ...p,
          position: nextPos ? { ...nextPos } : p.position,
          currentAction: samplePhantomAction(),
          lastActivity: "just now",
        };
      }),
    })),

  updateLeaderboard: () => {
    const playerTokens = usePlayerStore.getState().tokens;
    const playerTime = useSessionStore.getState().sessionMinutes;
    const playerExploration = useMapStore.getState().explorationPercent;
    const playerTier = usePlayerStore.getState().tier;
    const state = get();
    const metric = state.activeMetric;

    // Build a combined list including the player with their LIVE values
    // (VAL-LEADER-004..006, VAL-LEADER-015, VAL-LEADER-024).
    const playerEntry: LeaderboardEntry = {
      rank: 0,
      name: "You",
      avatarSeed: "player-avatar",
      tier: playerTier,
      tokenCount: playerTokens,
      isPlayer: true,
      timeInMall: playerTime,
      explorationPercent: playerExploration,
    };

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

  reset: () =>
    set({
      phantoms: initialPhantoms.map((p) => ({ ...p })),
      leaderboard: initialLeaderboard.map((e) => ({ ...e })),
      proximityAlerts: [],
      activeMetric: "tokens",
    }),
}));

export default useSocialStore;
