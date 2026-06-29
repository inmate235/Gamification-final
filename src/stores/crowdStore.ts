/**
 * crowdStore - ambient background NPCs that populate the mall.
 *
 * ~25 lightweight "shoppers" with no name tags, no leaderboard entries, and
 * no GIF avatars — just colored dots that wander corridors, browse stores,
 * and flow between zones. They create the impression of a busy, living mall
 * without the per-element cost of the named social phantoms.
 *
 * Crowd NPCs respect fog-of-war: the renderer only draws those in revealed
 * zones, but the simulation runs for ALL of them so newly revealed zones
 * already feel populated the moment the fog lifts.
 *
 * Crowd events create visible rushes and gatherings:
 *  - Flash-sale rush: a magnet pulls nearby crowd toward the sale store.
 *  - Lunch rush: a periodic magnet swells the Food Court.
 *  - Zone-reveal attract: revealing a zone draws crowd from adjacent zones.
 */

import { create } from "zustand";
import {
  randomPositionInZone,
  wanderWithinZone,
  moveTowardTarget,
  moveTowardZone,
  pickStoreInZone,
  pickAdjacentZone,
  isNearTarget,
  getCorridorWaypoint,
} from "@/data/phantomData";
import {
  getStoreById,
  getZoneById,
  ZONE_ENTRANCE,
  ZONE_EAST_WING,
  ZONE_WEST_WING,
  ZONE_CENTRAL_PLAZA,
  ZONE_FOOD_COURT,
} from "@/data/mallData";
import { useMapStore } from "@/stores/mapStore";
import { usePlayerStore } from "@/stores/playerStore";

/* ============================================================================
   Types
   ========================================================================== */

type CrowdPhase =
  | "wandering"
  | "heading-to-store"
  | "lingering"
  | "transitioning";

export interface CrowdNPC {
  id: string;
  x: number;
  y: number;
  zoneId: string;
  /** Color hue (0-360) for visual variety. */
  hue: number;
  /** Dot radius in SVG units. */
  size: number;
  /** Per-NPC step multiplier (~0.55..1.6) — slow strollers vs brisk walkers. */
  speed: number;
  /** Per-NPC chance to move on a given tick (~0.45..0.9) — restlessness. */
  restlessness: number;
  phase: CrowdPhase;
  targetStoreId: string | null;
  targetZoneId: string | null;
  ticksInPhase: number;
  lingerTicks: number;
  waypointReached: boolean;
}

export interface CrowdMagnet {
  /** Target position the crowd streams toward. */
  x: number;
  y: number;
  zoneId: string;
  /** Store id when the magnet is a store (flash sale / lunch rush). */
  storeId: string | null;
  ticksRemaining: number;
}

export interface CrowdStoreState {
  npcs: CrowdNPC[];
  magnet: CrowdMagnet | null;
  /** Previous fog snapshot for zone-reveal detection. */
  prevFog: Record<string, boolean>;
  tickCrowd: () => void;
  setMagnet: (storeId: string, ticks: number) => void;
  setZoneMagnet: (zoneId: string, ticks: number) => void;
  clearMagnet: () => void;
  reset: () => void;
}

/* ============================================================================
   Initialization
   ========================================================================== */

/** Muted shopper hues — visually subordinate to named phantoms. */
const CROWD_HUES = [
  25, 200, 280, 340, 160, 60, 120, 0, 320, 180,
  90, 220, 300, 20, 140, 40, 260, 190, 350, 110,
  70, 240, 310, 150, 50,
];

/** Initial distribution of 25 NPCs across the five zones. */
const INITIAL_DISTRIBUTION: Array<{ zoneId: string; count: number }> = [
  { zoneId: ZONE_ENTRANCE, count: 9 },
  { zoneId: ZONE_EAST_WING, count: 4 },
  { zoneId: ZONE_WEST_WING, count: 4 },
  { zoneId: ZONE_CENTRAL_PLAZA, count: 4 },
  { zoneId: ZONE_FOOD_COURT, count: 4 },
];

function createInitialCrowd(): CrowdNPC[] {
  const npcs: CrowdNPC[] = [];
  let idx = 0;
  for (const { zoneId, count } of INITIAL_DISTRIBUTION) {
    for (let i = 0; i < count; i++) {
      const pos = randomPositionInZone(zoneId);
      // Spread personalities deterministically so no two adjacent NPCs feel
      // identical: golden-ratio stepping gives a well-distributed 0..1 value.
      const t = (idx * 0.61803398875) % 1;
      const speed = 0.55 + t * 1.05; // 0.55 .. 1.6
      const restlessness = 0.45 + ((idx * 0.40192) % 1) * 0.45; // 0.45 .. 0.9
      npcs.push({
        id: `crowd-${idx}`,
        x: pos.x,
        y: pos.y,
        zoneId,
        hue: CROWD_HUES[idx % CROWD_HUES.length] ?? 200,
        size: 3 + (idx % 3), // 3, 4, or 5
        speed,
        restlessness,
        phase: "wandering",
        targetStoreId: null,
        targetZoneId: null,
        ticksInPhase: idx % 5, // staggered so they don't all act at once
        lingerTicks: 0,
        waypointReached: false,
      });
      idx += 1;
    }
  }
  return npcs;
}

