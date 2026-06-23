/**
 * streakEngine - the escalating streak system.
 *
 * Implements the daily streak counter with escalating penalties and a
 * comeback-bonus recovery window. The streak is the core retention dark
 * pattern: missing days triggers escalating consequences (token penalty,
 * perk loss, tier demotion) while a 48-hour recovery window offers a
 * partial restoration and a 2x token comeback bonus to lure the user back.
 *
 * Penalties escalate in order (VAL-STREAK-008):
 *   Day 1 miss -> token penalty (10% of cumulative bonus tokens)
 *   Day 2 miss -> perk loss (one active perk removed)
 *   Day 3 miss -> tier demotion (demote by one tier level)
 *
 * The recovery window (VAL-STREAK-010..013):
 *   - On streak break, a 48h recovery window opens.
 *   - If the user returns within 48h: partial streak restoration (lose 2 days
 *     instead of all) + 2x tokens for 30 minutes (comeback bonus).
 *   - If the user does NOT return within 48h: the window expires, a full
 *     streak reset applies on next visit, and no comeback bonus is granted
 *     (VAL-STREAK-017, VAL-STREAK-018).
 */

import { usePlayerStore } from "@/stores/playerStore";
import type { StreakState, StreakPenaltySnapshot, Tier } from "@/types";

/* ============================================================================
   Constants
   ========================================================================== */

/** One day in milliseconds (used for day-boundary detection). */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** 48-hour recovery window duration (VAL-STREAK-010, VAL-STREAK-017). */
export const RECOVERY_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Comeback bonus duration: 30 minutes of 2x tokens (VAL-STREAK-012). */
export const COMEBACK_BONUS_DURATION_MS = 30 * 60 * 1000;
/**
 * Day-1 miss token penalty: 10% of the player's cumulative earned tokens
 * (tierXP), per the feature spec ("10% of bonus"). Falls back to a flat
 * minimum of 1 token when the player has no earnings yet so the penalty is
 * still communicated.
 */
export const DAY1_PENALTY_PERCENT = 0.10;
/**
 * The escalation caps at Day 3 (token loss -> perk loss -> tier demotion).
 * No additional penalties are applied for misses beyond the 3rd consecutive
 * missed day (VAL-STREAK-008).
 */
export const MAX_PENALTY_DAY = 3;

/* ============================================================================
   Types
   ========================================================================== */

export type StreakVisitResult =
  | { type: "same-day" }
  | { type: "incremented"; newCount: number }
  | { type: "recovered"; newCount: number; comebackBonus: true }
  | { type: "full-reset"; comebackBonus: false };

export type PenaltyType = "token-loss" | "perk-loss" | "tier-demotion";

export interface PenaltyResult {
  type: PenaltyType;
  missedDay: number;
  /** Human-readable message for UI notification. */
  message: string;
  /** Amount of tokens lost (token-loss only). */
  tokensLost?: number;
  /** Name of the perk lost (perk-loss only). */
  perkLostName?: string;
  /** Previous and new tier (tier-demotion only). */
  previousTier?: Tier;
  newTier?: Tier;
}

/* ============================================================================
   Pure helpers
   ========================================================================== */

/**
 * Return the number of full calendar days between two epoch-ms timestamps.
 * A value of 0 means same day, 1 means the next day, etc.
 */
export function daysBetween(earlier: number, later: number): number {
  if (earlier <= 0 || later <= 0) return 0;
  return Math.floor((later - earlier) / MS_PER_DAY);
}

/**
 * Compute the Day-1 token penalty amount: 10% of cumulative earned tokens
 * (tierXP), floored to a minimum of 1 (VAL-STREAK-005).
 */
export function computeDay1Penalty(tierXP: number): number {
  return Math.max(1, Math.floor(tierXP * DAY1_PENALTY_PERCENT));
}

/**
 * Returns the remaining milliseconds in the recovery window, or 0 if the
 * window is not active or has expired (VAL-STREAK-011).
 */
export function getRecoveryCountdownMs(
  streak: StreakState,
  now: number = Date.now()
): number {
  if (!streak.recoveryWindow || streak.recoveryWindowStart <= 0) return 0;
  const elapsed = now - streak.recoveryWindowStart;
  const remaining = RECOVERY_WINDOW_MS - elapsed;
  return Math.max(0, remaining);
}

/**
 * Format the recovery countdown as a human-readable string
 * (e.g. "47h 59m left").
 */
