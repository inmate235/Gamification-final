import { describe, it, expect, beforeEach } from "vitest";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";
import {
  tierIndex,
  nextTierOf,
  previousTierOf,
  tierForScore,
  computeTierProgressScore,
  getTierHint,
  flashSaleFrequencyForTier,
  demoteTierByOne,
  checkForTierUpgrade,
} from "@/engine/tierEngine";
import {
  TIER_THRESHOLDS,
  TIER_FLASH_SALE_FREQ,
  TIER_TOKEN_MULTIPLIER,
  buildTrialPerks,
  TRIAL_PERK_DURATION_MS,
  TRIAL_PERK_WARNING_MS,
} from "@/data/tierData";
import type { Tier } from "@/types";

describe("tierEngine — pure helpers", () => {
  it("TIER_ORDER indexing", () => {
    expect(tierIndex("bronze")).toBe(0);
    expect(tierIndex("silver")).toBe(1);
    expect(tierIndex("gold")).toBe(2);
    expect(tierIndex("neodymium")).toBe(3);
  });

  it("nextTierOf returns the tier above, null at top", () => {
    expect(nextTierOf("bronze")).toBe("silver");
    expect(nextTierOf("silver")).toBe("gold");
    expect(nextTierOf("gold")).toBe("neodymium");
    expect(nextTierOf("neodymium")).toBeNull();
  });

  it("previousTierOf returns the tier below, null at bottom", () => {
    expect(previousTierOf("neodymium")).toBe("gold");
    expect(previousTierOf("gold")).toBe("silver");
    expect(previousTierOf("silver")).toBe("bronze");
    expect(previousTierOf("bronze")).toBeNull();
  });

  it("tierForScore returns the highest tier whose threshold is met", () => {
    expect(tierForScore(0)).toBe("bronze");
    expect(tierForScore(11)).toBe("bronze");
    expect(tierForScore(12)).toBe("silver");
    expect(tierForScore(47)).toBe("silver");
    expect(tierForScore(48)).toBe("gold");
    expect(tierForScore(407)).toBe("gold");
    expect(tierForScore(408)).toBe("neodymium");
    expect(tierForScore(1000)).toBe("neodymium");
  });

  it("computeTierProgressScore combines tierXP and exploration", () => {
    expect(computeTierProgressScore(10, 5)).toBe(15);
    expect(computeTierProgressScore(0, 0)).toBe(0);
    expect(computeTierProgressScore(7, 2.4)).toBe(9); // exploration rounded
  });
});

describe("tierEngine — non-linear thresholds (VAL-TIER-018..020)", () => {
  const bronzeToSilver = TIER_THRESHOLDS.silver - TIER_THRESHOLDS.bronze;
  const silverToGold = TIER_THRESHOLDS.gold - TIER_THRESHOLDS.silver;
  const goldToNeodymium = TIER_THRESHOLDS.neodymium - TIER_THRESHOLDS.gold;

  it("Bronze -> Silver is the smallest jump", () => {
    expect(bronzeToSilver).toBeLessThan(silverToGold);
    expect(bronzeToSilver).toBeLessThan(goldToNeodymium);
  });

  it("Silver -> Gold is at least 3x Bronze -> Silver (VAL-TIER-019)", () => {
    expect(silverToGold).toBeGreaterThanOrEqual(3 * bronzeToSilver);
  });

  it("Gold -> Neodymium is at least 10x Silver -> Gold (VAL-TIER-020)", () => {
    expect(goldToNeodymium).toBeGreaterThanOrEqual(10 * silverToGold);
  });
});

