/**
 * tierEngine - the multi-tier membership progression system.
 *
 * Tier progression is driven by a combined `tierProgressScore` derived from
 * cumulative tokens earned (playerStore.tierXP) plus exploration progress
 * (mapStore.explorationPercent). Both must grow to advance — earning alone or
 * exploring alone is not enough to cross thresholds quickly (VAL-TIER-005).
 *
 * Thresholds are non-linear (VAL-TIER-018..020):
 *   Bronze -> Silver : smallest jump (fast hook)
 *   Silver -> Gold   : 3x the Bronze->Silver cost
 *   Gold   -> Neodymium : 10x the Silver->Gold cost
 *
 * The engine exposes pure helpers + a `checkForTierUpgrade` orchestrator that
 * reads the live stores, promotes the player if a threshold is crossed, and
 * triggers the tier-upgrade celebration overlay.
 */

import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";
import {
  TIER_ORDER,
  TIER_THRESHOLDS,
  TIER_VISUALS,
  TIER_FLASH_SALE_FREQ,
} from "@/data/tierData";
import type { Tier } from "@/types";

/* ============================================================================
   Pure helpers
   ========================================================================== */

/** Returns the index of a tier in TIER_ORDER (0 = bronze). */
export function tierIndex(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

/** Returns the tier one level above `tier`, or `tier` if already top. */
export function nextTierOf(tier: Tier): Tier | null {
  const idx = tierIndex(tier);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1]!;
}

/** Returns the tier one level below `tier`, or `tier` if already bottom. */
export function previousTierOf(tier: Tier): Tier | null {
  const idx = tierIndex(tier);
  if (idx <= 0) return null;
  return TIER_ORDER[idx - 1]!;
}

/**
 * Given a combined tierProgressScore, return the highest tier whose threshold
 * is <= the score.
 */
export function tierForScore(score: number): Tier {
  let result: Tier = "bronze";
  for (const tier of TIER_ORDER) {
    if (score >= TIER_THRESHOLDS[tier]) {
      result = tier;
    }
  }
  return result;
}

/**
 * Combined progression score = cumulative earned tokens (tierXP) + exploration
 * percent. Both components contribute so advancing requires earning AND
 * exploring (VAL-TIER-005).
 */
export function computeTierProgressScore(
  tierXP: number,
  explorationPercent: number
): number {
  return tierXP + Math.max(0, Math.round(explorationPercent));
}

/* ============================================================================
   Aspiration hint (VAL-TIER-028)
   ========================================================================== */

export interface TierHint {
  /** The next tier the player is progressing toward. */
  nextTier: Tier;
  /** Combined score still needed to reach the next tier. */
  remaining: number;
  /** Human-readable hint message. */
  message: string;
  /** The earn-rate multiplier the next tier grants (aspiration copy). */
  nextMultiplier: number;
}

/**
 * Compute the aspiration hint for the player's current position. Returns null
 * when the player is already at the top tier (Neodymium).
 */
export function getTierHint(
  currentTier: Tier,
  score: number
): TierHint | null {
  const next = nextTierOf(currentTier);
  if (!next) return null;
  const threshold = TIER_THRESHOLDS[next];
  const remaining = Math.max(0, threshold - score);
  const visual = TIER_VISUALS[next];
  const multiplier =
    next === "silver" ? 1.5 : next === "gold" ? 2 : next === "neodymium" ? 3 : 1;
  return {
    nextTier: next,
    remaining,
    message: `${remaining} more to ${visual.label}! ${visual.label} members earn ${multiplier}x tokens`,
    nextMultiplier: multiplier,
  };
}

/* ============================================================================
   Flash sale frequency cap (VAL-TIER-010)
   ========================================================================== */

/** Returns the per-hour flash sale cap for a tier (Infinity for Neodymium). */
export function flashSaleFrequencyForTier(tier: Tier): number {
  return TIER_FLASH_SALE_FREQ[tier];
}

/* ============================================================================
   Demotion (VAL-TIER-021, VAL-TIER-022, VAL-TIER-024)
   ========================================================================== */

/**
 * Demote a tier by one level. Returns the demoted tier (or the same tier if
 * already Bronze). Pure helper — the store action `demoteTier` applies it.
 */
export function demoteTierByOne(tier: Tier): Tier {
  const prev = previousTierOf(tier);
  return prev ?? tier;
}

/* ============================================================================
   Orchestrator: detect + apply tier upgrades
   ========================================================================== */

/**
 * Read the live stores and, if the combined progression score has crossed the
 * threshold for a higher tier than the player currently holds, promote the
 * player and trigger the tier-upgrade celebration overlay.
 *
 * Returns the new tier if a promotion occurred, otherwise null. Multiple
 * promotions in a single call are collapsed to the highest eligible tier and
 * a single celebration for that tier (the user sees the destination).
 */
export function checkForTierUpgrade(): Tier | null {
  const player = usePlayerStore.getState();
  const map = useMapStore.getState();
  const score = computeTierProgressScore(player.tierXP, map.explorationPercent);
  const earned = tierForScore(score);

  if (tierIndex(earned) <= tierIndex(player.tier)) return null;

  // Promote the player to the earned tier.
  usePlayerStore.getState().setTier(earned);

  // Trigger the full-screen tier-upgrade celebration (VAL-TIER-006..008).
  useUIStore.getState().showOverlay("tier-upgrade", {
    newTier: earned,
    previousTier: player.tier,
  });

  return earned;
}

const tierEngine = {
  tierIndex,
  nextTierOf,
  previousTierOf,
  tierForScore,
  computeTierProgressScore,
  getTierHint,
  flashSaleFrequencyForTier,
  demoteTierByOne,
  checkForTierUpgrade,
};

export default tierEngine;
