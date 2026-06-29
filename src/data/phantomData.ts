/**
 * Phantom user personas for the social layer.
 * Fabricated users with names, avatars, tiers, positions, and actions.
 * Used to populate the leaderboard and proximity alerts.
 *
 * Per spec: phantoms are always just barely ahead of the real player,
 * and a new one appears when the user overtakes one.
 */

import type { PhantomUser, LeaderboardEntry, Tier, Store } from "@/types";
import { getZoneById, getStoreById, storesByZone } from "@/data/mallData";

/* ============================================================================
   Zone positions for phantoms (must match mallData zone ids)
   ========================================================================== */

const PHANTOM_ZONE_POSITIONS: Record<
  string,
  { x: number; y: number; zoneId: string }
> = {
  "zone-entrance": { x: 480, y: 1090, zoneId: "zone-entrance" },
  "zone-east-wing": { x: 740, y: 810, zoneId: "zone-east-wing" },
  "zone-west-wing": { x: 260, y: 810, zoneId: "zone-west-wing" },
  "zone-central-plaza": { x: 500, y: 490, zoneId: "zone-central-plaza" },
  "zone-food-court": { x: 500, y: 200, zoneId: "zone-food-court" },
};

/**
 * Approximate bounding rectangles for each zone, derived from the polygon
 * coordinates in mallData.ts. Used to clamp zone-local wandering so phantoms
 * stay within their current zone. Inset by a small margin (30px) so avatars
 * don't hug the zone edges.
 */
const ZONE_BOUNDS: Record<
  string,
  { minX: number; maxX: number; minY: number; maxY: number }
> = {
  "zone-entrance": { minX: 90, maxX: 910, minY: 1030, maxY: 1165 },
  "zone-east-wing": { minX: 575, maxX: 910, minY: 670, maxY: 950 },
  "zone-west-wing": { minX: 90, maxX: 430, minY: 670, maxY: 950 },
  "zone-central-plaza": { minX: 255, maxX: 745, minY: 390, maxY: 590 },
  "zone-food-court": { minX: 255, maxX: 745, minY: 90, maxY: 310 },
};

/**
 * Generate a random position within the bounding rectangle of a zone.
 * Returns x, y, zoneId — suitable for use as a phantom position.
 * Falls back to the zone center if the zone has no bounds entry.
 */
export function randomPositionInZone(
  zoneId: string,
  rng: () => number = Math.random,
): { x: number; y: number; zoneId: string } {
  const bounds = ZONE_BOUNDS[zoneId];
  if (!bounds) {
    const center = PHANTOM_ZONE_POSITIONS[zoneId];
    return center ? { ...center } : { x: 500, y: 500, zoneId: "zone-central-plaza" };
  }
  return {
    x: bounds.minX + rng() * (bounds.maxX - bounds.minX),
    y: bounds.minY + rng() * (bounds.maxY - bounds.minY),
    zoneId,
  };
}

/**
 * Nudge a position by a small random offset (±wanderRadius) while keeping it
 * within the zone bounds. Used for zone-local wandering so phantoms drift
 * naturally within a zone rather than teleporting to a new spot.
 */
export function wanderWithinZone(
  current: { x: number; y: number; zoneId: string },
  wanderRadius: number = 40,
  rng: () => number = Math.random,
): { x: number; y: number; zoneId: string } {
  const bounds = ZONE_BOUNDS[current.zoneId];
  if (!bounds) return { ...current };
  const dx = (rng() - 0.5) * 2 * wanderRadius;
  const dy = (rng() - 0.5) * 2 * wanderRadius;
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, current.x + dx)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, current.y + dy)),
    zoneId: current.zoneId,
  };
}

/* ============================================================================
   Path-based movement helpers (replaces random teleport)
   ========================================================================== */

/**
 * Move a position one step toward a target position (e.g. a store),
 * clamped to the current zone's bounds. When the distance is within
 * `stepSize`, the position snaps to the target.
 */