describe("tierEngine — perks config (VAL-TIER-010, -011, -026)", () => {
  it("flash sale frequency matches the spec per tier", () => {
    expect(TIER_FLASH_SALE_FREQ.bronze).toBe(1);
    expect(TIER_FLASH_SALE_FREQ.silver).toBe(2);
    expect(TIER_FLASH_SALE_FREQ.gold).toBe(3);
    expect(TIER_FLASH_SALE_FREQ.neodymium).toBe(Infinity);
  });

  it("token multiplier matches the spec per tier", () => {
    expect(TIER_TOKEN_MULTIPLIER.bronze).toBe(1);
    expect(TIER_TOKEN_MULTIPLIER.silver).toBe(1.5);
    expect(TIER_TOKEN_MULTIPLIER.gold).toBe(2);
    expect(TIER_TOKEN_MULTIPLIER.neodymium).toBe(3);
  });

  it("flashSaleFrequencyForTier mirrors the config", () => {
    expect(flashSaleFrequencyForTier("bronze")).toBe(1);
    expect(flashSaleFrequencyForTier("neodymium")).toBe(Infinity);
  });
});

describe("tierEngine — aspiration hint (VAL-TIER-028)", () => {
  it("returns a hint referencing the next tier and remaining cost", () => {
    const hint = getTierHint("bronze", 5);
    expect(hint).not.toBeNull();
    expect(hint!.nextTier).toBe("silver");
    expect(hint!.remaining).toBe(TIER_THRESHOLDS.silver - 5);
    expect(hint!.message).toContain("Silver");
    expect(hint!.message).toContain(`${hint!.remaining} more`);
    expect(hint!.nextMultiplier).toBe(1.5);
  });

  it("returns null at the top tier", () => {
    expect(getTierHint("neodymium", 1000)).toBeNull();
  });

  it("remaining clamps to zero when the threshold is met", () => {
    const hint = getTierHint("bronze", TIER_THRESHOLDS.silver + 1);
    expect(hint!.remaining).toBe(0);
  });
});

describe("tierEngine — demotion (VAL-TIER-022)", () => {
  it("demoteTierByOne drops one level and stops at bronze", () => {
    expect(demoteTierByOne("neodymium")).toBe("gold");
    expect(demoteTierByOne("gold")).toBe("silver");
    expect(demoteTierByOne("silver")).toBe("bronze");
    expect(demoteTierByOne("bronze")).toBe("bronze");
  });
});

describe("tierEngine — checkForTierUpgrade orchestrator", () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
    useUIStore.getState().reset();
  });

  it("promotes when the combined score crosses the next threshold", () => {
    usePlayerStore.getState().addTierXP(12); // silver threshold
    // exploration starts at the entrance-only value (non-zero). Force a known
    // exploration percent so the score deterministically crosses silver.
    useMapStore.getState().setExplorationPercent(0);
    // Recompute: tierXP=12 + exploration=0 = 12 -> silver
    const promoted = checkForTierUpgrade();
    expect(promoted).toBe("silver");
    expect(usePlayerStore.getState().tier).toBe("silver");
    expect(useUIStore.getState().activeOverlay).toBe("tier-upgrade");
  });

  it("does not promote when the threshold is not met", () => {
    usePlayerStore.getState().addTierXP(5);
    useMapStore.getState().setExplorationPercent(0);
    expect(checkForTierUpgrade()).toBeNull();
    expect(usePlayerStore.getState().tier).toBe("bronze");
  });

  it("does not re-promote when already at the earned tier", () => {
    usePlayerStore.getState().setTier("silver");
    usePlayerStore.getState().addTierXP(12);
    useMapStore.getState().setExplorationPercent(0);
    expect(checkForTierUpgrade()).toBeNull();
  });

  it("collapses multiple promotions to the highest eligible tier", () => {
    usePlayerStore.getState().addTierXP(48);
    useMapStore.getState().setExplorationPercent(0);
    const promoted = checkForTierUpgrade();
    expect(promoted).toBe("gold");
    expect(usePlayerStore.getState().tier).toBe("gold");
  });
});

