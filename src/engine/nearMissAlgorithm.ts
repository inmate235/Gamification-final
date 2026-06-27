/**
 * nearMissAlgorithm - the spinning wheel prize distribution + near-miss bias.
 *
 * Per architecture.md the wheel has 7 prize segments. 40% of spins land one
 * slot away from the big prize (10 tokens) — the wheel visually slows near the
 * big prize then clicks past it to the adjacent slot, creating a near-miss
 * emotional arc that drives re-spinning (DECISIONS 6D.2).
 *
 * The remaining 60% of spins use a weighted distribution that includes ALL
 * prize types: tokens (1, 3, 5, 10), map reveal, flash sale access, and
 * nothing. Neodymium tier gets a higher win rate (reduced "nothing" weight,
 * boosted token weights).
 *
 * Token prizes are credited via `playerStore.awardTokens` which applies the
 * tier earn-rate multiplier (VAL-WHEEL-017).
 */

import type { Tier } from "@/types";
import { usePlayerStore } from "@/stores/playerStore";
import { useEconomyStore } from "@/stores/economyStore";
import { useMapStore } from "@/stores/mapStore";

/* ============================================================================
   Types
   ========================================================================== */

export type WheelPrizeType = "tokens" | "map-reveal" | "flash-sale" | "nothing";

export interface WheelSegment {
  index: number;
  type: WheelPrizeType;
  /** Face-value token amount (0 for non-token prizes). */
  tokens: number;
  label: string;
  color: string;
}

export interface SpinResult {
  segmentIndex: number;
  segment: WheelSegment;
  nearMiss: boolean;
}

/* ============================================================================
   Constants — wheel layout
   ========================================================================== */

/**
 * 7 segments arranged clockwise starting from the top (12 o'clock).
 *
 * Index 0 = big prize (10 tokens), centered at the top.
 * Index 6 = the counter-clockwise-adjacent slot (just left of big prize).
 *
 * With a CLOCKWISE wheel rotation, segments pass the fixed top pointer in
 * reverse order: … 2, 1, 0 (big prize), 6, 5, …  So landing on index 6 means
 * the big prize (0) is the LAST segment the pointer passes before settling —
 * the deceleration curve makes the wheel visibly slow at the big prize then
 * click past it to index 6.  This is the near-miss visual.
 */
export const WHEEL_SEGMENTS: WheelSegment[] = [
  { index: 0, type: "tokens", tokens: 10, label: "10 Tokens", color: "#d4af37" },
  { index: 1, type: "tokens", tokens: 5, label: "5 Tokens", color: "#4fd1c5" },
  { index: 2, type: "map-reveal", tokens: 0, label: "Map Reveal", color: "#9d7fdb" },
  { index: 3, type: "tokens", tokens: 3, label: "3 Tokens", color: "#4fd1c5" },
  { index: 4, type: "flash-sale", tokens: 0, label: "Flash Sale", color: "#e879a1" },
  { index: 5, type: "tokens", tokens: 1, label: "1 Token", color: "#4fd1c5" },
  { index: 6, type: "nothing", tokens: 0, label: "Nothing", color: "#71717a" },
];

export const BIG_PRIZE_INDEX = 0;
/** The segment the near-miss lands on (counter-clockwise adjacent to big prize). */
export const NEAR_MISS_INDEX = 6;
export const NEAR_MISS_THRESHOLD = 0.25;
export const SEGMENT_COUNT = WHEEL_SEGMENTS.length;
export const SEGMENT_ANGLE = 360 / SEGMENT_COUNT; // ≈ 51.43°

/* ============================================================================
   Non-near-miss weighted distributions
   ========================================================================== */

/**
 * Weights for the 75% non-near-miss spins, indexed by segment.
 * Must sum to 1.0.
 *
 * Base (Bronze / Silver / Gold): evened out to avoid over-landing on low tier / nothing.
 * Neodymium: boosted token weights, minimal "nothing".
 */
const BASE_WEIGHTS: number[] = [
  0.10, // 10 tokens (boosted from 0.06)
  0.15, // 5 tokens (boosted from 0.14)
  0.16, // map reveal (boosted from 0.14)
  0.16, // 3 tokens (reduced from 0.18)
  0.13, // flash sale (reduced from 0.14)
  0.15, // 1 token (reduced from 0.18)
  0.15, // nothing (reduced from 0.16)
];