export function formatRecoveryCountdown(
  streak: StreakState,
  now: number = Date.now()
): string {
  const remaining = getRecoveryCountdownMs(streak, now);
  if (remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m left`;
}

/**
 * Returns true if the comeback bonus 2x multiplier is currently active
 * (VAL-STREAK-012). Used by awardTokens internally.
 */
export function isComebackBonusActive(
  streak: StreakState,
  now: number = Date.now()
): boolean {
  return (
    streak.comebackBonus !== null &&
    streak.comebackBonus.active &&
    streak.comebackBonus.expiresAt > now
  );
}

/**
 * Returns the remaining milliseconds for the comeback bonus, or 0 if inactive
 * or expired.
 */
export function getComebackBonusCountdownMs(
  streak: StreakState,
  now: number = Date.now()
): number {
  if (!isComebackBonusActive(streak, now)) return 0;
  return Math.max(0, streak.comebackBonus!.expiresAt - now);
}

/* ============================================================================
   Streak visit check (VAL-STREAK-004, VAL-STREAK-009, VAL-STREAK-013,
                      VAL-STREAK-017, VAL-STREAK-018)
   ========================================================================== */

/**
 * Check the streak state on a visit to the mall. Compares the current time
 * with `streak.lastVisit` to determine whether this is a same-day return, a
 * consecutive-day increment, a recovery-window return, or a full reset.
 *
 * This function DOES NOT apply penalties — it only advances the streak
 * counter and manages the recovery window. Penalties are applied separately
 * by `applyMissedDayPenalty` when a miss is detected (e.g. by the event
 * scheduler's day-boundary check or by `simulateMissedDay`).
 *
 * Returns a result describing what happened, so the caller can show
 * appropriate UI feedback.
 */
export function checkStreakOnVisit(now: number = Date.now()): StreakVisitResult {
  const player = usePlayerStore.getState();
  const streak = player.streak;

  // First-ever visit (lastVisit === 0): streak is already Day 1 from init.
  if (streak.lastVisit === 0) {
    // Set lastVisit to now but keep count at 1 (already initialized).
    usePlayerStore.setState((state) => ({
      streak: { ...state.streak, lastVisit: now },
    }));
    return { type: "same-day" };
  }

  const days = daysBetween(streak.lastVisit, now);

  // Same calendar day — no streak change (VAL-STREAK-004: only increments on
  // a NEW day).
  if (days <= 0) {
    return { type: "same-day" };
  }

  // Exactly 1 day passed -> consecutive daily visit, increment the streak
  // (VAL-STREAK-004). This also resets missedDays/broken (VAL-STREAK-009).
  if (days === 1) {
    // If the streak was broken and we're within the recovery window, this is
    // a recovery return (not a clean consecutive increment).
    if (streak.recoveryWindow && streak.broken) {
      return handleRecoveryReturn(now);
    }
    usePlayerStore.getState().incrementStreak();
    const newCount = usePlayerStore.getState().streak.count;
    return { type: "incremented", newCount };
  }

  // More than 1 day passed -> streak was broken. Check if within the
  // 48-hour recovery window for partial restoration (VAL-STREAK-013).
  if (streak.recoveryWindow) {
    const recoveryRemaining = getRecoveryCountdownMs(streak, now);
    if (recoveryRemaining > 0) {
      return handleRecoveryReturn(now);
    }
  }

  // Recovery window expired or never opened -> full reset (VAL-STREAK-017).
  // Reset streak to Day 1, clear all break/recovery flags, no comeback bonus
  // (VAL-STREAK-018: no false comeback bonus without a break recovery).
  usePlayerStore.setState(() => ({
    streak: {
      count: 1,
      lastVisit: now,
      broken: false,
      recoveryWindow: false,
      missedDays: 0,
      recoveryWindowStart: 0,
      preBreakCount: 0,
      comebackBonus: null,
      streakProtected: false,
    },
  }));
  return { type: "full-reset", comebackBonus: false };
}

/**
 * Handle a return within the recovery window: partial streak restoration
 * (lose 2 days instead of all) + activate the 2x comeback bonus for 30 min
 * (VAL-STREAK-012, VAL-STREAK-013).
 */
function handleRecoveryReturn(now: number): StreakVisitResult {
  const player = usePlayerStore.getState();

  // Partial restoration: lose 2 days instead of all (VAL-STREAK-013).
  player.restoreStreakPartial();

  // Activate the 2x comeback bonus for 30 minutes (VAL-STREAK-012).
  player.activateComebackBonus(now + COMEBACK_BONUS_DURATION_MS);

  const newCount = usePlayerStore.getState().streak.count;
  return { type: "recovered", newCount, comebackBonus: true };
}

/* ============================================================================
   Penalty escalation (VAL-STREAK-005..008, VAL-STREAK-016)
   ========================================================================== */

/**
 * Apply the penalty for a missed day. The penalty type depends on the
 * `missedDay` number (1 = token loss, 2 = perk loss, 3 = tier demotion).
 * The caller (event scheduler or simulateMissedDay) is responsible for
 * calling `registerMissedDay` first to increment the counter.
 *
 * Returns a PenaltyResult describing what happened, for UI notification.
 */
export function applyMissedDayPenalty(
  missedDay: number,
  now: number = Date.now()
): PenaltyResult {
  const player = usePlayerStore.getState();

  switch (missedDay) {
    case 1: {
      // Day 1 miss: token penalty (10% of bonus) (VAL-STREAK-005).
      const penalty = computeDay1Penalty(player.tierXP);
      // Deduct tokens (cannot go negative — addTokens with negative is
      // clamped, but we use a direct deduction via spendTokens-like logic).
      const currentTokens = player.tokens;
      const lost = Math.min(currentTokens, penalty);
      usePlayerStore.setState((state) => ({
        tokens: Math.max(0, state.tokens - lost),
      }));
      return {
        type: "token-loss",
        missedDay: 1,
        message: `Streak broken! You lost ${lost} tokens for missing Day 1.`,
        tokensLost: lost,
      };
    }

    case 2: {
      // Day 2 miss: perk loss (VAL-STREAK-006). Remove one active perk.
      const earnedPerks = player.perks;
      const trialPerks = player.trialPerks;
      let perkLostName: string | undefined;

      if (earnedPerks.length > 0) {
        const perk = earnedPerks[0]!;
        player.removePerk(perk.id);
        perkLostName = perk.name;
      } else if (trialPerks.length > 0) {
        const perk = trialPerks[0]!;
        player.removeTrialPerk(perk.id);
        perkLostName = perk.name;
      } else {
        // No perks to remove — notify that a perk slot was lost.
        perkLostName = "No perks remaining to lose";
      }

      return {
        type: "perk-loss",
        missedDay: 2,
        message: `Day 2 missed! You lost a perk${perkLostName ? `: ${perkLostName}` : ""}.`,
        perkLostName,
      };
    }

    case 3: {
      // Day 3 miss: tier demotion (VAL-STREAK-007, VAL-TIER-022).
      // registerMissedDay already handled the demotion — we just report it.
      // The caller (simulateMissedDay) passes the previous tier via the
      // `now` parameter context. We read the current (post-demotion) tier.
      void now;
      const currentTier = usePlayerStore.getState().tier;
      return {
        type: "tier-demotion",
        missedDay: 3,
        message: `Day 3 missed! You've been demoted to ${currentTier}.`,
        newTier: currentTier,
      };
    }

    default: {
      // Beyond Day 3: no additional penalty (escalation caps at Day 3).
      return {
        type: "tier-demotion",
        missedDay,
        message: `Streak fully broken. Visit to start a new streak.`,
      };
    }
  }
}