/* ============================================================================
   Store
   ========================================================================== */

export const useCrowdStore = create<CrowdStoreState>((set) => ({
  npcs: createInitialCrowd(),
  magnet: null,
  prevFog: {},

  tickCrowd: () => {
    const fogState = useMapStore.getState().fogState;
    const playerPos = useMapStore.getState().playerPosition;
    const bartleType = usePlayerStore.getState().bartleType;

    set((state) => {
      let magnet = state.magnet;
      const prevFog = state.prevFog;

      // --- Zone-reveal attract: detect newly revealed zones and set a
      //     transient zone-center magnet so adjacent crowd streams in. ---
      let revealMagnet: CrowdMagnet | null = null;
      for (const zoneId of Object.keys(fogState)) {
        if (fogState[zoneId] && !prevFog[zoneId]) {
          const zone = getZoneById(zoneId);
          if (zone) {
            revealMagnet = {
              x: zone.center.x,
              y: zone.center.y,
              zoneId,
              storeId: null,
              ticksRemaining: 10,
            };
          }
        }
      }

      // Merge: a reveal magnet takes priority briefly; otherwise keep existing.
      if (revealMagnet) {
        magnet = revealMagnet;
      } else if (magnet) {
        magnet = { ...magnet, ticksRemaining: magnet.ticksRemaining - 1 };
        if (magnet.ticksRemaining <= 0) magnet = null;
      }

      const activeMagnet = magnet;

      const newNpcs = state.npcs.map((n) => {
        let npc: CrowdNPC = { ...n, ticksInPhase: n.ticksInPhase + 1 };
        let { x, y, zoneId } = n;

        // --- Magnet bias: redirect wandering NPCs toward the magnet. ---
        if (npc.phase === "wandering" && activeMagnet) {
          if (activeMagnet.storeId && npc.zoneId === activeMagnet.zoneId) {
            // Same zone as a store magnet → stream to the store.
            if (Math.random() < 0.5) {
              npc = {
                ...npc,
                phase: "heading-to-store",
                targetStoreId: activeMagnet.storeId,
                ticksInPhase: 0,
              };
            }
          } else if (!activeMagnet.storeId) {
            // Zone-center magnet (reveal attract) → transition toward it
            // if the NPC is in an adjacent zone.
            const zone = getZoneById(npc.zoneId);
            if (zone && zone.adjacentZoneIds.includes(activeMagnet.zoneId)) {
              if (Math.random() < 0.45) {
                npc = {
                  ...npc,
                  phase: "transitioning",
                  targetZoneId: activeMagnet.zoneId,
                  ticksInPhase: 0,
                  waypointReached: false,
                };
              }
            } else if (npc.zoneId === activeMagnet.zoneId && Math.random() < 0.3) {
              // Already in the revealed zone → head to a store there.
              const store = pickStoreInZone(npc.zoneId);
              if (store) {
                npc = {
                  ...npc,
                  phase: "heading-to-store",
                  targetStoreId: store.id,
                  ticksInPhase: 0,
                };
              }
            }
          }
        }

        const spd = npc.speed;

        switch (npc.phase) {
          case "wandering": {
            if (Math.random() > npc.restlessness) {
              // Idle drift — amount scales with this shopper's pace.
              const drifted = wanderWithinZone({ x, y, zoneId }, (18 + Math.random() * 22) * spd);
              x = drifted.x;
              y = drifted.y;
              break;
            }

            const roll = Math.random();
            if (roll < 0.35) {
              // Head to a store in this zone.
              const store = pickStoreInZone(zoneId);
              if (store) {
                npc = {
                  ...npc,
                  phase: "heading-to-store",
                  targetStoreId: store.id,
                  ticksInPhase: 0,
                };
                const step = (55 + Math.random() * 30) * spd;
                const moved = moveTowardTarget({ x, y, zoneId }, store.position, step);
                x = moved.x;
                y = moved.y;
              } else {
                const w = wanderWithinZone({ x, y, zoneId }, (45 + Math.random() * 35) * spd);
                x = w.x;
                y = w.y;
              }
            } else if (roll < 0.55) {
              // Roam to an adjacent zone.
              const adj = pickAdjacentZone(zoneId, fogState, null);
              if (adj) {
                npc = {
                  ...npc,
                  phase: "transitioning",
                  targetZoneId: adj,
                  ticksInPhase: 0,
                  waypointReached: false,
                };
                const moved = moveTowardZone({ x, y, zoneId }, adj, 70 * spd);
                x = moved.x;
                y = moved.y;
                zoneId = moved.zoneId;
              } else {
                const w = wanderWithinZone({ x, y, zoneId }, (45 + Math.random() * 35) * spd);
                x = w.x;
                y = w.y;
              }
            } else {
              // Local wander — variable distance per shopper.
              const w = wanderWithinZone({ x, y, zoneId }, (40 + Math.random() * 45) * spd);
              x = w.x;
              y = w.y;
            }
            break;
          }

          case "heading-to-store": {
            const store = npc.targetStoreId ? getStoreById(npc.targetStoreId) : null;
            if (!store) {
              npc = { ...npc, phase: "wandering", targetStoreId: null, ticksInPhase: 0 };
              break;
            }
            const step = (55 + Math.random() * 30) * spd;
            const moved = moveTowardTarget({ x, y, zoneId }, store.position, step);
            x = moved.x;
            y = moved.y;
            if (isNearTarget({ x, y }, store.position, 22)) {
              // Browse time varies widely: quick glances vs long browsers.
              const linger = 2 + Math.floor(Math.random() * 7);
              npc = {
                ...npc,
                phase: "lingering",
                ticksInPhase: 0,
                lingerTicks: linger,
              };
            }
            break;
          }

          case "lingering": {
            // Small jitter while browsing — restless shoppers fidget more.
            if (Math.random() < 0.7) {
              const j = wanderWithinZone({ x, y, zoneId }, 6 + Math.random() * 8);
              x = j.x;
              y = j.y;
            }
            if (npc.ticksInPhase >= npc.lingerTicks) {
              npc = {
                ...npc,
                phase: "wandering",
                targetStoreId: null,
                ticksInPhase: 0,
              };
            }
            break;
          }

          case "transitioning": {
            const targetZoneId = npc.targetZoneId;
            if (!targetZoneId) {
              npc = { ...npc, phase: "wandering", targetZoneId: null, ticksInPhase: 0 };
              break;
            }
            if (!npc.waypointReached) {
              const waypoint = getCorridorWaypoint(zoneId, targetZoneId);
              if (waypoint && !isNearTarget({ x, y }, waypoint, 30)) {
                const dx = waypoint.x - x;
                const dy = waypoint.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const step = Math.min(65 * spd, dist);
                x = x + (dx / dist) * step;
                y = y + (dy / dist) * step;
                break;
              }
              npc = { ...npc, waypointReached: true };
            }
            const moved = moveTowardZone({ x, y, zoneId }, targetZoneId, 65 * spd);
            x = moved.x;
            y = moved.y;
            zoneId = moved.zoneId;
            if (zoneId === targetZoneId) {
              npc = {
                ...npc,
                phase: "wandering",
                targetZoneId: null,
                ticksInPhase: 0,
                waypointReached: false,
              };
            }
            break;
          }
        }

        // Socializer-type player: a few crowd members drift toward the player.
        if (
          bartleType === "socializer" &&
          npc.phase === "wandering" &&
          Math.random() < 0.08
        ) {
          const zone = getZoneById(zoneId);
          if (zone && zone.adjacentZoneIds.includes(playerPos.zoneId)) {
            npc = {
              ...npc,
              phase: "transitioning",
              targetZoneId: playerPos.zoneId,
              ticksInPhase: 0,
              waypointReached: false,
            };
          }
        }

        return { ...npc, x, y, zoneId };
      });

      // --- Separation pass: push overlapping NPCs apart. ---
      // Lingering NPCs (at stores) are included with a smaller threshold so
      // they spread around the store instead of stacking on the same pixel.
      for (let i = 0; i < newNpcs.length; i++) {
        const a = newNpcs[i]!;
        const aLingering = a.phase === "lingering";
        const aMinDist = aLingering ? 14 : 22;
        const aForce = aLingering ? 0.4 : 0.55;
        for (let j = i + 1; j < newNpcs.length; j++) {
          const b = newNpcs[j]!;
          if (a.zoneId !== b.zoneId) continue;
          // heading-to-store NPCs skip separation so they walk freely to target
          if (a.phase === "heading-to-store" || b.phase === "heading-to-store") continue;
          const bLingering = b.phase === "lingering";
          const minDist = Math.max(aMinDist, bLingering ? 14 : 22);
          const force = Math.min(aForce, bLingering ? 0.4 : 0.55);
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < minDist) {
            const push = (minDist - dist) * force;
            a.x = a.x + (dx / dist) * push;
            a.y = a.y + (dy / dist) * push;
            b.x = b.x - (dx / dist) * push;
            b.y = b.y - (dy / dist) * push;
          }
        }
      }

      return { npcs: newNpcs, magnet, prevFog: { ...fogState } };
    });
  },

  setMagnet: (storeId, ticks) => {
    const store = getStoreById(storeId);
    if (!store) return;
    set({
      magnet: {
        x: store.position.x,
        y: store.position.y,
        zoneId: store.zoneId,
        storeId,
        ticksRemaining: ticks,
      },
    });
  },

  setZoneMagnet: (zoneId, ticks) => {
    const zone = getZoneById(zoneId);
    if (!zone) return;
    set({
      magnet: {
        x: zone.center.x,
        y: zone.center.y,
        zoneId,
        storeId: null,
        ticksRemaining: ticks,
      },
    });
  },

  clearMagnet: () => set({ magnet: null }),

  reset: () =>
    set({
      npcs: createInitialCrowd(),
      magnet: null,
      prevFog: {},
    }),
}));

export default useCrowdStore;