export function moveTowardTarget(
  current: { x: number; y: number; zoneId: string },
  target: { x: number; y: number },
  stepSize: number,
): { x: number; y: number; zoneId: string } {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= stepSize || dist === 0) {
    return wanderWithinZone(
      { x: target.x, y: target.y, zoneId: current.zoneId },
      0,
    );
  }
  const ratio = stepSize / dist;
  return wanderWithinZone(
    {
      x: current.x + dx * ratio,
      y: current.y + dy * ratio,
      zoneId: current.zoneId,
    },
    0,
  );
}

/**
 * Move a position one step toward an adjacent zone's center. Unlike
 * `moveTowardTarget`, this does NOT clamp to the current zone during transit
 * (the corridor between two zone centers is outside both zones' bounding
 * boxes). The `zoneId` field updates to `targetZoneId` once the position
 * enters the target zone's bounds.
 */
export function moveTowardZone(
  current: { x: number; y: number; zoneId: string },
  targetZoneId: string,
  stepSize: number,
): { x: number; y: number; zoneId: string } {
  const targetZone = getZoneById(targetZoneId);
  if (!targetZone) return { ...current };
  const target = targetZone.center;
  const targetBounds = ZONE_BOUNDS[targetZoneId];

  // Already inside the target zone -> clamp to its bounds.
  if (
    targetBounds &&
    current.x >= targetBounds.minX &&
    current.x <= targetBounds.maxX &&
    current.y >= targetBounds.minY &&
    current.y <= targetBounds.maxY
  ) {
    return wanderWithinZone({ ...current, zoneId: targetZoneId }, 0);
  }

  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= stepSize) {
    return { x: target.x, y: target.y, zoneId: targetZoneId };
  }
  const ratio = stepSize / dist;
  const newX = current.x + dx * ratio;
  const newY = current.y + dy * ratio;

  // Check whether the new position has entered the target zone.
  if (
    targetBounds &&
    newX >= targetBounds.minX &&
    newX <= targetBounds.maxX &&
    newY >= targetBounds.minY &&
    newY <= targetBounds.maxY
  ) {
    return { x: newX, y: newY, zoneId: targetZoneId };
  }

  return { x: newX, y: newY, zoneId: current.zoneId };
}

/** Euclidean distance check. */
export function isNearTarget(
  pos: { x: number; y: number },
  target: { x: number; y: number },
  threshold: number = 25,
): boolean {
  const dx = pos.x - target.x;
  const dy = pos.y - target.y;
  return Math.sqrt(dx * dx + dy * dy) <= threshold;
}

/**
 * Pick a random store within a zone. Returns null when the zone has no
 * stores (e.g. Central Plaza).
 */
export function pickStoreInZone(
  zoneId: string,
  rng: () => number = Math.random,
): Store | null {
  const zoneStores = storesByZone[zoneId];
  if (!zoneStores || zoneStores.length === 0) return null;
  return zoneStores[Math.floor(rng() * zoneStores.length)] ?? null;
}

/**
 * Pick an adjacent zone for a zone transition. For Explorer-type players,
 * 60% of the time an unexplored (fogged) adjacent zone is preferred
 * (VAL-CROSS-039). Returns null when the current zone has no adjacency.
 */
export function pickAdjacentZone(
  currentZoneId: string,
  fogState: Record<string, boolean>,
  bartleType: string | null,
  rng: () => number = Math.random,
): string | null {
  const zone = getZoneById(currentZoneId);
  if (!zone || zone.adjacentZoneIds.length === 0) return null;

  if (bartleType === "explorer") {
    const foggedAdj = zone.adjacentZoneIds.filter((id) => !fogState[id]);
    if (foggedAdj.length > 0 && rng() < 0.6) {
      return foggedAdj[Math.floor(rng() * foggedAdj.length)] ?? null;
    }
  }

  const adj = zone.adjacentZoneIds;
  return adj[Math.floor(rng() * adj.length)] ?? null;
}

const PHANTOM_ACTIONS = [
  "exploring the East Wing",
  "spinning the wheel",
  "browsing TechNova",
  "heading to the Food Court",
  "claimed a flash sale",
  "just found a secret token",
  "comparing prices at Prism",
  "resting in Central Plaza",
  "queueing for Sushi Yuki",
  "checking the leaderboard",
];

/* ============================================================================
   Store-specific action templates
   ========================================================================== */

