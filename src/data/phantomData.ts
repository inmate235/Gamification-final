/**
 * Phantom user personas for the social layer.
 * Fabricated users with names, avatars, tiers, positions, and actions.
 * Used to populate the leaderboard and proximity alerts.
 *
 * Per spec: phantoms are always just barely ahead of the real player,
 * and a new one appears when the user overtakes one.
 */

import type { PhantomUser, LeaderboardEntry, Tier } from "@/types";

/* ============================================================================
   Zone positions for phantoms (must match mallData zone ids)
   ========================================================================== */

const PHANTOM_ZONE_POSITIONS: Record<
  string,
  { x: number; y: number; zoneId: string }
> = {
  "zone-entrance": { x: 480, y: 1090, zoneId: "zone-entrance" },
  "zone-east-wing": { x: 690, y: 810, zoneId: "zone-east-wing" },
  "zone-west-wing": { x: 320, y: 810, zoneId: "zone-west-wing" },
  "zone-central-plaza": { x: 510, y: 490, zoneId: "zone-central-plaza" },
  "zone-food-court": { x: 500, y: 200, zoneId: "zone-food-court" },
};

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
   Phantom persona roster
   ========================================================================== */

interface PhantomSeed {
  id: string;
  name: string;
  tier: Tier;
  tokenCount: number;
}

const PHANTOM_SEEDS: PhantomSeed[] = [
  { id: "phantom-alex", name: "Alex", tier: "gold", tokenCount: 42 },
  { id: "phantom-sam", name: "Sam", tier: "silver", tokenCount: 28 },
  { id: "phantom-jordan", name: "Jordan", tier: "gold", tokenCount: 55 },
  { id: "phantom-taylor", name: "Taylor", tier: "bronze", tokenCount: 12 },
  { id: "phantom-morgan", name: "Morgan", tier: "silver", tokenCount: 31 },
  { id: "phantom-casey", name: "Casey", tier: "neodymium", tokenCount: 88 },
  { id: "phantom-riley", name: "Riley", tier: "bronze", tokenCount: 9 },
  { id: "phantom-quinn", name: "Quinn", tier: "silver", tokenCount: 24 },
];

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

export { PHANTOM_ZONE_POSITIONS, PHANTOM_ACTIONS };
