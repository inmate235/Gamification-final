import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  MS_PER_DAY,
  RECOVERY_WINDOW_MS,
  COMEBACK_BONUS_DURATION_MS,
  daysBetween,
  computeDay1Penalty,
  getRecoveryCountdownMs,
  formatRecoveryCountdown,
  isComebackBonusActive,
  checkStreakOnVisit,
  simulateMissedDay,
  checkRecoveryWindowExpiry,
  checkComebackBonusExpiry,
  getStreakExitStatus,
  getStreakAnxietyMessage,
} from "@/engine/streakEngine";
import { usePlayerStore } from "@/stores/playerStore";
import { useUIStore } from "@/stores/uiStore";
import type { Perk } from "@/types";

describe("engine/streakEngine", () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
    useUIStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /* --- Pure helpers --- */

  describe("daysBetween", () => {
    it("returns 0 for same-day timestamps", () => {
      const now = Date.now();
      expect(daysBetween(now, now)).toBe(0);
    });

    it("returns 1 for exactly one day apart", () => {
      const earlier = Date.now();
      const later = earlier + MS_PER_DAY;
      expect(daysBetween(earlier, later)).toBe(1);
    });

    it("returns 2 for two days apart", () => {
      const earlier = Date.now();
      const later = earlier + 2 * MS_PER_DAY;
      expect(daysBetween(earlier, later)).toBe(2);
    });

    it("returns 0 when earlier is 0 (uninitialized)", () => {
      expect(daysBetween(0, Date.now())).toBe(0);
    });
  });

  describe("computeDay1Penalty", () => {
    it("returns 10% of tierXP floored, minimum 1", () => {
      expect(computeDay1Penalty(0)).toBe(1); // minimum
      expect(computeDay1Penalty(10)).toBe(1); // 10% of 10 = 1
      expect(computeDay1Penalty(100)).toBe(10); // 10% of 100 = 10
      expect(computeDay1Penalty(50)).toBe(5); // 10% of 50 = 5
    });
  });

  describe("getRecoveryCountdownMs", () => {
    it("returns 0 when recovery window is not active", () => {
      const streak = usePlayerStore.getState().streak;
      expect(getRecoveryCountdownMs(streak)).toBe(0);
    });

    it("returns full 48h when window just opened", () => {
      const now = Date.now();
      usePlayerStore.getState().setRecoveryWindowStart(now);
      const streak = usePlayerStore.getState().streak;
      const remaining = getRecoveryCountdownMs(streak, now);
      expect(remaining).toBe(RECOVERY_WINDOW_MS);
    });

    it("decreases as time passes", () => {
      const start = Date.now();
      usePlayerStore.getState().setRecoveryWindowStart(start);
      const streak = usePlayerStore.getState().streak;
      const later = start + 10 * 60 * 1000; // 10 min later
      const remaining = getRecoveryCountdownMs(streak, later);
      expect(remaining).toBe(RECOVERY_WINDOW_MS - 10 * 60 * 1000);
    });

    it("returns 0 after 48h have passed", () => {
      const start = Date.now();
      usePlayerStore.getState().setRecoveryWindowStart(start);
      const streak = usePlayerStore.getState().streak;
      const later = start + RECOVERY_WINDOW_MS + 1000;
      expect(getRecoveryCountdownMs(streak, later)).toBe(0);
    });
  });

  describe("formatRecoveryCountdown", () => {
    it("returns 'Expired' when no window active", () => {
      const streak = usePlayerStore.getState().streak;
      expect(formatRecoveryCountdown(streak)).toBe("Expired");
    });

    it("returns hours and minutes format", () => {
      const now = Date.now();
      usePlayerStore.getState().setRecoveryWindowStart(now);
      const streak = usePlayerStore.getState().streak;
      const text = formatRecoveryCountdown(streak, now);
      expect(text).toMatch(/\d+h \d+m left/);
    });
  });

  describe("isComebackBonusActive", () => {
    it("returns false when no comeback bonus set", () => {
      const streak = usePlayerStore.getState().streak;
      expect(isComebackBonusActive(streak)).toBe(false);
    });

    it("returns true when active and not expired", () => {
      const now = Date.now();
      usePlayerStore.getState().activateComebackBonus(now + COMEBACK_BONUS_DURATION_MS);
      const streak = usePlayerStore.getState().streak;
      expect(isComebackBonusActive(streak, now)).toBe(true);
    });

    it("returns false when expired", () => {
      const now = Date.now();
      usePlayerStore.getState().activateComebackBonus(now - 1000);
      const streak = usePlayerStore.getState().streak;
      expect(isComebackBonusActive(streak, now)).toBe(false);
    });
  });

  /* --- checkStreakOnVisit --- */

  describe("checkStreakOnVisit", () => {
    it("returns incremented on first visit (lastVisit=0) so the streak celebration fires", () => {
      const result = checkStreakOnVisit(Date.now());
      expect(result.type).toBe("incremented");
      expect(usePlayerStore.getState().streak.lastVisit).toBeGreaterThan(0);
    });

    it("returns same-day when visiting again on the same day", () => {
      const now = Date.now();
      // Set lastVisit to now
      usePlayerStore.setState((state) => ({
        streak: { ...state.streak, lastVisit: now },
      }));
      const result = checkStreakOnVisit(now + 1000); // 1 second later
      expect(result.type).toBe("same-day");
      expect(usePlayerStore.getState().streak.count).toBe(1);
    });

    it("increments streak on next-day visit (VAL-STREAK-004)", () => {
      const now = Date.now();
      usePlayerStore.setState((state) => ({
        streak: { ...state.streak, lastVisit: now, count: 1 },
      }));
      const result = checkStreakOnVisit(now + MS_PER_DAY);
      expect(result.type).toBe("incremented");
      if (result.type === "incremented") {
        expect(result.newCount).toBe(2);
      }
      expect(usePlayerStore.getState().streak.count).toBe(2);
      expect(usePlayerStore.getState().streak.broken).toBe(false);
      expect(usePlayerStore.getState().streak.missedDays).toBe(0);
    });

    it("resets to Day 1 when >1 day passed and no recovery window (VAL-STREAK-017)", () => {
      const now = Date.now();
      usePlayerStore.setState((state) => ({
        streak: {
          ...state.streak,
          lastVisit: now,
          count: 5,
        },
      }));
      const result = checkStreakOnVisit(now + 3 * MS_PER_DAY);
      expect(result.type).toBe("full-reset");
      if (result.type === "full-reset") {
        expect(result.comebackBonus).toBe(false);
      }
      expect(usePlayerStore.getState().streak.count).toBe(1);
    });

    it("recovers with partial restoration when within 48h window (VAL-STREAK-013)", () => {
      const now = Date.now();
      // Set up a broken streak with recovery window active.
      // lastVisit is 2 days ago (days = 2, > 1 day), but recoveryWindowStart
      // is only 1 day ago (within the 48h window, remaining = 24h > 0).
      usePlayerStore.setState((state) => ({
        streak: {
          ...state.streak,
          count: 5,
          lastVisit: now - 2 * MS_PER_DAY,
          broken: true,
          recoveryWindow: true,
          recoveryWindowStart: now - MS_PER_DAY,
          preBreakCount: 5,
          missedDays: 1,
        },
      }));
      const result = checkStreakOnVisit(now);
      expect(result.type).toBe("recovered");
      if (result.type === "recovered") {
        expect(result.comebackBonus).toBe(true);
        // Partial restoration: 5 - 2 = 3
        expect(result.newCount).toBe(3);
      }
      expect(usePlayerStore.getState().streak.count).toBe(3);
      expect(usePlayerStore.getState().streak.broken).toBe(false);
      expect(usePlayerStore.getState().streak.recoveryWindow).toBe(false);
    });

    it("activates comeback bonus on recovery return (VAL-STREAK-012)", () => {
      const now = Date.now();
      usePlayerStore.setState((state) => ({
        streak: {
          ...state.streak,
          count: 10,
          lastVisit: now - MS_PER_DAY - 1000,
          broken: true,
          recoveryWindow: true,
          recoveryWindowStart: now - MS_PER_DAY - 1000,
          preBreakCount: 10,
          missedDays: 1,
        },
      }));
      checkStreakOnVisit(now);
      const streak = usePlayerStore.getState().streak;
      expect(streak.comebackBonus).not.toBeNull();
      expect(streak.comebackBonus!.active).toBe(true);
      expect(streak.comebackBonus!.expiresAt).toBe(now + COMEBACK_BONUS_DURATION_MS);
    });

    it("does not activate comeback bonus on normal consecutive-day visit (VAL-STREAK-018)", () => {
      const now = Date.now();
      usePlayerStore.setState((state) => ({
        streak: { ...state.streak, lastVisit: now, count: 3 },
      }));
      const result = checkStreakOnVisit(now + MS_PER_DAY);
      expect(result.type).toBe("incremented");
      expect(usePlayerStore.getState().streak.comebackBonus).toBeNull();
    });

    it("floors partial restoration at Day 1 when pre-break count <= 2", () => {
      const now = Date.now();
      usePlayerStore.setState((state) => ({
        streak: {
          ...state.streak,
          count: 2,
          lastVisit: now - MS_PER_DAY - 1000,
          broken: true,
          recoveryWindow: true,
          recoveryWindowStart: now - MS_PER_DAY - 1000,
          preBreakCount: 2,
          missedDays: 1,
        },
      }));
      checkStreakOnVisit(now);
      // 2 - 2 = 0, floored to 1
      expect(usePlayerStore.getState().streak.count).toBe(1);
    });
  });

  /* --- simulateMissedDay --- */

  describe("simulateMissedDay", () => {
    it("Day 1 miss: sets broken flag and opens recovery window (VAL-STREAK-010, -016)", () => {
      const now = Date.now();
      usePlayerStore.getState().addTokens(100);
      const result = simulateMissedDay(now);
      const streak = usePlayerStore.getState().streak;

      expect(result.type).toBe("token-loss");
      expect(result.missedDay).toBe(1);
      expect(streak.broken).toBe(true);
      expect(streak.missedDays).toBe(1);
      expect(streak.recoveryWindow).toBe(true);
      expect(streak.recoveryWindowStart).toBe(now);
      expect(streak.preBreakCount).toBe(1); // initial count was 1
    });

    it("Day 1 miss: deducts token penalty (VAL-STREAK-005)", () => {
      const now = Date.now();
      usePlayerStore.getState().addTokens(100);
      // tierXP is now 100, so penalty = floor(100 * 0.10) = 10
      const result = simulateMissedDay(now);
      expect(result.type).toBe("token-loss");
      expect(result.tokensLost).toBe(10);
      expect(usePlayerStore.getState().tokens).toBe(90);
    });

    it("Day 2 miss: removes a perk (VAL-STREAK-006)", () => {
      const now = Date.now();
      // Add a perk so Day 2 can remove it
      const perk: Perk = {
        id: "perk-test",
        name: "Test Perk",
        description: "A test perk",
        type: "earned",
      };
      usePlayerStore.getState().addPerk(perk);

      // Day 1 miss
      simulateMissedDay(now);
      // Day 2 miss
      const result = simulateMissedDay(now + 1000);
      expect(result.type).toBe("perk-loss");
      expect(result.missedDay).toBe(2);
      expect(result.perkLostName).toBe("Test Perk");
      expect(usePlayerStore.getState().perks).toHaveLength(0);
    });

    it("Day 2 miss: removes trial perk when no earned perks (VAL-STREAK-006)", () => {
      const now = Date.now();
      const trialPerk: Perk = {
        id: "trial-test",
        name: "Trial Perk",
        description: "A trial perk",
        type: "trial",
        expiresAt: now + 60000,
      };
      usePlayerStore.getState().addPerk(trialPerk);

      simulateMissedDay(now);
      const result = simulateMissedDay(now + 1000);
      expect(result.type).toBe("perk-loss");
      expect(result.perkLostName).toBe("Trial Perk");
      expect(usePlayerStore.getState().trialPerks).toHaveLength(0);
    });

    it("Day 3 miss: demotes tier (VAL-STREAK-007)", () => {
      const now = Date.now();
      usePlayerStore.getState().setTier("gold");

      simulateMissedDay(now);
      simulateMissedDay(now + 1000);
      const result = simulateMissedDay(now + 2000);
      expect(result.type).toBe("tier-demotion");
      expect(result.missedDay).toBe(3);
      expect(result.previousTier).toBe("gold");
      expect(result.newTier).toBe("silver");
      expect(usePlayerStore.getState().tier).toBe("silver");
    });

    it("Day 3 miss does not demote below Bronze", () => {
      const now = Date.now();
      usePlayerStore.getState().setTier("bronze");

      simulateMissedDay(now);
      simulateMissedDay(now + 1000);
      simulateMissedDay(now + 2000);
      expect(usePlayerStore.getState().tier).toBe("bronze");
    });

    it("escalating penalties in order: token -> perk -> tier (VAL-STREAK-008)", () => {
      const now = Date.now();
      usePlayerStore.getState().addTokens(50);
      usePlayerStore.getState().setTier("silver");
      const perk: Perk = {
        id: "perk-esc",
        name: "Escalation Perk",
        description: "Test",
        type: "earned",
      };
      usePlayerStore.getState().addPerk(perk);

      const day1 = simulateMissedDay(now);
      expect(day1.type).toBe("token-loss");

      const day2 = simulateMissedDay(now + 1);
      expect(day2.type).toBe("perk-loss");

      const day3 = simulateMissedDay(now + 2);
      expect(day3.type).toBe("tier-demotion");
    });
  });

  /* --- Penalty reset on visit (VAL-STREAK-009) --- */

  describe("penalty reset on visit (VAL-STREAK-009)", () => {
    it("visiting after a missed day resets missedDays to 0", () => {
      const now = Date.now();
      usePlayerStore.setState((state) => ({
        streak: {
          ...state.streak,
          lastVisit: now,
          count: 3,
        },
      }));

      // Simulate a miss
      simulateMissedDay(now + MS_PER_DAY);
      expect(usePlayerStore.getState().streak.missedDays).toBe(1);
      expect(usePlayerStore.getState().streak.broken).toBe(true);

      // Visit on the next day (within recovery window) to recover
      checkStreakOnVisit(now + MS_PER_DAY + 1000);
      // After recovery, missedDays should be 0
      expect(usePlayerStore.getState().streak.missedDays).toBe(0);
      expect(usePlayerStore.getState().streak.broken).toBe(false);
    });

    it("incrementStreak resets all break/recovery flags", () => {
      usePlayerStore.getState().breakStreak();
      usePlayerStore.getState().setRecoveryWindowStart(Date.now());
      usePlayerStore.getState().activateComebackBonus(Date.now() + 60000);
      usePlayerStore.getState().incrementStreak();
      const s = usePlayerStore.getState().streak;
      expect(s.broken).toBe(false);
      expect(s.recoveryWindow).toBe(false);
      expect(s.missedDays).toBe(0);
      expect(s.recoveryWindowStart).toBe(0);
      expect(s.preBreakCount).toBe(0);
      expect(s.comebackBonus).toBeNull();
    });
  });

  /* --- Recovery window expiry (VAL-STREAK-017) --- */

  describe("checkRecoveryWindowExpiry (VAL-STREAK-017)", () => {
    it("returns false when no window active", () => {
      expect(checkRecoveryWindowExpiry()).toBe(false);
    });

    it("returns false when window still active", () => {
      const now = Date.now();
      usePlayerStore.getState().setRecoveryWindowStart(now);
      expect(checkRecoveryWindowExpiry(now + 1000)).toBe(false);
      expect(usePlayerStore.getState().streak.recoveryWindow).toBe(true);
    });

    it("closes window when 48h have passed", () => {
      const start = Date.now();
      usePlayerStore.getState().setRecoveryWindowStart(start);
      const later = start + RECOVERY_WINDOW_MS + 1000;
      expect(checkRecoveryWindowExpiry(later)).toBe(true);
      expect(usePlayerStore.getState().streak.recoveryWindow).toBe(false);
      expect(usePlayerStore.getState().streak.recoveryWindowStart).toBe(0);
    });
  });

  /* --- Comeback bonus expiry (VAL-STREAK-012) --- */

  describe("checkComebackBonusExpiry (VAL-STREAK-012)", () => {
    it("returns false when no bonus active", () => {
      expect(checkComebackBonusExpiry()).toBe(false);
    });

    it("returns false when bonus still active", () => {
      const now = Date.now();
      usePlayerStore.getState().activateComebackBonus(now + 60000);
      expect(checkComebackBonusExpiry(now)).toBe(false);
    });

    it("clears bonus when expired", () => {
      const now = Date.now();
      usePlayerStore.getState().activateComebackBonus(now - 1000);
      expect(checkComebackBonusExpiry(now)).toBe(true);
      expect(usePlayerStore.getState().streak.comebackBonus).toBeNull();
    });
  });

  /* --- Comeback bonus 2x multiplier (VAL-STREAK-012) --- */

  describe("comeback bonus 2x multiplier (VAL-STREAK-012)", () => {
    it("awardTokens applies 2x on top of tier multiplier during comeback", () => {
      usePlayerStore.getState().setTier("gold"); // 2x tier
      usePlayerStore.getState().activateComebackBonus(Date.now() + 60000);
      // Base reward 5, gold tier = 10, comeback 2x = 20
      const credited = usePlayerStore.getState().awardTokens(5);
      expect(credited).toBe(20);
      expect(usePlayerStore.getState().tokens).toBe(20);
    });

    it("awardTokens does NOT apply 2x when comeback bonus is not active", () => {
      usePlayerStore.getState().setTier("gold"); // 2x tier
      const credited = usePlayerStore.getState().awardTokens(5);
      expect(credited).toBe(10);
    });

    it("awardTokens does NOT apply 2x when comeback bonus has expired", () => {
      usePlayerStore.getState().setTier("bronze"); // 1x tier
      usePlayerStore.getState().activateComebackBonus(Date.now() - 1000); // expired
      const credited = usePlayerStore.getState().awardTokens(5);
      expect(credited).toBe(5); // no 2x because expired
    });
  });

  /* --- Integer invariant (VAL-STREAK-020) --- */

  describe("integer invariant (VAL-STREAK-020)", () => {
    it("streak count is always a positive integer", () => {
      expect(Number.isInteger(usePlayerStore.getState().streak.count)).toBe(true);
      expect(usePlayerStore.getState().streak.count).toBeGreaterThan(0);

      usePlayerStore.getState().incrementStreak();
      expect(Number.isInteger(usePlayerStore.getState().streak.count)).toBe(true);
      expect(usePlayerStore.getState().streak.count).toBeGreaterThan(0);
    });

    it("streak count after partial restoration is a positive integer", () => {
      usePlayerStore.setState((state) => ({
        streak: { ...state.streak, preBreakCount: 7 },
      }));
      usePlayerStore.getState().restoreStreakPartial();
      const count = usePlayerStore.getState().streak.count;
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThan(0);
    });
  });

  /* --- Streak exit status (VAL-STREAK-019) --- */

  describe("getStreakExitStatus (VAL-STREAK-019)", () => {
    it("returns streak count matching the store", () => {
      usePlayerStore.getState().incrementStreak(); // count = 2
      const status = getStreakExitStatus();
      expect(status.count).toBe(2);
      expect(usePlayerStore.getState().streak.count).toBe(2);
    });

    it("returns broken and recovery window state", () => {
      const now = Date.now();
      usePlayerStore.getState().setRecoveryWindowStart(now);
      usePlayerStore.getState().breakStreak();
      const status = getStreakExitStatus(now);
      expect(status.broken).toBe(true);
      expect(status.recoveryWindow).toBe(true);
    });

    it("returns comeback active state", () => {
      usePlayerStore.getState().activateComebackBonus(Date.now() + 60000);
      const status = getStreakExitStatus();
      expect(status.comebackActive).toBe(true);
    });

    it("includes anxiety message", () => {
      const status = getStreakExitStatus();
      expect(status.anxietyMessage).toContain("streak");
    });
  });

  /* --- Streak anxiety messaging (VAL-STREAK-014) --- */

  describe("getStreakAnxietyMessage (VAL-STREAK-014)", () => {
    it("returns anxiety message for a normal active streak", () => {
      const streak = usePlayerStore.getState().streak;
      const msg = getStreakAnxietyMessage(streak);
      expect(msg).toContain("Visit tomorrow");
      expect(msg).toContain("streak");
    });

    it("returns recovery message when broken with recovery window", () => {
      const now = Date.now();
      usePlayerStore.setState((state) => ({
        streak: {
          ...state.streak,
          broken: true,
          recoveryWindow: true,
          recoveryWindowStart: now,
          preBreakCount: 5,
        },
      }));
      const streak = usePlayerStore.getState().streak;
      const msg = getStreakAnxietyMessage(streak);
      expect(msg).toContain("broke");
      expect(msg).toContain("48h");
    });

    it("returns break message when broken without recovery window", () => {
      usePlayerStore.getState().breakStreak();
      const streak = usePlayerStore.getState().streak;
      const msg = getStreakAnxietyMessage(streak);
      expect(msg).toContain("broke");
    });

    it("mentions the streak count for longer streaks", () => {
      usePlayerStore.setState((state) => ({
        streak: { ...state.streak, count: 7 },
      }));
      const streak = usePlayerStore.getState().streak;
      const msg = getStreakAnxietyMessage(streak);
      expect(msg).toContain("7");
    });
  });
});