/**
 * Simulate a missed day: registers the miss (increments missedDays, sets
 * broken flag, demotes tier at Day 3), then applies the appropriate penalty.
 * Also opens the recovery window on the first miss (VAL-STREAK-010).
 *
 * Returns the PenaltyResult for UI notification. This is the primary
 * entry point for the event scheduler's day-boundary miss detection.
 *
 * A `StreakPenaltySnapshot` is stored on the player store
 * (`lastStreakPenalty`) carrying the ACTUAL capped token loss, so the UI
 * notification never overstates the deduction (the Day-1 penalty is capped at
 * the player's current balance).
 */
export function simulateMissedDay(now: number = Date.now()): PenaltyResult {
  const player = usePlayerStore.getState();
  // Streak protection (VAL-EXIT-028): a protected streak does not break or
  // accrue penalties for the session.
  if (player.streak.streakProtected) {
    return {
      type: "tier-demotion",
      missedDay: 0,
      message: `Your streak is protected — no penalty today.`,
    };
  }
  // Capture the tier before any demotion so we can report previousTier.
  const tierBefore = player.tier;

  let result: PenaltyResult;

  // On the first miss, open the 48h recovery window (VAL-STREAK-010) and
  // record the pre-break count.
  if (player.streak.missedDays === 0) {
    usePlayerStore.setState((state) => ({
      streak: {
        ...state.streak,
        broken: true,
        preBreakCount: state.streak.count,
        recoveryWindow: true,
        recoveryWindowStart: now,
      },
    }));
    // Register the missed day (increments missedDays to 1).
    const missedDay = usePlayerStore.getState().registerMissedDay();
    // registerMissedDay already set broken=true and missedDays. But we also
    // set recoveryWindow above; re-assert it since registerMissedDay may have
    // overwritten via spread.
    usePlayerStore.setState((state) => ({
      streak: {
        ...state.streak,
        recoveryWindow: true,
        recoveryWindowStart: now,
        preBreakCount: state.streak.preBreakCount || state.streak.count,
      },
    }));
    result = applyMissedDayPenalty(missedDay, now);
  } else {
    // Subsequent misses: just register and apply penalty.
    const missedDay = usePlayerStore.getState().registerMissedDay();
    result = applyMissedDayPenalty(missedDay, now);
  }

  // Enrich Day 3 result with the pre-demotion tier.
  if (result.type === "tier-demotion" && result.missedDay === 3) {
    result.previousTier = tierBefore;
    result.message = `Day 3 missed! You've been demoted from ${tierBefore} to ${result.newTier}.`;
  }

  // Store the penalty snapshot for UI notification so the
  // StreakPenaltyNotification component can display the ACTUAL capped token
  // loss rather than a recomputed estimate (VAL-STREAK-005).
  usePlayerStore.setState({ lastStreakPenalty: penaltyResultToSnapshot(result) });

  return result;
}