const STORE_INSTORE_ACTIONS: Record<string, string[]> = {
  "store-bloom": [
    "trying on a silk dress at Bloom",
    "browsing the Spring Capsule at Bloom",
    "checking out at Bloom",
  ],
  "store-pulse": [
    "testing earbuds at Pulse",
    "comparing gadgets at Pulse",
    "browsing the Glow Earbuds at Pulse",
  ],
  "store-technova": [
    "typing on a Neon Keyboard at TechNova",
    "browsing tech at TechNova",
    "checking out the Neon Keyboard at TechNova",
  ],
  "store-chrome": [
    "trying on a Mesh Band at Chrome",
    "browsing watches at Chrome",
    "checking out at Chrome",
  ],
  "store-prism": [
    "trying on Iris Lenses at Prism",
    "browsing sunglasses at Prism",
    "comparing lenses at Prism",
  ],
  "store-lumiere": [
    "smelling candles at Lumiere",
    "browsing the Amber Candle at Lumiere",
    "checking out at Lumiere",
  ],
  "store-maison": [
    "feeling the Linen Throw at Maison",
    "browsing home goods at Maison",
    "checking out at Maison",
  ],
  "store-cafe-nuit": [
    "sipping a Midnight Latte at Cafe Nuit",
    "queueing at Cafe Nuit",
    "ordering at Cafe Nuit",
  ],
  "store-sushi-yuki": [
    "ordering the Omakase Box at Sushi Yuki",
    "waiting for sushi at Sushi Yuki",
    "dining at Sushi Yuki",
  ],
  "store-burger-hex": [
    "ordering the Hex Combo at Burger Hex",
    "queueing at Burger Hex",
    "eating at Burger Hex",
  ],
};

const IDLE_WANDER_ACTIONS = [
  "looking at a display",
  "checking their phone",
  "reading a sign",
  "window shopping",
  "taking a photo",
  "browsing the mall",
];

const NOTICE_ACTIONS = [
  "glanced your way",
  "noticed you nearby",
  "looking around",
  "checking out the new arrival",
];

/** Generate a store-specific in-store action string. */
export function storeInStoreAction(
  storeId: string,
  rng: () => number = Math.random,
): string {
  const actions = STORE_INSTORE_ACTIONS[storeId];
  if (actions && actions.length > 0) {
    return actions[Math.floor(rng() * actions.length)] ?? actions[0]!;
  }
  const store = getStoreById(storeId);
  if (store) return `browsing at ${store.name}`;
  return samplePhantomAction(rng);
}

/** Action for a phantom walking toward a store. */
export function approachingAction(storeName: string): string {
  return `heading to ${storeName}`;
}

/** Action for a phantom leaving a store. */
export function leavingAction(storeName: string): string {
  return `leaving ${storeName}`;
}

/** Action for a phantom transitioning between zones. */
export function transitioningAction(zoneName: string): string {
  return `heading to the ${zoneName}`;
}

/** Idle wandering action (phone, window shopping, etc.). */
export function idleWanderAction(rng: () => number = Math.random): string {
  return IDLE_WANDER_ACTIONS[Math.floor(rng() * IDLE_WANDER_ACTIONS.length)] ?? "browsing";
}

/** Notice action when a phantom sees the player enter their zone. */
export function noticeAction(rng: () => number = Math.random): string {
  return NOTICE_ACTIONS[Math.floor(rng() * NOTICE_ACTIONS.length)] ?? "looking around";
}

/* ============================================================================
   Phantom persona roster
   ========================================================================== */

interface PhantomSeed {
  id: string;
  name: string;
  tier: Tier;
  tokenCount: number;
  /** Synthetic minutes already spent in the mall. */
  timeInMall: number;
  /** Fabricated exploration percentage. */
  explorationPercent: number;
}

