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
 * Movement is heading-based with gradual drift so NPCs follow smooth curving
 * paths instead of random jitter. Each NPC has its own tick period and phase
 * so they move at different times — no synchronized "mirror" effect.
 *
 * Crowd events create visible rushes and gatherings:
 *  - Flash-sale rush: a magnet pulls nearby crowd toward the sale store.
 *  - Lunch rush: a periodic magnet swells the Food Court.
 *  - Zone-reveal attract: revealing a zone draws crowd from adjacent zones.
 */

import { create } from "zustand";
import {
  randomPositionInZone,
  moveTowardTarget,
  moveTowardZone,
  pickStoreInZone,
  pickAdjacentZone,
  isNearTarget,
  getCorridorWaypoint,
  ZONE_BOUNDS,
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
  /** Current heading in radians (0 = right, PI/2 = down in SVG coords). */
  heading: number;
  /** Max heading change per move in radians — lower = straighter paths. */
  headingDrift: number;
  /** How many 1-second scheduler ticks between this NPC's moves (2 or 3). */
  tickPeriod: number;
  /** Phase offset (0..tickPeriod-1) — when this NPC next moves. */
  tickPhase: number;
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
   Heading-based movement helpers
   ========================================================================== */

/**
 * Move a position along its heading by `stepSize` SVG units, reflecting
 * off zone boundaries like a billiard ball. Returns the new position and
 * the (possibly reflected) heading so the NPC continues smoothly on the
 * next tick instead of jittering against the wall.
 */
function driftWithHeading(
  x: number,
  y: number,
  zoneId: string,
  heading: number,
  stepSize: number,
): { x: number; y: number; heading: number } {
  const bounds = ZONE_BOUNDS[zoneId];
  let nx = x + Math.cos(heading) * stepSize;
  let ny = y + Math.sin(heading) * stepSize;
  let nh = heading;

  if (bounds) {
    const margin = 8;
    if (nx < bounds.minX + margin) {
      nx = bounds.minX + margin;
      nh = Math.PI - nh;
    } else if (nx > bounds.maxX - margin) {
      nx = bounds.maxX - margin;
      nh = Math.PI - nh;
    }
    if (ny < bounds.minY + margin) {
      ny = bounds.minY + margin;
      nh = -nh;
    } else if (ny > bounds.maxY - margin) {
      ny = bounds.maxY - margin;
      nh = -nh;
    }
  }

  return { x: nx, y: ny, heading: nh };
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
      // Per-NPC tick scheduling: period 2 or 3 with varied phase offsets
      // so NPCs move at different times — breaks the synchronized "mirror" look.
      const tickPeriod = idx % 3 === 0 ? 3 : 2;
      const tickPhase = idx % tickPeriod;
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
        ticksInPhase: idx % 5,
        lingerTicks: 0,
        waypointReached: false,
        heading: Math.random() * Math.PI * 2,
        headingDrift: 0.3 + Math.random() * 0.6, // 0.3..0.9 rad — gentle curves
        tickPeriod,
        tickPhase,
      });
      idx += 1;
    }
  }
  return npcs;
}

/* ============================================================================
   Module-level tick counter for per-NPC scheduling
   ========================================================================== */

let globalTick = 0;

/* ============================================================================
   Store
   ========================================================================== */

