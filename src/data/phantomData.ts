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

export { PHANTOM_ZONE_POSITIONS, PHANTOM_ACTIONS };