describe("playerStore — tier demotion + missed days (VAL-TIER-021, -022)", () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
  });

  it("demoteTier drops one level and stops at bronze", () => {
    usePlayerStore.getState().setTier("gold");
    expect(usePlayerStore.getState().demoteTier()).toBe("silver");
    expect(usePlayerStore.getState().demoteTier()).toBe("bronze");
    expect(usePlayerStore.getState().demoteTier()).toBe("bronze");
    expect(usePlayerStore.getState().tier).toBe("bronze");
  });

  it("registerMissedDay increments missedDays and marks the streak broken", () => {
    const d1 = usePlayerStore.getState().registerMissedDay();
    expect(d1).toBe(1);
    expect(usePlayerStore.getState().streak.missedDays).toBe(1);
    expect(usePlayerStore.getState().streak.broken).toBe(true);
  });

  it("demotes the tier after 3 missed days (VAL-TIER-022)", () => {
    usePlayerStore.getState().setTier("gold");
    usePlayerStore.getState().registerMissedDay(); // day 1
    expect(usePlayerStore.getState().tier).toBe("gold");
    usePlayerStore.getState().registerMissedDay(); // day 2
    expect(usePlayerStore.getState().tier).toBe("gold");
    usePlayerStore.getState().registerMissedDay(); // day 3 -> demote
    expect(usePlayerStore.getState().tier).toBe("silver");
  });
});

describe("playerStore — trial perks (VAL-TIER-013..016)", () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
  });

  it("grantOnboardingTrialPerks adds trial perks with a future expiry", () => {
    const before = Date.now();
    usePlayerStore.getState().grantOnboardingTrialPerks();
    const trialPerks = usePlayerStore.getState().trialPerks;
    expect(trialPerks.length).toBeGreaterThan(0);
    for (const perk of trialPerks) {
      expect(perk.type).toBe("trial");
      expect(perk.expiresAt).toBeGreaterThan(before);
    }
  });

  it("grantOnboardingTrialPerks is idempotent (no duplicates)", () => {
    usePlayerStore.getState().grantOnboardingTrialPerks();
    const firstCount = usePlayerStore.getState().trialPerks.length;
    usePlayerStore.getState().grantOnboardingTrialPerks();
    expect(usePlayerStore.getState().trialPerks.length).toBe(firstCount);
  });

  it("expireTrialPerks removes expired perks and returns them", () => {
    usePlayerStore.getState().grantOnboardingTrialPerks();
    // Fast-forward past the expiry so all trial perks are now expired.
    const future = Date.now() + TRIAL_PERK_DURATION_MS + 1;
    const expired = usePlayerStore.getState().expireTrialPerks(future);
    expect(expired.length).toBeGreaterThan(0);
    expect(usePlayerStore.getState().trialPerks).toHaveLength(0);
  });

  it("buildTrialPerks sets expiry TRIAL_PERK_DURATION_MS ahead", () => {
    const now = Date.now();
    const perks = buildTrialPerks(now);
    for (const perk of perks) {
      expect(perk.expiresAt).toBe(now + TRIAL_PERK_DURATION_MS);
    }
  });

  it("TRIAL_PERK_WARNING_MS is shorter than the full duration", () => {
    expect(TRIAL_PERK_WARNING_MS).toBeLessThan(TRIAL_PERK_DURATION_MS);
  });
});

describe("playerStore — tier multiplier earning (VAL-TIER-017)", () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
  });

  const base = 4;
  const cases: Array<[Tier, number]> = [
    ["bronze", 4],
    ["silver", 6], // 4 * 1.5 = 6
    ["gold", 8],
    ["neodymium", 12],
  ];

  for (const [tier, expected] of cases) {
    it(`credits ${expected} for a base ${base} reward at ${tier}`, () => {
      usePlayerStore.getState().setTier(tier);
      const credited = usePlayerStore.getState().awardTokens(base);
      expect(credited).toBe(expected);
      expect(usePlayerStore.getState().tokens).toBe(expected);
      // tierXP accumulates the credited amount (drives tier progression)
      expect(usePlayerStore.getState().tierXP).toBe(expected);
    });
  }
});
