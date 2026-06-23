/**
 * EventScheduler - central game loop running on a 1-second tick.
 *
 * Per architecture.md the scheduler:
 *   - Tracks session time -> updates sessionMinutes
 *   - Checks reward density -> shifts hook -> chase at 15 min
 *   - Recalculates deficit pricing each tick
 *   - Re-enables the spinning wheel after cooldown
 *   - Moves phantoms every 5s
 *   - Fires leaderboard updates + proximity alerts
 *   - Expires trial perks
 *   - Processes the scheduled event queue
 *
 * The scheduler is a singleton class that wraps setInterval. It is safe to
 * start/stop multiple times and is designed to be controlled from a React
 * effect in the mall layout. Real game-side effects (spinning wheel rewards,
 * flash sale triggering, streak break detection) are intentionally left as
 * skeleton hooks so subsequent features can flesh them out.
 */

import type { GameEvent } from "@/types";
import { useSessionStore } from "@/stores/sessionStore";
import { useEconomyStore, WHEEL_COOLDOWN_MS, INITIAL_WHEEL_DELAY_MS } from "@/stores/economyStore";
import { useSocialStore } from "@/stores/socialStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";
import { checkForTierUpgrade } from "@/engine/tierEngine";
import {
  triggerProximityFlashSale,
  tickFlashSaleTimers,
  PROXIMITY_CHECK_EVERY_N_TICKS,
  resetFlashSaleEngine,
} from "@/engine/flashSaleEngine";
import {
  checkRecoveryWindowExpiry,
  checkComebackBonusExpiry,
  processMissedDayPenalties,
} from "@/engine/streakEngine";
import { checkRescueBoostExpiry } from "@/engine/exitFrictionEngine";
import {
  detectOvertakeAndShift,
  checkProximityAndAlert,
  tickPhantomScores,
  resetPhantomEngine,
} from "@/engine/phantomEngine";
import type { FlashSale } from "@/types";
import type { PenaltyResult } from "@/engine/streakEngine";

const TICK_MS = 1000;

export interface EventSchedulerHandlers {
  /** Called when the reward density phase flips from hook to chase. */
  onRewardDensityShift?: (phase: "hook" | "chase") => void;
  /** Called when the spinning wheel cooldown elapses and it becomes available. */
  onWheelAvailable?: () => void;
  /** Called when a proximity flash sale is triggered (sale pushed to store). */
  onFlashSaleTriggered?: (sale: FlashSale) => void;
  /** Called when a trial perk expires and is removed from the perks list. */
  onTrialPerkExpired?: (perkId: string, perkName: string) => void;
  /** Called when the player is promoted to a new tier (VAL-TIER-006). */
  onTierUpgrade?: (newTier: string, previousTier: string) => void;
  /**
   * Called for each missed-day penalty applied by the scheduler's day-
   * boundary detection (VAL-STREAK-005..008). The penalty result carries the
   * ACTUAL capped token loss so the notification never overstates the
   * deduction.
   */
  onMissedDayPenalty?: (result: PenaltyResult) => void;
  /** Called when the 48h recovery window expires (VAL-STREAK-017). */
  onRecoveryWindowExpired?: () => void;
  /** Called when the 30-min comeback bonus expires (VAL-STREAK-012). */
  onComebackBonusExpired?: () => void;
  /** Called when the 5-min rescue-bargain 2x boost expires (VAL-EXIT-016). */
  onRescueBoostExpired?: () => void;
  /** Called when a proximity alert fires (VAL-LEADER-011). */
  onProximityAlert?: (targetName: string, gap: number, rank: number) => void;
  /** Called for each due scheduled event. */
  onProcessEvent?: (event: GameEvent) => void;
}