/* ============================================================================
   Scheduler-driven missed-day detection (VAL-STREAK-005..008, VAL-STREAK-016)
   ========================================================================== */

/**
 * Convert a PenaltyResult into a StreakPenaltySnapshot for UI storage.
 */
function penaltyResultToSnapshot(result: PenaltyResult): StreakPenaltySnapshot {
  return {
    type: result.type,
    missedDay: result.missedDay,
    message: result.message,
    tokensLost: result.tokensLost,
    perkLostName: result.perkLostName,
    previousTier: result.previousTier,
    newTier: result.newTier,
  };
}

/**
 * Detect day boundaries that have passed since `streak.lastVisit` and apply
 * the missed-day escalation penalties for each NEW missed day
 * (VAL-STREAK-005..008, VAL-STREAK-016). This is the primary entry point for
 * the EventScheduler's streak check: on each tick it computes how many full
 * days have elapsed since the last visit and calls `simulateMissedDay` once
 * for each not-yet-penalized missed day, capped at Day 3 (the escalation
 * ceiling).
 *
 * Semantics:
 *   - A single day-pass (daysBetween === 1) is a CONSECUTIVE daily visit —
 *     NOT a miss. Misses start at daysElapsed >= 2 (at least one full day
 *     was skipped). The number of missed days = daysElapsed - 1.
 *   - Already-penalized misses are tracked via `streak.missedDays`, so only
 *     the delta (daysElapsed - 1 - missedDays) is applied per call. This
 *     makes the function idempotent across ticks.
 *   - Streak protection (VAL-EXIT-028) suppresses all penalties.
 *   - No-op when `lastVisit` is 0 (first-ever session, no prior visit to
 *     miss).
 *
 * Returns the array of PenaltyResult for each penalty applied this call
 * (empty when no new misses). The caller (EventScheduler) fires
 * `onMissedDayPenalty` for each result and `lastStreakPenalty` on the player
 * store holds the most recent snapshot for UI display.
 */
export function processMissedDayPenalties(
  now: number = Date.now()
): PenaltyResult[] {
  const streak = usePlayerStore.getState().streak;

  // No prior visit recorded (first session) — nothing to miss.
  if (streak.lastVisit <= 0) return [];
  // Streak protection suppresses all missed-day penalties (VAL-EXIT-028).
  if (streak.streakProtected) return [];

  const daysElapsed = daysBetween(streak.lastVisit, now);
  // The first day-pass is a consecutive visit, not a miss. Missed days start
  // at daysElapsed >= 2. Cap the escalatable misses at MAX_PENALTY_DAY (3).
  const applicableMisses = Math.min(Math.max(0, daysElapsed - 1), MAX_PENALTY_DAY);
  const newMisses = applicableMisses - streak.missedDays;

  if (newMisses <= 0) return [];

  const results: PenaltyResult[] = [];
  for (let i = 0; i < newMisses; i++) {
    const result = simulateMissedDay(now);
    results.push(result);
  }
  return results;
}

/* ============================================================================
   Recovery window expiry (VAL-STREAK-017)
   ========================================================================== */

/**
 * Check if the recovery window has expired (48h elapsed since it opened).
 * If so, close the window and return true. Returns false if the window is
 * still active or not open.
 */