const PHANTOM_SEEDS: PhantomSeed[] = [
  { id: "phantom-alex", name: "Alex", tier: "gold", tokenCount: 42, timeInMall: 38, explorationPercent: 72 },
  { id: "phantom-sam", name: "Sam", tier: "silver", tokenCount: 28, timeInMall: 24, explorationPercent: 58 },
  { id: "phantom-jordan", name: "Jordan", tier: "gold", tokenCount: 55, timeInMall: 51, explorationPercent: 80 },
  { id: "phantom-taylor", name: "Taylor", tier: "bronze", tokenCount: 12, timeInMall: 9, explorationPercent: 22 },
  { id: "phantom-morgan", name: "Morgan", tier: "silver", tokenCount: 31, timeInMall: 27, explorationPercent: 61 },
  { id: "phantom-casey", name: "Casey", tier: "neodymium", tokenCount: 88, timeInMall: 76, explorationPercent: 94 },
  { id: "phantom-riley", name: "Riley", tier: "bronze", tokenCount: 9, timeInMall: 6, explorationPercent: 18 },
  { id: "phantom-quinn", name: "Quinn", tier: "silver", tokenCount: 24, timeInMall: 21, explorationPercent: 54 },
];

/* ============================================================================
   Name pool for dynamically generated phantoms
   (used when the user overtakes a phantom and a new one appears just ahead,
     VAL-LEADER-014, VAL-LEADER-017)
   ========================================================================== */

export const PHANTOM_NAME_POOL: string[] = [
  "Avery",
  "Brooke",
  "Cameron",
  "Dakota",
  "Emery",
  "Finley",
  "Hayden",
  "Indigo",
  "Jules",
  "Kai",
  "Logan",
  "Marlowe",
  "Noa",
  "Oakley",
  "Parker",
  "Reese",
  "Sage",
  "Tatum",
  "Wren",
  "Zion",
  "Arden",
  "Blair",
  "Cleo",
  "Drew",
  "Eden",
  "Frankie",
  "Greer",
  "Harlow",
  "Iris",
  "Juno",
];

let generatedPhantomCounter = 0;

/**
 * Fabricate a brand-new phantom user positioned just above the given player
 * score. The new phantom's score is set to `playerScore + gap` so it is
 * always just barely ahead (goalpost shifting, VAL-LEADER-010,
 * VAL-LEADER-014, VAL-LEADER-017).
 *
 * @param playerTokens    The player's current token count.
 * @param playerTime      The player's current time-in-mall (synthetic min).
 * @param playerExploration The player's current exploration %.
 * @param gap             How many tokens ahead the new phantom should sit.
 * @param usedNames       Names already in use (so we don't duplicate).
 */
export function fabricatePhantom(
  playerTokens: number,
  playerTime: number,
  playerExploration: number,
  gap: number,
  usedNames: ReadonlySet<string>,
): PhantomUser {
  generatedPhantomCounter += 1;
  const id = `phantom-gen-${generatedPhantomCounter}`;

  // Pick an unused name from the pool.
  let name = "Avery";
  for (const candidate of PHANTOM_NAME_POOL) {
    if (!usedNames.has(candidate)) {
      name = candidate;
      break;
    }
  }

  // Tier weighted toward gold/silver so the phantom feels aspirational.
  const tierRoll = Math.random();
  const tier: Tier =
    tierRoll < 0.15
      ? "neodymium"
      : tierRoll < 0.5
        ? "gold"
        : tierRoll < 0.85
          ? "silver"
          : "bronze";

  const zoneKeys = Object.keys(PHANTOM_ZONE_POSITIONS);
  const zoneKey = zoneKeys[Math.floor(Math.random() * zoneKeys.length)];
  const pos = zoneKey ? PHANTOM_ZONE_POSITIONS[zoneKey] : null;
  const position = pos
    ? { ...pos }
    : { x: 500, y: 500, zoneId: "zone-central-plaza" };

  return {
    id,
    name,
    avatarSeed: `${id}-avatar`,
    tier,
    tokenCount: Math.max(0, playerTokens + gap),
    position,
    currentAction: PHANTOM_ACTIONS[
      Math.floor(Math.random() * PHANTOM_ACTIONS.length)
    ] ?? "browsing",
    lastActivity: "just now",
    // New phantoms are just barely ahead on every metric.
    timeInMall: Math.max(1, playerTime + 1 + Math.floor(Math.random() * 3)),
    explorationPercent: Math.min(
      99,
      Math.max(1, playerExploration + 1 + Math.floor(Math.random() * 3)),
    ),
  };
}