export class EventScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;
  private handlers: EventSchedulerHandlers;

  constructor(handlers: EventSchedulerHandlers = {}) {
    this.handlers = handlers;
  }

  /** Set or replace external handlers (safe to call while running). */
  setHandlers(handlers: EventSchedulerHandlers): void {
    this.handlers = handlers;
  }

  /** Returns true if the scheduler is currently ticking. */
  get isRunning(): boolean {
    return this.intervalId !== null;
  }

  /** Begin the 1-second game loop. No-op if already running. */
  start(): void {
    if (this.intervalId !== null) return;
    this.tickCount = 0;
    // Ensure the session clock is started.
    useSessionStore.getState().startSession();
    this.intervalId = setInterval(() => this.tick(), TICK_MS);
  }

  /** Stop the game loop. No-op if not running. */
  stop(): void {
    if (this.intervalId === null) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  /**
   * A single scheduler tick. Exposed publicly so tests can drive the loop
   * deterministically without waiting on real timers.
   */
  tick(): void {
    this.tickCount += 1;
    const economy = useEconomyStore.getState();

    // 1. Session time tracking -> update sessionMinutes.
    useSessionStore.getState().tick();
    // Re-read the session state so we pick up the updated sessionMinutes.
    const sessionMinutes = useSessionStore.getState().sessionMinutes;

    // 2. Reward density check -> shift hook -> chase at 15 min.
    const previousPhase = economy.rewardDensity.phase;
    economy.updateRewardDensity(sessionMinutes);
    const nextPhase = useEconomyStore.getState().rewardDensity.phase;
    if (previousPhase !== nextPhase) {
      this.handlers.onRewardDensityShift?.(nextPhase);
    }

    // 3. Deficit pricing recalculation each tick — refresh the live teaser
    //    price (balance + 2..3) so the persistent spend opportunity always
    //    reflects the user's current balance (VAL-TOKEN-018).
    economy.refreshLiveDeficitPrice();

    // 4. Spinning wheel availability check -> cooldown timer + initial availability.
    const wheel = economy.spinningWheel;
    const now = Date.now();
    const sessionStart = useSessionStore.getState().sessionStart;
    if (!wheel.available) {
      if (
        wheel.lastSpin > 0 &&
        now - wheel.lastSpin >= WHEEL_COOLDOWN_MS
      ) {
        economy.makeWheelAvailable();
        this.handlers.onWheelAvailable?.();
      } else if (
        // First appearance: wheel becomes available shortly after session start
        // (not immediately) so it is NOT always available (VAL-WHEEL-001).
        wheel.spinCount === 0 &&
        wheel.lastSpin === 0 &&
        now - sessionStart >= INITIAL_WHEEL_DELAY_MS
      ) {
        economy.makeWheelAvailable();
        this.handlers.onWheelAvailable?.();
      }
    }

    // 5. Phantom movement -> update positions every 5s (every 5th tick).
    if (this.tickCount % 5 === 0) {
      useSocialStore.getState().movePhantoms();
    }

    // 6. Flash sale background timer tick — decrement countdowns for ALL
    //    active flash sales (not just the visible one) and expire any whose
    //    synthetic timer reaches zero, regardless of overlay state. This
    //    ensures hidden pending sales age out even if the user never opens
    //    the overlay (fixes blocking scrutiny issue).
    tickFlashSaleTimers();

    // 7. Flash sale proximity trigger. Sales appear when the player is near a
    //    store; probability rises with time-in-mall (VAL-SALE-001, -014). The
    //    check runs every Nth tick to avoid spamming rolls, and only surfaces
    //    the overlay immediately when no other overlay is open — otherwise the
    //    sale stays pending and the "Deal Radar" entry button surfaces it.
    if (this.tickCount % PROXIMITY_CHECK_EVERY_N_TICKS === 0) {
      const ui = useUIStore.getState();
      // Don't trigger a new sale while a flash sale is already showing.
      if (ui.activeOverlay !== "flash-sale") {
        const sale = triggerProximityFlashSale();
        if (sale) {
          this.handlers.onFlashSaleTriggered?.(sale);
          // If nothing is capturing the screen, surface the sale directly so
          // the user is made aware of it (VAL-SALE-018). The handler may also
          // choose to show it (e.g. the mall layout wires a handler).
          if (useUIStore.getState().activeOverlay === "none") {
            ui.showOverlay("flash-sale", sale);
          }
        }
      }
    }

    // 8. Leaderboard + proximity check (VAL-LEADER-010..016). Every 2nd
    //    tick: refresh the leaderboard from live player values, run the
    //    goalpost-shifting / new-phantom-on-overtake logic, and fire a
    //    proximity alert when the user is genuinely close to overtaking.
    //    Runs at least every 2nd tick (not every 10th) so the leaderboard
    //    reflects the player's live score in near real-time (~2s lag max)
    //    instead of ~10s.
    if (this.tickCount % 2 === 0) {
      useSocialStore.getState().updateLeaderboard();
      const overtaken = detectOvertakeAndShift();
      if (overtaken) {
        // Re-rank after a phantom was added/shifted so ranks stay contiguous
        // and reflect the new ordering (VAL-LEADER-014, VAL-LEADER-021).
        useSocialStore.getState().updateLeaderboard();
      }
      const alertId = checkProximityAndAlert();
      if (alertId) {
        const alerts = useSocialStore.getState().proximityAlerts;
        const alert = alerts.find((a) => a.id === alertId);
        if (alert) {
          this.handlers.onProximityAlert?.(
            alert.targetName,
            alert.tokenGap,
            alert.rank,
          );
        }
      }
    }

    // 8b. Phantom score evolution — keep phantom scores from freezing
    //     (VAL-LEADER-016). Runs every 15th tick so the drift is subtle.
    if (this.tickCount % 15 === 0) {
      tickPhantomScores();
    }

    // 9. Trial perk expiry check -> remove expired perks and notify.
    const expiredPerks = usePlayerStore.getState().expireTrialPerks();
    if (expiredPerks.length > 0) {
      for (const perk of expiredPerks) {
        this.handlers.onTrialPerkExpired?.(perk.id, perk.name);
      }
    }

    // 10. Tier progression check -> promote + celebrate when a threshold is
    //     crossed (VAL-TIER-005, VAL-TIER-006, VAL-TIER-023). Runs every tick
    //     so upgrades surface within ~1s of the earning/exploration event.
    const previousTier = usePlayerStore.getState().tier;
    const promoted = checkForTierUpgrade();
    if (promoted && promoted !== previousTier) {
      this.handlers.onTierUpgrade?.(promoted, previousTier);
    }

    // 11. Map store stays subscribed; no per-tick map work needed here.

    // 12. Streak system checks (VAL-STREAK-010..017):
    //     a) Missed-day penalty escalation — detect when one or more day
    //        boundaries have passed since `streak.lastVisit` and apply the
    //        escalating penalties (Day 1 token loss, Day 2 perk loss, Day 3
    //        tier demotion) for each NEW missed day via simulateMissedDay
    //        (VAL-STREAK-005..008, VAL-STREAK-016). This runs every tick so
    //        both the catch-up on return (days missed while away) and
    //        in-session midnight crossings are detected. The function is
    //        idempotent across ticks: it only applies the delta of
    //        not-yet-penalized missed days.
    const penaltyResults = processMissedDayPenalties(now);
    if (penaltyResults.length > 0) {
      for (const result of penaltyResults) {
        this.handlers.onMissedDayPenalty?.(result);
      }
    }
    //     b) Recovery window expiry — if 48h have elapsed since the streak
    //        broke, close the window so the next visit is a full reset
    //        (VAL-STREAK-017).
    const recoveryExpired = checkRecoveryWindowExpiry(now);
    if (recoveryExpired) {
      this.handlers.onRecoveryWindowExpired?.();
    }
    //     b) Comeback bonus expiry — if the 30-min 2x window has elapsed,
    //        clear it (VAL-STREAK-012).
    const comebackExpired = checkComebackBonusExpiry(now);
    if (comebackExpired) {
      this.handlers.onComebackBonusExpired?.();
    }
    //     c) Rescue boost expiry — if the 5-min 2x rescue-bargain window has
    //        elapsed, clear it (VAL-EXIT-016).
    const rescueExpired = checkRescueBoostExpiry(now);
    if (rescueExpired) {
      this.handlers.onRescueBoostExpired?.();
    }

    // 13. Process scheduled event queue.
    const sessionStore = useSessionStore.getState();
    const due = sessionStore.processEvents();
    if (due.length > 0) {
      for (const event of due) {
        this.handlers.onProcessEvent?.(event);
      }
      // Clean up processed events to keep the queue bounded.
      useSessionStore.getState().clearProcessedEvents();
    }
  }

  /** Reset all stores back to initial state and stop the loop. */
  reset(): void {
    this.stop();
    this.tickCount = 0;
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
    useSessionStore.getState().reset();
    useEconomyStore.getState().reset();
    useSocialStore.getState().reset();
    resetFlashSaleEngine();
    resetPhantomEngine();
  }
}

/* ============================================================================
   Singleton instance
   ========================================================================== */

let schedulerInstance: EventScheduler | null = null;

/**
 * Returns the shared scheduler instance. Creates it on first call.
 * Pass handlers to wire up external callbacks (e.g. UI celebrations).
 */
export function getEventScheduler(
  handlers?: EventSchedulerHandlers
): EventScheduler {
  if (schedulerInstance === null) {
    schedulerInstance = new EventScheduler(handlers ?? {});
  } else if (handlers) {
    schedulerInstance.setHandlers(handlers);
  }
  return schedulerInstance;
}

/** Tear down the singleton (primarily for tests). */
export function resetEventSchedulerSingleton(): void {
  if (schedulerInstance !== null) {
    schedulerInstance.stop();
    schedulerInstance = null;
  }
}

export default EventScheduler;
