import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EventScheduler,
  getEventScheduler,
  resetEventSchedulerSingleton,
} from "@/engine/EventScheduler";
import { useSessionStore } from "@/stores/sessionStore";
import { useEconomyStore, WHEEL_COOLDOWN_MS } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useSocialStore } from "@/stores/socialStore";
import { useUIStore } from "@/stores/uiStore";
import { useTaskStore } from "@/stores/taskStore";
import { useMapStore } from "@/stores/mapStore";
import { resetFlashSaleEngine, buildAndPushSale, SYNTHETIC_TICK_MS } from "@/engine/flashSaleEngine";
import { getStoreById } from "@/data/mallData";
import { MS_PER_DAY } from "@/engine/streakEngine";
import type { Perk } from "@/types";

describe("EventScheduler", () => {
  let scheduler: EventScheduler;

  beforeEach(() => {
    // Reset all stores to a clean state.
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
    useSessionStore.getState().reset();
    useEconomyStore.getState().reset();
    useSocialStore.getState().reset();
    useUIStore.getState().reset();
    useTaskStore.getState().reset();
    resetFlashSaleEngine();
    // Deterministic RNG so the proximity flash-sale check never spuriously
    // triggers during scheduler unit tests.
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    resetEventSchedulerSingleton();
    scheduler = new EventScheduler();
  });

  afterEach(() => {
    scheduler.stop();
    resetEventSchedulerSingleton();
    vi.restoreAllMocks();
  });

  it("is not running until start() is called", () => {
    expect(scheduler.isRunning).toBe(false);
  });

  it("start() sets isRunning to true and starts the session", () => {
    vi.useFakeTimers();
    try {
      scheduler.start();
      expect(scheduler.isRunning).toBe(true);
      expect(useSessionStore.getState().sessionStart).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stop() clears the interval and sets isRunning to false", () => {
    vi.useFakeTimers();
    try {
      scheduler.start();
      scheduler.stop();
      expect(scheduler.isRunning).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("start() is idempotent (calling twice does not spawn two intervals)", () => {
    vi.useFakeTimers();
    try {
      scheduler.start();
      const idBefore = (scheduler as unknown as { intervalId: unknown }).intervalId;
      scheduler.start();
      const idAfter = (scheduler as unknown as { intervalId: unknown }).intervalId;
      expect(idAfter).toBe(idBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tick() updates session minutes after startSession", () => {
    const start = 1000;
    const nowSpy = vi.spyOn(Date, "now");
    try {
      nowSpy.mockReturnValue(start);
      scheduler.start();
      nowSpy.mockReturnValue(start + 1000 * 60 * 3); // 3 minutes later
      scheduler.tick();
      expect(useSessionStore.getState().sessionMinutes).toBe(3);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("tick() fires onRewardDensityShift when the phase changes", () => {
    const onShift = vi.fn();
    scheduler.setHandlers({ onRewardDensityShift: onShift });

    // Force session minutes below the threshold.
    const start = 1000;
    const nowSpy = vi.spyOn(Date, "now");
    try {
      nowSpy.mockReturnValue(start);
      useSessionStore.getState().startSession();
      scheduler.tick();
      expect(onShift).not.toHaveBeenCalled();

      // Now simulate 16 minutes elapsed.
      nowSpy.mockReturnValue(start + 1000 * 60 * 16);
      scheduler.tick();
      expect(onShift).toHaveBeenCalledWith("chase");
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("tick() re-enables the spinning wheel after the cooldown elapses", () => {
    const onWheel = vi.fn();
    scheduler.setHandlers({ onWheelAvailable: onWheel });

    // Make the wheel unavailable with a last spin in the past beyond cooldown.
    useSessionStore.getState().startSession();
    const past = Date.now() - (WHEEL_COOLDOWN_MS + 1000);
    useEconomyStore.setState({
      spinningWheel: {
        available: false,
        lastSpin: past,
        spinCount: 1,
        extraSpins: 0,
        lastSpinNearMiss: false,
      },
    });

    scheduler.tick();
    expect(useEconomyStore.getState().spinningWheel.available).toBe(true);
    expect(onWheel).toHaveBeenCalledTimes(1);
  });

  it("tick() processes due scheduled events and calls onProcessEvent", () => {
    const onProcess = vi.fn();
    scheduler.setHandlers({ onProcessEvent: onProcess });

    useSessionStore.getState().startSession();
    const event = useSessionStore
      .getState()
      .scheduleEvent("phantom-move", -1000); // already due

    scheduler.tick();
    expect(onProcess).toHaveBeenCalledTimes(1);
    expect(onProcess.mock.calls[0]?.[0]?.id).toBe(event.id);
  });

  it("tick() moves phantoms every 2nd tick", () => {
    const moveSpy = vi.spyOn(useSocialStore.getState(), "movePhantoms");
    useSessionStore.getState().startSession();
    // Tick once -> no move yet (odd tick).
    scheduler.tick();
    expect(moveSpy.mock.calls.length).toBe(0);
    // 2nd tick -> phantoms + ambient crowd move.
    scheduler.tick();
    expect(useSocialStore.getState().phantoms.length).toBeGreaterThan(0);
    expect(moveSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    moveSpy.mockRestore();
  });

  it("tick() refreshes the leaderboard at least every 2nd tick (real-time cadence)", () => {
    useSessionStore.getState().startSession();

    // The initial leaderboard (built at store creation) reflects tokens=0.
    const playerRowInitial = useSocialStore
      .getState()
      .leaderboard.find((e) => e.isPlayer);
    expect(playerRowInitial?.tokenCount).toBe(0);

    // Earn tokens AFTER the initial state so the leaderboard is stale until
    // the scheduler refreshes it.
    usePlayerStore.getState().addTokens(15);

    // One tick is NOT guaranteed to refresh (cadence is every 2nd tick), so
    // we tick twice and assert the leaderboard now reflects the live value.
    scheduler.tick();
    scheduler.tick();

    const playerRow = useSocialStore
      .getState()
      .leaderboard.find((e) => e.isPlayer);
    expect(playerRow).toBeDefined();
    expect(playerRow?.tokenCount).toBe(15);
  });

  it("tick() does NOT wait until the 10th tick to refresh the leaderboard", () => {
    useSessionStore.getState().startSession();
    usePlayerStore.getState().addTokens(8);

    // Tick only 3 times (well before the old 10th-tick cadence). The
    // leaderboard must already reflect the new balance.
    for (let i = 0; i < 3; i++) scheduler.tick();

    const playerRow = useSocialStore
      .getState()
      .leaderboard.find((e) => e.isPlayer);
    expect(playerRow?.tokenCount).toBe(8);
  });

  it("tick() expires trial perks", () => {
    usePlayerStore.getState().addPerk({
      id: "expired-trial",
      name: "Old",
      description: "Should be gone",
      type: "trial",
      expiresAt: Date.now() - 1000,
    });
    useSessionStore.getState().startSession();
    scheduler.tick();
    expect(
      usePlayerStore
        .getState()
        .perks.find((p) => p.id === "expired-trial")
    ).toBeUndefined();
  });

  it("reset() stops the scheduler and resets all stores", () => {
    usePlayerStore.getState().addTokens(99);
    scheduler.reset();
    expect(scheduler.isRunning).toBe(false);
    expect(usePlayerStore.getState().tokens).toBe(0);
  });

  it("getEventScheduler returns a shared singleton", () => {
    const a = getEventScheduler();
    const b = getEventScheduler();
    expect(a).toBe(b);
  });

  it("tick() expires background flash sales whose timer reaches zero even without overlay", () => {
    const store = getStoreById("store-bloom")!;
    // Build a sale whose countdown is very short so it expires within the
    // mocked time window. We use buildAndPushSale then manually patch the
    // countdown + createdAt so it's already past expiry.
    const sale = buildAndPushSale(store, null);
    // Set countdown to 1 and createdAt far enough in the past that one
    // synthetic tick has elapsed.
    const past = Date.now() - (SYNTHETIC_TICK_MS + 500);
    useEconomyStore.setState({
      flashSales: [
        {
          ...sale,
          countdownSeconds: 1,
          initialCountdownSeconds: 1,
          createdAt: past,
        },
      ],
    });
    // Overlay is NOT open — this is the blocking scenario.
    expect(useUIStore.getState().activeOverlay).toBe("none");

    useSessionStore.getState().startSession();
    scheduler.tick();

    // Sale should have expired in the background.
    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
  });

  /* --- Scheduler-driven missed-day penalties (VAL-STREAK-005..008,
         VAL-STREAK-016) --- */

  describe("tick() missed-day penalty escalation", () => {
    /**
     * Helper: set up a streak whose lastVisit is `daysAgo` full days before
     * `now`, with `tokens` and optional `tier` / perks. Returns the `now`
     * timestamp so the caller can mock Date.now to it.
     */
    function setupStreakDaysAgo(
      daysAgo: number,
      opts: { tokens?: number; tier?: "bronze" | "silver" | "gold" | "neodymium"; perks?: Perk[] } = {}
    ): number {
      const now = Date.now();
      const lastVisit = now - daysAgo * MS_PER_DAY;
      usePlayerStore.setState((state) => ({
        // tierXP tracks cumulative earned tokens; set it alongside `tokens`
        // so computeDay1Penalty (10% of tierXP) yields the expected penalty.
        tierXP: opts.tokens ?? state.tierXP,
        tokens: opts.tokens ?? state.tokens,
        tier: opts.tier ?? state.tier,
        streak: { ...state.streak, lastVisit, count: 3 },
      }));
      if (opts.perks) {
        for (const perk of opts.perks) {
          usePlayerStore.getState().addPerk(perk);
        }
      }
      return now;
    }

    it("applies no penalty when the visit is same-day (0 days elapsed)", () => {
      const nowSpy = vi.spyOn(Date, "now");
      try {
        const now = setupStreakDaysAgo(0);
        nowSpy.mockReturnValue(now);
        useSessionStore.getState().startSession();

        const onMissedDay = vi.fn();
        scheduler.setHandlers({ onMissedDayPenalty: onMissedDay });
        scheduler.tick();

        expect(onMissedDay).not.toHaveBeenCalled();
        expect(usePlayerStore.getState().streak.missedDays).toBe(0);
        expect(usePlayerStore.getState().streak.broken).toBe(false);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it("applies no penalty for a consecutive-day visit (1 day elapsed)", () => {
      const nowSpy = vi.spyOn(Date, "now");
      try {
        // 1 day elapsed = consecutive visit, NOT a miss.
        const now = setupStreakDaysAgo(1);
        nowSpy.mockReturnValue(now);
        useSessionStore.getState().startSession();

        const onMissedDay = vi.fn();
        scheduler.setHandlers({ onMissedDayPenalty: onMissedDay });
        scheduler.tick();

        expect(onMissedDay).not.toHaveBeenCalled();
        expect(usePlayerStore.getState().streak.missedDays).toBe(0);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it("Day 1 miss triggers token penalty via scheduler (VAL-STREAK-005)", () => {
      const nowSpy = vi.spyOn(Date, "now");
      try {
        // 2 days elapsed = 1 missed day. Give the player 100 tokens so
        // tierXP = 100 and the Day-1 penalty = floor(100 * 0.10) = 10.
        const now = setupStreakDaysAgo(2, { tokens: 100 });
        nowSpy.mockReturnValue(now);
        useSessionStore.getState().startSession();

        const onMissedDay = vi.fn();
        scheduler.setHandlers({ onMissedDayPenalty: onMissedDay });
        scheduler.tick();

        // One penalty applied (Day 1 = token loss).
        expect(onMissedDay).toHaveBeenCalledTimes(1);
        const result = onMissedDay.mock.calls[0]?.[0];
        expect(result.type).toBe("token-loss");
        expect(result.missedDay).toBe(1);
        expect(result.tokensLost).toBe(10);
        // Balance decreased by the penalty.
        expect(usePlayerStore.getState().tokens).toBe(90);
        // Streak marked broken, recovery window opened.
        expect(usePlayerStore.getState().streak.broken).toBe(true);
        expect(usePlayerStore.getState().streak.missedDays).toBe(1);
        expect(usePlayerStore.getState().streak.recoveryWindow).toBe(true);
        // lastStreakPenalty snapshot carries the actual capped loss.
        expect(usePlayerStore.getState().lastStreakPenalty?.tokensLost).toBe(10);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it("Day 2 miss triggers perk loss via scheduler (VAL-STREAK-006)", () => {
      const nowSpy = vi.spyOn(Date, "now");
      try {
        // 3 days elapsed = 2 missed days (Day 1 token loss + Day 2 perk loss).
        const perk: Perk = {
          id: "perk-sched",
          name: "Scheduler Perk",
          description: "To be lost on Day 2",
          type: "earned",
        };
        const now = setupStreakDaysAgo(3, { tokens: 100, perks: [perk] });
        nowSpy.mockReturnValue(now);
        useSessionStore.getState().startSession();

        const onMissedDay = vi.fn();
        scheduler.setHandlers({ onMissedDayPenalty: onMissedDay });
        scheduler.tick();

        // Two penalties applied in order: token loss then perk loss.
        expect(onMissedDay).toHaveBeenCalledTimes(2);
        expect(onMissedDay.mock.calls[0]?.[0]?.type).toBe("token-loss");
        expect(onMissedDay.mock.calls[1]?.[0]?.type).toBe("perk-loss");
        expect(onMissedDay.mock.calls[1]?.[0]?.missedDay).toBe(2);
        // The perk was removed.
        expect(usePlayerStore.getState().perks).toHaveLength(0);
        expect(usePlayerStore.getState().streak.missedDays).toBe(2);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it("Day 3 miss triggers tier demotion via scheduler (VAL-STREAK-007)", () => {
      const nowSpy = vi.spyOn(Date, "now");
      try {
        // 4 days elapsed = 3 missed days (Day 1 + Day 2 + Day 3 demotion).
        const perk: Perk = {
          id: "perk-sched-d3",
          name: "Scheduler Perk D3",
          description: "To be lost on Day 2",
          type: "earned",
        };
        const now = setupStreakDaysAgo(4, { tokens: 100, tier: "gold", perks: [perk] });
        nowSpy.mockReturnValue(now);
        useSessionStore.getState().startSession();

        const onMissedDay = vi.fn();
        scheduler.setHandlers({ onMissedDayPenalty: onMissedDay });
        scheduler.tick();

        // Three penalties applied in escalating order.
        expect(onMissedDay).toHaveBeenCalledTimes(3);
        expect(onMissedDay.mock.calls[0]?.[0]?.type).toBe("token-loss");
        expect(onMissedDay.mock.calls[1]?.[0]?.type).toBe("perk-loss");
        expect(onMissedDay.mock.calls[2]?.[0]?.type).toBe("tier-demotion");
        expect(onMissedDay.mock.calls[2]?.[0]?.missedDay).toBe(3);
        expect(onMissedDay.mock.calls[2]?.[0]?.previousTier).toBe("gold");
        expect(onMissedDay.mock.calls[2]?.[0]?.newTier).toBe("silver");
        // Tier demoted from gold to silver.
        expect(usePlayerStore.getState().tier).toBe("silver");
        expect(usePlayerStore.getState().streak.missedDays).toBe(3);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it("penalty notification caps token loss at actual balance (non-blocking fix)", () => {
      const nowSpy = vi.spyOn(Date, "now");
      try {
        // Player has only 3 tokens but tierXP = 100, so the computed penalty
        // is 10. The actual loss must be capped at 3 (the current balance).
        const now = setupStreakDaysAgo(2, { tokens: 3 });
        // Manually set tierXP to 100 so computeDay1Penalty returns 10.
        usePlayerStore.setState({ tierXP: 100 });
        nowSpy.mockReturnValue(now);
        useSessionStore.getState().startSession();

        const onMissedDay = vi.fn();
        scheduler.setHandlers({ onMissedDayPenalty: onMissedDay });
        scheduler.tick();

        expect(onMissedDay).toHaveBeenCalledTimes(1);
        const result = onMissedDay.mock.calls[0]?.[0];
        expect(result.type).toBe("token-loss");
        // The actual loss is capped at the balance (3), not the computed 10.
        expect(result.tokensLost).toBe(3);
        expect(usePlayerStore.getState().tokens).toBe(0);
        // The snapshot also carries the capped loss.
        expect(usePlayerStore.getState().lastStreakPenalty?.tokensLost).toBe(3);
        expect(usePlayerStore.getState().lastStreakPenalty?.message).toContain("3 tokens");
      } finally {
        nowSpy.mockRestore();
      }
    });

    it("is idempotent across ticks (no double-application)", () => {
      const nowSpy = vi.spyOn(Date, "now");
      try {
        const now = setupStreakDaysAgo(2, { tokens: 100 });
        nowSpy.mockReturnValue(now);
        useSessionStore.getState().startSession();

        const onMissedDay = vi.fn();
        scheduler.setHandlers({ onMissedDayPenalty: onMissedDay });
        scheduler.tick();
        expect(onMissedDay).toHaveBeenCalledTimes(1);

        // Tick again at the same time — no new misses.
        scheduler.tick();
        expect(onMissedDay).toHaveBeenCalledTimes(1);
        expect(usePlayerStore.getState().streak.missedDays).toBe(1);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it("does not apply penalties when the streak is protected (VAL-EXIT-028)", () => {
      const nowSpy = vi.spyOn(Date, "now");
      try {
        const now = setupStreakDaysAgo(2, { tokens: 100 });
        usePlayerStore.getState().activateStreakProtection();
        nowSpy.mockReturnValue(now);
        useSessionStore.getState().startSession();

        const onMissedDay = vi.fn();
        scheduler.setHandlers({ onMissedDayPenalty: onMissedDay });
        scheduler.tick();

        expect(onMissedDay).not.toHaveBeenCalled();
        expect(usePlayerStore.getState().streak.missedDays).toBe(0);
        expect(usePlayerStore.getState().streak.broken).toBe(false);
        expect(usePlayerStore.getState().tokens).toBe(100);
      } finally {
        nowSpy.mockRestore();
      }
    });
  });
});