/* ============================================================================
   Build the phantom user list
   ========================================================================== */

function buildPhantoms(): PhantomUser[] {
  return PHANTOM_SEEDS.map((seed, idx) => {
    const zoneKeys = Object.keys(PHANTOM_ZONE_POSITIONS);
    const zoneKey = zoneKeys[idx % zoneKeys.length];
    const pos = PHANTOM_ZONE_POSITIONS[zoneKey];
    if (!pos) {
      throw new Error(`Missing phantom zone position for ${zoneKey}`);
    }
    return {
      id: seed.id,
      name: seed.name,
      avatarSeed: `${seed.id}-avatar`,
      tier: seed.tier,
      tokenCount: seed.tokenCount,
      position: pos,
      currentAction: PHANTOM_ACTIONS[idx % PHANTOM_ACTIONS.length],
      lastActivity: "just now",
      timeInMall: seed.timeInMall,
      explorationPercent: seed.explorationPercent,
    };
  });
}

export const phantoms: PhantomUser[] = buildPhantoms();

/* ============================================================================
   Initial leaderboard
   ========================================================================== */

export const initialLeaderboard: LeaderboardEntry[] = PHANTOM_SEEDS.map(
  (seed, idx) => ({
    rank: idx + 1,
    name: seed.name,
    avatarSeed: `${seed.id}-avatar`,
    tier: seed.tier,
    tokenCount: seed.tokenCount,
    isPlayer: false,
    timeInMall: seed.timeInMall,
    explorationPercent: seed.explorationPercent,
  })
);

/* ============================================================================
   Helpers
   ========================================================================== */

/** Lookup a phantom by id. Returns undefined if not found. */
export function getPhantomById(phantomId: string): PhantomUser | undefined {
  return phantoms.find((p) => p.id === phantomId);
}

/** Find the phantom ranked immediately above a given token count. */
export function phantomJustAbove(
  tokenCount: number
): PhantomUser | undefined {
  const sorted = [...phantoms].sort((a, b) => a.tokenCount - b.tokenCount);
  return sorted.find((p) => p.tokenCount > tokenCount);
}

/** Sample a phantom action string (used by socialStore.movePhantoms). */
export function samplePhantomAction(rng: () => number = Math.random): string {
  const idx = Math.floor(rng() * PHANTOM_ACTIONS.length);
  const action = PHANTOM_ACTIONS[idx];
  if (!action) return PHANTOM_ACTIONS[0] ?? "browsing";
  return action;
}

/**
 * Corridor waypoints — the centre of each connecting corridor strip.
 * Phantoms route through these when transitioning between zones so they
 * walk through corridors rather than cutting diagonally through walls.
 * Key format: "fromZoneId:toZoneId" (both directions are listed).
 */
const CORRIDOR_WAYPOINTS: Record<string, { x: number; y: number }> = {
  "zone-entrance:zone-west-wing":   { x: 262, y: 985 },
  "zone-west-wing:zone-entrance":   { x: 262, y: 985 },
  "zone-entrance:zone-east-wing":   { x: 738, y: 985 },
  "zone-east-wing:zone-entrance":   { x: 738, y: 985 },
  "zone-west-wing:zone-central-plaza":  { x: 340, y: 625 },
  "zone-central-plaza:zone-west-wing":  { x: 340, y: 625 },
  "zone-east-wing:zone-central-plaza":  { x: 660, y: 625 },
  "zone-central-plaza:zone-east-wing":  { x: 660, y: 625 },
  "zone-central-plaza:zone-food-court": { x: 500, y: 348 },
  "zone-food-court:zone-central-plaza": { x: 500, y: 348 },
};

/** Return the corridor waypoint between two adjacent zones, or null if none. */
export function getCorridorWaypoint(
  fromZoneId: string,
  toZoneId: string,
): { x: number; y: number } | null {
  return CORRIDOR_WAYPOINTS[`${fromZoneId}:${toZoneId}`] ?? null;
}

export { PHANTOM_ZONE_POSITIONS, PHANTOM_ACTIONS, ZONE_BOUNDS };
