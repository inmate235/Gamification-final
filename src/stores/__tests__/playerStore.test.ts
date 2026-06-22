import { describe, it, expect, beforeEach } from "vitest";
import { usePlayerStore, TIER_MULTIPLIERS, applyTierMultiplier } from "@/stores/playerStore";
import type { Perk } from "@/types";

describe("playerStore", () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
  });

  it("initializes with zero tokens, bronze tier, and a Day-1 streak", () => {
    const s = usePlayerStore.getState();
    expect(s.tokens).toBe(0);
    expect(s.tier).toBe("bronze");
    expect(s.tierXP).toBe(0);
    expect(s.streak.count).toBe(1);
    expect(s.streak.broken).toBe(false);
    expect(s.bartleType).toBeNull();
    expect(s.surveyAnswers).toEqual({});
    expect(s.perks).toEqual([]);
    expect(s.trialPerks).toEqual([]);
  });

  it("addTokens increments the balance and tierXP", () => {
    usePlayerStore.getState().addTokens(5);
    expect(usePlayerStore.getState().tokens).toBe(5);
    expect(usePlayerStore.getState().tierXP).toBe(5);
  });

  it("addTokens floors negative amounts to zero contribution", () => {
    usePlayerStore.getState().addTokens(-10);
    expect(usePlayerStore.getState().tokens).toBe(0);
  });

  it("spendTokens returns false and no-ops when insufficient", () => {
    usePlayerStore.getState().addTokens(3);
    const ok = usePlayerStore.getState().spendTokens(10);
    expect(ok).toBe(false);
    expect(usePlayerStore.getState().tokens).toBe(3);
  });

  it("spendTokens returns true and deducts when sufficient", () => {
    usePlayerStore.getState().addTokens(10);
    const ok = usePlayerStore.getState().spendTokens(4);
    expect(ok).toBe(true);
    expect(usePlayerStore.getState().tokens).toBe(6);
  });

  it("spendTokens cannot push the balance negative", () => {
    usePlayerStore.getState().addTokens(3);
    usePlayerStore.getState().spendTokens(3);
    expect(usePlayerStore.getState().tokens).toBe(0);
  });

  it("spendTokens rejects negative amounts and does not change the balance", () => {
    usePlayerStore.getState().addTokens(10);
    const ok = usePlayerStore.getState().spendTokens(-5);
    expect(ok).toBe(false);
    expect(usePlayerStore.getState().tokens).toBe(10);
  });

  it("spendTokens rejects zero amounts", () => {
    usePlayerStore.getState().addTokens(10);
    const ok = usePlayerStore.getState().spendTokens(0);
    expect(ok).toBe(false);
    expect(usePlayerStore.getState().tokens).toBe(10);
  });

  it("spendTokens rejects non-integer amounts", () => {
    usePlayerStore.getState().addTokens(10);
    const ok = usePlayerStore.getState().spendTokens(3.5);
    expect(ok).toBe(false);
    expect(usePlayerStore.getState().tokens).toBe(10);
  });

  it("setTier updates the tier", () => {
    usePlayerStore.getState().setTier("gold");
    expect(usePlayerStore.getState().tier).toBe("gold");
  });

  it("addTierXP accumulates XP", () => {
    usePlayerStore.getState().addTierXP(7);
    usePlayerStore.getState().addTierXP(3);
    expect(usePlayerStore.getState().tierXP).toBe(10);
  });

  it("incrementStreak increases the count and clears broken/recovery flags", () => {
    usePlayerStore.getState().breakStreak();
    usePlayerStore.getState().incrementStreak();
    const s = usePlayerStore.getState();
    expect(s.streak.count).toBe(2);
    expect(s.streak.broken).toBe(false);
    expect(s.streak.recoveryWindow).toBe(false);
  });

  it("breakStreak sets the broken flag", () => {
    usePlayerStore.getState().breakStreak();
    expect(usePlayerStore.getState().streak.broken).toBe(true);
  });

  it("activateRecovery sets the recovery window and clears broken", () => {
    usePlayerStore.getState().breakStreak();
    usePlayerStore.getState().activateRecovery();
    const s = usePlayerStore.getState();
    expect(s.streak.recoveryWindow).toBe(true);
    expect(s.streak.broken).toBe(false);
  });

  it("addPerk appends a new earned perk to perks and ignores duplicates by id", () => {
    const perk: Perk = {
      id: "perk-1",
      name: "Deal Radar",
      description: "See deals nearby",
      type: "earned",
      expiresAt: Date.now() + 10000,
    };
    usePlayerStore.getState().addPerk(perk);
    usePlayerStore.getState().addPerk(perk);
    expect(usePlayerStore.getState().perks).toHaveLength(1);
  });

  it("addPerk routes trial perks to trialPerks", () => {
    const perk: Perk = {
      id: "trial-x",
      name: "Trial Boost",
      description: "Temporary",
      type: "trial",
      expiresAt: Date.now() + 10000,
    };
    usePlayerStore.getState().addPerk(perk);
    expect(usePlayerStore.getState().trialPerks).toHaveLength(1);
    expect(usePlayerStore.getState().perks).toHaveLength(0);
  });

  it("removePerk removes a perk by id", () => {
    const perk: Perk = {
      id: "perk-2",
      name: "Bonus Wheel",
      description: "Extra spin",
      type: "gifted",
    };
    usePlayerStore.getState().addPerk(perk);
    usePlayerStore.getState().removePerk("perk-2");
    expect(usePlayerStore.getState().perks).toHaveLength(0);
  });

  it("expireTrialPerks removes expired trial perks but keeps permanent ones", () => {
    const expired: Perk = {
      id: "trial-1",
      name: "Expired",
      description: "Gone",
      type: "trial",
      expiresAt: Date.now() - 1000,
    };
    const permanent: Perk = {
      id: "trial-2",
      name: "Permanent",
      description: "Stays",
      type: "trial",
    };
    usePlayerStore.getState().addPerk(expired);
    usePlayerStore.getState().addPerk(permanent);
    usePlayerStore.getState().expireTrialPerks();
    const trialPerks = usePlayerStore.getState().trialPerks;
    expect(trialPerks.find((p) => p.id === "trial-1")).toBeUndefined();
    expect(trialPerks.find((p) => p.id === "trial-2")).toBeDefined();
  });

  it("setBartleType and setSurveyAnswers update the store", () => {
    usePlayerStore.getState().setBartleType("achiever");
    usePlayerStore.getState().setSurveyAnswers({ q1: "a", q2: "b" });
    const s = usePlayerStore.getState();
    expect(s.bartleType).toBe("achiever");
    expect(s.surveyAnswers).toEqual({ q1: "a", q2: "b" });
  });

  it("tier multipliers match the spec (1, 1.5, 2, 3)", () => {
    expect(TIER_MULTIPLIERS.bronze).toBe(1);
    expect(TIER_MULTIPLIERS.silver).toBe(1.5);
    expect(TIER_MULTIPLIERS.gold).toBe(2);
    expect(TIER_MULTIPLIERS.neodymium).toBe(3);
  });

  it("applyTierMultiplier rounds and floors correctly", () => {
    expect(applyTierMultiplier(3, "bronze")).toBe(3);
    expect(applyTierMultiplier(3, "silver")).toBe(5); // 4.5 -> 5
    expect(applyTierMultiplier(3, "gold")).toBe(6);
    expect(applyTierMultiplier(3, "neodymium")).toBe(9);
    expect(applyTierMultiplier(-2, "gold")).toBe(0);
  });
});