export const useCrowdStore = create<CrowdStoreState>((set) => ({
  npcs: createInitialCrowd(),
  magnet: null,
  prevFog: {},

  tickCrowd: () => {
    const tick = globalTick;
    globalTick += 1;

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
        // Per-NPC scheduling: only process this NPC's FSM on its own tick.
        // This breaks the synchronized movement that made the crowd look
        // static and mirrored — NPCs now move at staggered intervals.
        const isMyTick = tick % n.tickPeriod === n.tickPhase;

        let npc: CrowdNPC = { ...n };
        let { x, y, zoneId, heading } = n;

        if (isMyTick) {
          npc = { ...npc, ticksInPhase: n.ticksInPhase + 1 };

          // --- Magnet bias: redirect wandering NPCs toward the magnet. ---
          if (npc.phase === "wandering" && activeMagnet) {
            if (activeMagnet.storeId && npc.zoneId === activeMagnet.zoneId) {
              if (Math.random() < 0.5) {
                npc = {
                  ...npc,
                  phase: "heading-to-store",
                  targetStoreId: activeMagnet.storeId,
                  ticksInPhase: 0,
                };
              }
            } else if (!activeMagnet.storeId) {
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
                // Idle drift with heading — small step, heading drifts more.
                heading += (Math.random() - 0.5) * npc.headingDrift * 1.5;
                const step = (22 + Math.random() * 28) * spd;
                const drifted = driftWithHeading(x, y, zoneId, heading, step);
                x = drifted.x;
                y = drifted.y;
                heading = drifted.heading;
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
                  const step = (60 + Math.random() * 35) * spd;
                  const moved = moveTowardTarget({ x, y, zoneId }, store.position, step);
                  x = moved.x;
                  y = moved.y;
                  // Update heading to face the store for smooth transitions.
                  heading = Math.atan2(store.position.y - y, store.position.x - x);
                } else {
                  heading += (Math.random() - 0.5) * npc.headingDrift;
                  const step = (50 + Math.random() * 40) * spd;
                  const drifted = driftWithHeading(x, y, zoneId, heading, step);
                  x = drifted.x;
                  y = drifted.y;
                  heading = drifted.heading;
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
                  const moved = moveTowardZone({ x, y, zoneId }, adj, 75 * spd);
                  x = moved.x;
                  y = moved.y;
                  zoneId = moved.zoneId;
                } else {
                  heading += (Math.random() - 0.5) * npc.headingDrift;
                  const step = (50 + Math.random() * 40) * spd;
                  const drifted = driftWithHeading(x, y, zoneId, heading, step);
                  x = drifted.x;
                  y = drifted.y;
                  heading = drifted.heading;
                }
              } else {
                // Local wander with heading momentum — smooth curves, not jitter.
                heading += (Math.random() - 0.5) * npc.headingDrift;
                const step = (45 + Math.random() * 50) * spd;
                const drifted = driftWithHeading(x, y, zoneId, heading, step);
                x = drifted.x;
                y = drifted.y;
                heading = drifted.heading;
              }
              break;
            }

            case "heading-to-store": {
              const store = npc.targetStoreId ? getStoreById(npc.targetStoreId) : null;
              if (!store) {
                npc = { ...npc, phase: "wandering", targetStoreId: null, ticksInPhase: 0 };
                break;
              }
              const step = (60 + Math.random() * 35) * spd;
              const moved = moveTowardTarget({ x, y, zoneId }, store.position, step);
              x = moved.x;
              y = moved.y;
              heading = Math.atan2(store.position.y - y, store.position.x - x);
              if (isNearTarget({ x, y }, store.position, 22)) {
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
              // Small heading-based jitter while browsing.
              if (Math.random() < 0.7) {
                heading += (Math.random() - 0.5) * npc.headingDrift * 2;
                const step = 8 + Math.random() * 10;
                const drifted = driftWithHeading(x, y, zoneId, heading, step);
                x = drifted.x;
                y = drifted.y;
                heading = drifted.heading;
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
                  const step = Math.min(70 * spd, dist);
                  x = x + (dx / dist) * step;
                  y = y + (dy / dist) * step;
                  heading = Math.atan2(dy, dx);
                  break;
                }
                npc = { ...npc, waypointReached: true };
              }
              const moved = moveTowardZone({ x, y, zoneId }, targetZoneId, 70 * spd);
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
        }

        return { ...npc, x, y, zoneId, heading };
      });

      // --- Separation pass: push overlapping NPCs apart. ---
      // Uses per-NPC asymmetric force coefficients so the push is not a
      // perfect mirror — one NPC shifts more than the other, mimicking
      // real crowd dynamics where some people yield more than others.
      for (let i = 0; i < newNpcs.length; i++) {
        const a = newNpcs[i]!;
        const aLingering = a.phase === "lingering";
        const aMinDist = aLingering ? 14 : 22;
        // Asymmetric force: each NPC yields a different amount.
        const aForce = (aLingering ? 0.4 : 0.55) * (0.7 + (a.speed * 0.3));
        for (let j = i + 1; j < newNpcs.length; j++) {
          const b = newNpcs[j]!;
          if (a.zoneId !== b.zoneId) continue;
          if (a.phase === "heading-to-store" || b.phase === "heading-to-store") continue;
          const bLingering = b.phase === "lingering";
          const minDist = Math.max(aMinDist, bLingering ? 14 : 22);
          const bForce = (bLingering ? 0.4 : 0.55) * (0.7 + (b.speed * 0.3));
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < minDist) {
            // Asymmetric push: each NPC moves by its own force coefficient.
            const overlap = minDist - dist;
            a.x = a.x + (dx / dist) * overlap * aForce;
            a.y = a.y + (dy / dist) * overlap * aForce;
            b.x = b.x - (dx / dist) * overlap * bForce;
            b.y = b.y - (dy / dist) * overlap * bForce;
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

  reset: () => {
    globalTick = 0;
    set({
      npcs: createInitialCrowd(),
      magnet: null,
      prevFog: {},
    });
  },
}));

export default useCrowdStore;
