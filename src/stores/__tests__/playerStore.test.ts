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

  it("breakStreak records the pre-break count (VAL-STREAK-013)", () => {
    usePlayerStore.setState((state) => ({
      streak: { ...state.streak, count: 7 },
    }));
    usePlayerStore.getState().breakStreak();
    expect(usePlayerStore.getState().streak.preBreakCount).toBe(7);
  });

  it("activateRecovery sets the recovery window and clears broken", () => {
    usePlayerStore.getState().breakStreak();
    usePlayerStore.getState().activateRecovery();
    const s = usePlayerStore.getState();
    expect(s.streak.recoveryWindow).toBe(true);
    expect(s.streak.broken).toBe(false);
    expect(s.streak.recoveryWindowStart).toBeGreaterThan(0);
  });

  it("setRecoveryWindowStart sets the timestamp and activates the window", () => {
    const ts = Date.now();
    usePlayerStore.getState().setRecoveryWindowStart(ts);
    expect(usePlayerStore.getState().streak.recoveryWindow).toBe(true);
    expect(usePlayerStore.getState().streak.recoveryWindowStart).toBe(ts);
  });

  it("closeRecoveryWindow clears the window and timestamp", () => {
    usePlayerStore.getState().setRecoveryWindowStart(Date.now());
    usePlayerStore.getState().closeRecoveryWindow();
    expect(usePlayerStore.getState().streak.recoveryWindow).toBe(false);
    expect(usePlayerStore.getState().streak.recoveryWindowStart).toBe(0);
  });

  it("restoreStreakPartial restores count minus 2 (VAL-STREAK-013)", () => {
    usePlayerStore.setState((state) => ({
      streak: { ...state.streak, preBreakCount: 10 },
    }));
    usePlayerStore.getState().restoreStreakPartial();
    const s = usePlayerStore.getState();
    expect(s.streak.count).toBe(8); // 10 - 2 = 8
    expect(s.streak.broken).toBe(false);
    expect(s.streak.recoveryWindow).toBe(false);
    expect(s.streak.missedDays).toBe(0);
    expect(s.streak.preBreakCount).toBe(0);
  });

  it("restoreStreakPartial floors at Day 1 when pre-break count <= 2", () => {
    usePlayerStore.setState((state) => ({
      streak: { ...state.streak, preBreakCount: 1 },
    }));
    usePlayerStore.getState().restoreStreakPartial();
    expect(usePlayerStore.getState().streak.count).toBe(1);
  });

  it("activateComebackBonus sets active bonus with expiry (VAL-STREAK-012)", () => {
    const expiresAt = Date.now() + 30 * 60 * 1000;
    usePlayerStore.getState().activateComebackBonus(expiresAt);
    const bonus = usePlayerStore.getState().streak.comebackBonus;
    expect(bonus).not.toBeNull();
    expect(bonus!.active).toBe(true);
    expect(bonus!.expiresAt).toBe(expiresAt);
  });

  it("clearComebackBonus removes the bonus", () => {
    usePlayerStore.getState().activateComebackBonus(Date.now() + 60000);
    usePlayerStore.getState().clearComebackBonus();
    expect(usePlayerStore.getState().streak.comebackBonus).toBeNull();
  });

  it("awardTokens applies 2x comeback bonus on top of tier multiplier (VAL-STREAK-012)", () => {
    usePlayerStore.getState().setTier("silver"); // 1.5x
    usePlayerStore.getState().activateComebackBonus(Date.now() + 60000);
    // Base 4, silver 1.5x = 6, comeback 2x = 12
    const credited = usePlayerStore.getState().awardTokens(4);
    expect(credited).toBe(12);
  });

  it("awardTokens does not apply comeback 2x when not active (VAL-STREAK-018)", () => {
    usePlayerStore.getState().setTier("bronze"); // 1x
    const credited = usePlayerStore.getState().awardTokens(5);
    expect(credited).toBe(5);
  });

  it("registerMissedDay demotes tier at Day 3 (VAL-STREAK-007)", () => {
    usePlayerStore.getState().setTier("gold");
    usePlayerStore.getState().registerMissedDay();
    usePlayerStore.getState().registerMissedDay();
    usePlayerStore.getState().registerMissedDay();
    expect(usePlayerStore.getState().tier).toBe("silver");
    expect(usePlayerStore.getState().streak.missedDays).toBe(3);
  });

  it("streak count is always a positive integer (VAL-STREAK-020)", () => {
    const count = usePlayerStore.getState().streak.count;
    expect(Number.isInteger(count)).toBe(true);
    expect(count).toBeGreaterThan(0);
  });

  it("initial streak has recoveryWindowStart=0 and comebackBonus=null", () => {
    const s = usePlayerStore.getState().streak;
    expect(s.recoveryWindowStart).toBe(0);
    expect(s.comebackBonus).toBeNull();
    expect(s.preBreakCount).toBe(0);
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

  describe("awardTokens (tier-multiplied earning)", () => {
    it("credits base reward at bronze 1x and returns the credited amount", () => {
      const credited = usePlayerStore.getState().awardTokens(3);
      expect(credited).toBe(3);
      expect(usePlayerStore.getState().tokens).toBe(3);
      expect(usePlayerStore.getState().tierXP).toBe(3);
    });

    it("credits silver at 1.5x (3 -> 5)", () => {
      usePlayerStore.getState().setTier("silver");
      expect(usePlayerStore.getState().awardTokens(3)).toBe(5);
      expect(usePlayerStore.getState().tokens).toBe(5);
    });

    it("credits gold at 2x (3 -> 6)", () => {
      usePlayerStore.getState().setTier("gold");
      expect(usePlayerStore.getState().awardTokens(3)).toBe(6);
      expect(usePlayerStore.getState().tokens).toBe(6);
    });

    it("credits neodymium at 3x (3 -> 9)", () => {
      usePlayerStore.getState().setTier("neodymium");
      expect(usePlayerStore.getState().awardTokens(3)).toBe(9);
      expect(usePlayerStore.getState().tokens).toBe(9);
    });

    it("never produces a negative balance even for negative base", () => {
      usePlayerStore.getState().awardTokens(-5);
      expect(usePlayerStore.getState().tokens).toBe(0);
    });

    it("accumulates across multiple awards", () => {
      usePlayerStore.getState().awardTokens(2);
      usePlayerStore.getState().awardTokens(3);
      expect(usePlayerStore.getState().tokens).toBe(5);
    });
  });
});