const NEO_WEIGHTS: number[] = [
  0.16, // 10 tokens (boosted from 0.12)
  0.22, // 5 tokens (boosted from 0.20)
  0.16, // map reveal (boosted from 0.14)
  0.20, // 3 tokens (evened out)
  0.10, // flash sale (evened out)
  0.12, // 1 token (reduced from 0.18)
  0.04, // nothing (reduced from 0.06)
];

/* ============================================================================
   Pure algorithm
   ========================================================================== */

/** Pick a segment index from a weighted distribution. */
function weightedPick(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/**
 * Compute the spin result for a given tier.
 *
 * - 40% → near-miss (lands on NEAR_MISS_INDEX, adjacent to big prize).
 * - 60% → weighted pick across all segments (tier-dependent weights).
 *
 * Pure function (uses Math.random only). Does NOT mutate any store.
 */
export function computeSpinResult(tier: Tier): SpinResult {
  const r = Math.random();
  if (r < NEAR_MISS_THRESHOLD) {
    return {
      segmentIndex: NEAR_MISS_INDEX,
      segment: WHEEL_SEGMENTS[NEAR_MISS_INDEX]!,
      nearMiss: true,
    };
  }
  const weights = tier === "neodymium" ? NEO_WEIGHTS : BASE_WEIGHTS;
  const idx = weightedPick(weights);
  return {
    segmentIndex: idx,
    segment: WHEEL_SEGMENTS[idx]!,
    nearMiss: false,
  };
}

/* ============================================================================
   Reward application
   ========================================================================== */

export interface RewardOutcome {
  type: WheelPrizeType;
  tokensCredited: number;
  message: string;
  zoneName?: string;
}

/**
 * Apply the spin reward to the game state. Returns a description of what
 * happened so the UI can show a result message.
 *
 * - tokens: credited via `awardTokens` (applies tier multiplier).
 * - map-reveal: reveals a random fogged zone (or token consolation if all
 *   zones are already explored).
 * - flash-sale: triggers a deficit-priced flash sale in the economyStore.
 * - nothing: no reward.
 */
export function applySpinReward(result: SpinResult): RewardOutcome {
  const seg = result.segment;

  switch (seg.type) {
    case "tokens": {
      const credited = usePlayerStore.getState().awardTokens(seg.tokens);
      return {
        type: "tokens",
        tokensCredited: credited,
        message: credited > 0 ? `+${credited} Tokens!` : "No tokens",
      };
    }

    case "map-reveal": {
      const mapState = useMapStore.getState();
      const fogged = mapState.zones.filter((z) => !mapState.fogState[z.id]);
      if (fogged.length === 0) {
        // All zones explored — grant a token consolation prize.
        const consolation = usePlayerStore.getState().awardTokens(2);
        return {
          type: "tokens",
          tokensCredited: consolation,
          message: `All explored! +${consolation} Tokens`,
        };
      }
      const zone =
        fogged[Math.floor(Math.random() * fogged.length)]!;
      mapState.revealZone(zone.id);
      return {
        type: "map-reveal",
        tokensCredited: 0,
        message: `Map Revealed: ${zone.name}!`,
        zoneName: zone.name,
      };
    }

    case "flash-sale": {
      useEconomyStore.getState().triggerDeficitFlashSale();
      return {
        type: "flash-sale",
        tokensCredited: 0,
        message: "Flash Sale Access Granted!",
      };
    }

    case "nothing":
    default:
      return {
        type: "nothing",
        tokensCredited: 0,
        message: "Nothing this time…",
      };
  }
}

/* ============================================================================
   Rotation helpers (used by the UI component)
   ========================================================================== */

/**
 * Compute the target clockwise rotation (degrees) so that `targetIndex` ends
 * up under the fixed top pointer, adding `fullSpins` full rotations for drama.
 *
 * The result is always greater than `currentRotation` so Framer Motion
 * animates forward (never backwards).
 */
export function computeTargetRotation(
  currentRotation: number,
  targetIndex: number,
  fullSpins = 5
): number {
  // The rotation (mod 360) that brings `targetIndex` to the top pointer.
  const targetMod = (360 - targetIndex * SEGMENT_ANGLE) % 360;
  const currentMod = ((currentRotation % 360) + 360) % 360;
  const delta = (targetMod - currentMod + 360) % 360;
  return currentRotation + delta + 360 * fullSpins;
}

const nearMissAlgorithm = {
  WHEEL_SEGMENTS,
  BIG_PRIZE_INDEX,
  NEAR_MISS_INDEX,
  NEAR_MISS_THRESHOLD,
  SEGMENT_COUNT,
  SEGMENT_ANGLE,
  computeSpinResult,
  applySpinReward,
  computeTargetRotation,
};

export default nearMissAlgorithm;