export function checkRecoveryWindowExpiry(
  now: number = Date.now()
): boolean {
  const streak = usePlayerStore.getState().streak;
  if (!streak.recoveryWindow || streak.recoveryWindowStart <= 0) return false;

  const remaining = getRecoveryCountdownMs(streak, now);
  if (remaining <= 0) {
    usePlayerStore.getState().closeRecoveryWindow();
    return true;
  }
  return false;
}

/* ============================================================================
   Comeback bonus expiry (VAL-STREAK-012)
   ========================================================================== */

/**
 * Check if the comeback bonus has expired (30 min elapsed). If so, clear it
 * and return true. Returns false if the bonus is inactive or still active.
 */
export function checkComebackBonusExpiry(
  now: number = Date.now()
): boolean {
  const streak = usePlayerStore.getState().streak;
  if (!streak.comebackBonus || !streak.comebackBonus.active) return false;

  if (streak.comebackBonus.expiresAt <= now) {
    usePlayerStore.getState().clearComebackBonus();
    return true;
  }
  return false;
}

/* ============================================================================
   Streak status for exit friction (VAL-STREAK-019)
   ========================================================================== */

export interface StreakExitStatus {
  count: number;
  broken: boolean;
  recoveryWindow: boolean;
  recoveryCountdown: string;
  comebackActive: boolean;
  comebackCountdownMs: number;
  missedDays: number;
  anxietyMessage: string;
}

/**
 * Get a streak status summary suitable for display in the exit friction
 * Layer 2 (guilt escalation). The streak day count matches the current
 * store value (VAL-STREAK-019: no stale or fabricated values).
 */
export function getStreakExitStatus(
  now: number = Date.now()
): StreakExitStatus {
  const streak = usePlayerStore.getState().streak;
  return {
    count: streak.count,
    broken: streak.broken,
    recoveryWindow: streak.recoveryWindow,
    recoveryCountdown: formatRecoveryCountdown(streak, now),
    comebackActive: isComebackBonusActive(streak, now),
    comebackCountdownMs: getComebackBonusCountdownMs(streak, now),
    missedDays: streak.missedDays,
    anxietyMessage: getStreakAnxietyMessage(streak),
  };
}

/* ============================================================================
   Streak anxiety messaging (VAL-STREAK-014)
   ========================================================================== */

/**
 * Generate streak anxiety messaging based on the current streak state.
 * Returns a message encouraging the user to return tomorrow to maintain
 * their streak (VAL-STREAK-014).
 */
export function getStreakAnxietyMessage(streak: StreakState): string {
  if (streak.broken) {
    if (streak.recoveryWindow) {
      return `Your ${streak.preBreakCount}-day streak broke! Return within 48h to recover it.`;
    }
    return `Your streak broke. Visit today to start a new streak!`;
  }

  if (streak.count >= 7) {
    return `Visit tomorrow to keep your ${streak.count}-day streak! Don't lose your progress.`;
  }

  if (streak.count >= 3) {
    return `Visit tomorrow to keep your streak going! Day ${streak.count + 1} awaits.`;
  }

  return `Visit tomorrow to keep your streak! Day ${streak.count + 1} is just one visit away.`;
}

/* ============================================================================
   Penalty notification helper (for UI)
   ========================================================================== */

/**
 * Show a penalty notification via the celebration overlay. Uses the "spend"
 * (red, downward) treatment so penalty losses are visually distinct from
 * token gains (VAL-STREAK-005..008).
 */
export function getPenaltyOverlayData(result: PenaltyResult): {
  message: string;
  amount: number;
  kind: "spend";
} {
  return {
    message: result.message,
    amount: result.tokensLost ?? 0,
    kind: "spend" as const,
  };
}

const streakEngine = {
  MS_PER_DAY,
  RECOVERY_WINDOW_MS,
  COMEBACK_BONUS_DURATION_MS,
  DAY1_PENALTY_PERCENT,
  MAX_PENALTY_DAY,
  daysBetween,
  computeDay1Penalty,
  getRecoveryCountdownMs,
  formatRecoveryCountdown,
  isComebackBonusActive,
  getComebackBonusCountdownMs,
  checkStreakOnVisit,
  applyMissedDayPenalty,
  simulateMissedDay,
  processMissedDayPenalties,
  checkRecoveryWindowExpiry,
  checkComebackBonusExpiry,
  getStreakExitStatus,
  getStreakAnxietyMessage,
  getPenaltyOverlayData,
};

export default streakEngine;
