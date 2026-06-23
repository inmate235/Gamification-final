/**
 * Cross-Area Integration Tests
 *
 * Tests the cross-feature flows enumerated in the validation contract
 * (VAL-CROSS-001..075) at the store/engine level. These tests verify that
 * all systems work together: onboarding -> mall entry, token economy loop,
 * tier progression, exit friction cycle, engagement loop compounding,
 * spinning wheel -> token deficit, survey personalization, streak -> exit
 * friction, first-5-minutes Day 1 script, navigation reachability, and
 * cross-cutting invariants (deficit recalculation, overlay data matching,
 * store composability, event scheduler integration).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useTaskStore } from "@/stores/taskStore";
import { useEconomyStore } from "@/stores/economyStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSocialStore } from "@/stores/socialStore";
import { useUIStore } from "@/stores/uiStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import {
  resetEventSchedulerSingleton,
  getEventScheduler,
} from "@/engine/EventScheduler";
import { checkForTierUpgrade } from "@/engine/tierEngine";
import {
  initiateExit,
  stayInMall,
  leaveAnyway,
  acceptRescueBargain,
  buildExitFrictionData,
} from "@/engine/exitFrictionEngine";
import {
  triggerProximityFlashSale,
  getPreferredCategory,
  resetFlashSaleEngine,
  buildAndPushSale,
} from "@/engine/flashSaleEngine";
import {
  onPlayerEnterZone,
  onZoneRevealed,
} from "@/engine/taskEngine";
import { awardWheelReward } from "@/engine/tokenEconomy";
import { resetPhantomEngine } from "@/engine/phantomEngine";
import { generateTask } from "@/engine/taskGenerator";
import { classifyBartleType } from "@/lib/bartle";
import { calculateExploration } from "@/stores/mapStore";
import {
  ZONE_ENTRANCE,
  ZONE_EAST_WING,
  ZONE_WEST_WING,
  ZONE_CENTRAL_PLAZA,
  ZONE_FOOD_COURT,
  EXPLORE_REWARD,
  storesByZone,
} from "@/data/mallData";
import { TIER_THRESHOLDS } from "@/data/tierData";

/* ============================================================================
   Helpers
   ========================================================================== */

function resetAllStores() {
  usePlayerStore.getState().reset();
  useMapStore.getState().reset();
  useTaskStore.getState().reset();
  useEconomyStore.getState().reset();
  useSessionStore.getState().reset();
  useSocialStore.getState().reset();
  useUIStore.getState().reset();
  useOnboardingStore.getState().reset();
  resetFlashSaleEngine();
  resetPhantomEngine();
  resetEventSchedulerSingleton();
}

/** Simulate completing the full onboarding flow (invite -> survey -> mall). */
function completeOnboarding(surveyAnswers?: Record<string, string>) {
  const answers = surveyAnswers ?? {
    style: "bold",
    social: "solo",
    motivation: "discovery",
  };
  useOnboardingStore.getState().advanceToSurvey();
  usePlayerStore.getState().setSurveyAnswers(answers);
  const bartleType = classifyBartleType(answers);
  if (bartleType) usePlayerStore.getState().setBartleType(bartleType);
  usePlayerStore.getState().grantOnboardingTrialPerks();
  useOnboardingStore.getState().advanceToMall();
}

/** Reveal a zone and trigger the token/task hooks (simulates MallMap click). */
function revealZoneWithHooks(zoneId: string) {
  const wasFogged = !useMapStore.getState().fogState[zoneId];
  const ok = useMapStore.getState().moveToZone(zoneId);
  if (!ok) return false;
  if (wasFogged) {
    usePlayerStore.getState().awardTokens(EXPLORE_REWARD);
    onZoneRevealed(zoneId);
    onPlayerEnterZone(zoneId);
  } else {
    onPlayerEnterZone(zoneId);
  }
  return true;
}

/* ============================================================================
   Test suite
   ========================================================================== */

describe("Cross-Area Integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAllStores();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /* ======================================================================
     Flow 1: Full Onboarding to Mall Entry (VAL-CROSS-001..006)
     ====================================================================== */

  describe("Flow 1: Full Onboarding to Mall Entry", () => {
    it("completes invite -> survey -> mall with state propagation", () => {
      completeOnboarding();

      expect(useOnboardingStore.getState().onboardingStep).toBe("mall");
      expect(usePlayerStore.getState().surveyAnswers.style).toBe("bold");
      expect(usePlayerStore.getState().bartleType).not.toBeNull();
      // Trial perks granted at onboarding (VAL-TIER-013)
      expect(usePlayerStore.getState().trialPerks.length).toBeGreaterThan(0);
    });

    it("mall initial state shows fogged map with only entrance revealed", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      const fog = useMapStore.getState().fogState;
      expect(fog[ZONE_ENTRANCE]).toBe(true);
      expect(fog[ZONE_EAST_WING]).toBe(false);
      expect(fog[ZONE_WEST_WING]).toBe(false);
      expect(fog[ZONE_CENTRAL_PLAZA]).toBe(false);
      expect(fog[ZONE_FOOD_COURT]).toBe(false);
    });

    it("status bar initial state: 0 tokens, bronze tier, day 1 streak", () => {
      completeOnboarding();

      const player = usePlayerStore.getState();
      expect(player.tokens).toBe(0);
      expect(player.tier).toBe("bronze");
      expect(player.streak.count).toBe(1);
    });

    it("survey answers and bartleType propagate to all engines", () => {
      completeOnboarding({ style: "cozy", social: "friends", motivation: "deals" });

      const player = usePlayerStore.getState();
      expect(player.surveyAnswers.style).toBe("cozy");
      expect(player.surveyAnswers.motivation).toBe("deals");
      expect(player.bartleType).not.toBeNull();

      // Flash sale engine can read the preferred category
      const preferred = getPreferredCategory(player.surveyAnswers);
      expect(preferred).toBe("food"); // cozy -> food
    });

    it("first zone reveal awards tokens and updates progress bar", () => {
      completeOnboarding();
      const beforeTokens = usePlayerStore.getState().tokens;
      const beforeProgress = useMapStore.getState().explorationPercent;

      revealZoneWithHooks(ZONE_EAST_WING);

      const afterTokens = usePlayerStore.getState().tokens;
      const afterProgress = useMapStore.getState().explorationPercent;

      expect(afterTokens).toBeGreaterThan(beforeTokens);
      expect(afterProgress).toBeGreaterThan(beforeProgress);
    });
  });

  /* ======================================================================
     Flow 2: Token Economy Loop (VAL-CROSS-007..012)
     ====================================================================== */

  describe("Flow 2: Token Economy Loop", () => {
    it("zone exploration awards tokens", () => {
      completeOnboarding();
      const before = usePlayerStore.getState().tokens;

      revealZoneWithHooks(ZONE_EAST_WING);

      expect(usePlayerStore.getState().tokens).toBeGreaterThan(before);
    });

    it("task completion awards tokens and auto-generates next task", () => {
      completeOnboarding();
      // Reveal a zone to get some tokens and trigger task hooks
      revealZoneWithHooks(ZONE_EAST_WING);

      // Find an explore-zone task and complete it by entering its target zone
      const exploreTask = useTaskStore.getState().activeTasks.find(
        (t) => t.type === "explore-zone"
      );
      if (exploreTask?.targetZone) {
        // Move to the target zone if adjacent, or use onPlayerEnterZone directly
        onPlayerEnterZone(exploreTask.targetZone);
      }

      // Task list should never be empty
      expect(useTaskStore.getState().activeTasks.length).toBeGreaterThan(0);
    });

    it("flash sale token cost is 2-3 above current balance (deficit)", () => {
      completeOnboarding();
      // Earn some tokens first
      revealZoneWithHooks(ZONE_EAST_WING);
      const balance = usePlayerStore.getState().tokens;

      // Trigger a flash sale
      const store = storesByZone[ZONE_EAST_WING]?.[0];
      expect(store).toBeDefined();
      const sale = buildAndPushSale(store!, null);
      expect(sale.tokenCost).toBeGreaterThanOrEqual(balance + 2);
      expect(sale.tokenCost).toBeLessThanOrEqual(balance + 3);
    });

    it("deficit is maintained after earning more tokens (new sale)", () => {
      completeOnboarding();
      revealZoneWithHooks(ZONE_EAST_WING);

      const balance1 = usePlayerStore.getState().tokens;
      const store1 = storesByZone[ZONE_EAST_WING]![0]!;
      const sale1 = buildAndPushSale(store1, null);
      expect(sale1.tokenCost).toBeGreaterThanOrEqual(balance1 + 2);

      // Earn more tokens — go back through entrance to West Wing
      useMapStore.getState().moveToZone(ZONE_ENTRANCE);
      revealZoneWithHooks(ZONE_WEST_WING);
      const balance2 = usePlayerStore.getState().tokens;
      expect(balance2).toBeGreaterThan(balance1);

      // New sale should be deficit-priced relative to new balance
      const store2 = storesByZone[ZONE_WEST_WING]![0]!;
      const sale2 = buildAndPushSale(store2, null);
      expect(sale2.tokenCost).toBeGreaterThanOrEqual(balance2 + 2);
      expect(sale2.tokenCost).toBeLessThanOrEqual(balance2 + 3);
    });

    it("full cycle: explore -> earn -> task -> earn -> deficit -> re-explore", () => {
      completeOnboarding();

      // 1. Explore (earn)
      revealZoneWithHooks(ZONE_EAST_WING);
      const tokensAfterExplore = usePlayerStore.getState().tokens;
      expect(tokensAfterExplore).toBeGreaterThan(0);

      // 2. Task appears (never empty)
      expect(useTaskStore.getState().activeTasks.length).toBeGreaterThan(0);

      // 3. Flash sale appears priced above balance (deficit)
      const store = storesByZone[ZONE_EAST_WING]![0]!;
      const sale = buildAndPushSale(store, null);
      expect(sale.tokenCost).toBeGreaterThan(usePlayerStore.getState().tokens);

      // 4. Cannot afford (deficit)
      const canAfford = usePlayerStore.getState().tokens >= sale.tokenCost;
      expect(canAfford).toBe(false);

      // 5. Re-explore to earn more (go through entrance to West Wing)
      useMapStore.getState().moveToZone(ZONE_ENTRANCE);
      revealZoneWithHooks(ZONE_WEST_WING);
      expect(usePlayerStore.getState().tokens).toBeGreaterThan(tokensAfterExplore);
    });

    it("spending on shortcut re-establishes deficit for next offer", () => {
      completeOnboarding();
      // Earn enough to afford a shortcut
      revealZoneWithHooks(ZONE_EAST_WING);
      revealZoneWithHooks(ZONE_WEST_WING);
      revealZoneWithHooks(ZONE_CENTRAL_PLAZA);

      // Give enough tokens to afford the shortcut
      const shortcut = useEconomyStore.getState().getActiveShortcut();
      expect(shortcut).not.toBeNull();
      const cost = shortcut!.tokenCost;

      // Add tokens to afford it
      usePlayerStore.getState().addTokens(cost - usePlayerStore.getState().tokens);
      const balanceBefore = usePlayerStore.getState().tokens;
      expect(balanceBefore).toBeGreaterThanOrEqual(cost);

      // Unlock the shortcut
      const ok = useEconomyStore.getState().unlockShortcut(shortcut!.id);
      expect(ok).toBe(true);

      // Balance decreased
      const balanceAfter = usePlayerStore.getState().tokens;
      expect(balanceAfter).toBeLessThan(balanceBefore);

      // Next shortcut should be deficit-priced relative to new balance
      const nextShortcut = useEconomyStore.getState().getActiveShortcut();
      if (nextShortcut) {
        expect(nextShortcut.tokenCost).toBeGreaterThanOrEqual(balanceAfter + 2);
        expect(nextShortcut.tokenCost).toBeLessThanOrEqual(balanceAfter + 3);
      }
    });
  });

  /* ======================================================================
     Flow 3: Tier Progression (VAL-CROSS-013..018)
     ====================================================================== */

  describe("Flow 3: Tier Progression Flow", () => {
    it("token accumulation drives tierXP and triggers Silver upgrade", () => {
      completeOnboarding();
      expect(usePlayerStore.getState().tier).toBe("bronze");

      // Earn enough tokens to reach Silver threshold (12 tierXP)
      const silverThreshold = TIER_THRESHOLDS.silver;
      usePlayerStore.getState().addTokens(silverThreshold);

      // Check for tier upgrade
      const promoted = checkForTierUpgrade();
      expect(promoted).toBe("silver");
      expect(usePlayerStore.getState().tier).toBe("silver");

      // Celebration overlay should be shown
      expect(useUIStore.getState().activeOverlay).toBe("tier-upgrade");
    });

    it("tier upgrade increases earn rate multiplier", () => {
      completeOnboarding();

      // Bronze: 1x multiplier
      usePlayerStore.getState().addTokens(0); // no change
      const bronzeReward = usePlayerStore.getState().awardTokens(4);
      expect(bronzeReward).toBe(4); // 4 * 1 = 4

      // Promote to Silver
      usePlayerStore.getState().addTokens(TIER_THRESHOLDS.silver);
      checkForTierUpgrade();
      useUIStore.getState().hideOverlay();
      expect(usePlayerStore.getState().tier).toBe("silver");

      // Silver: 1.5x multiplier
      const silverReward = usePlayerStore.getState().awardTokens(4);
      expect(silverReward).toBe(6); // 4 * 1.5 = 6
    });

    it("status bar tier matches playerStore after upgrade", () => {
      completeOnboarding();

      usePlayerStore.getState().addTokens(TIER_THRESHOLDS.silver);
      checkForTierUpgrade();

      expect(usePlayerStore.getState().tier).toBe("silver");
    });

    it("tier and perks persist across overlay open/close", () => {
      completeOnboarding();
      usePlayerStore.getState().addTokens(TIER_THRESHOLDS.silver);
      checkForTierUpgrade();
      expect(usePlayerStore.getState().tier).toBe("silver");

      // Open and close various overlays
      useUIStore.getState().showOverlay("store-detail", { id: "test" });
      useUIStore.getState().hideOverlay();
      useUIStore.getState().showOverlay("celebration", { message: "test" });
      useUIStore.getState().hideOverlay();

      // Tier should still be silver
      expect(usePlayerStore.getState().tier).toBe("silver");
    });
  });

  /* ======================================================================
     Flow 4: Exit Attempt Full Cycle (VAL-CROSS-019..025)
     ====================================================================== */

  describe("Flow 4: Exit Attempt Full Cycle", () => {
    it("first leave click shows Layer 1 (missed deals)", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      const layer = initiateExit();
      expect(layer).toBe(1);
      expect(useUIStore.getState().activeOverlay).toBe("exit-friction");
      const data = useUIStore.getState().overlayData as { layer: number };
      expect(data.layer).toBe(1);
    });

    it("Layer 1 is dismissible (stay returns to mall)", () => {
      completeOnboarding();
      initiateExit();

      stayInMall();

      expect(useUIStore.getState().activeOverlay).toBe("none");
      expect(useSessionStore.getState().exitAttempts).toBe(0);
    });

    it("second leave click shows Layer 2 (streak/sunk cost)", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      initiateExit(); // Layer 1
      leaveAnyway(); // advance
      expect(useSessionStore.getState().exitFrictionLayer).toBe(2);
      expect(useUIStore.getState().activeOverlay).toBe("exit-friction");
    });

    it("third leave click shows Layer 3 (rescue bargain)", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      initiateExit(); // Layer 1
      leaveAnyway(); // -> Layer 2
      leaveAnyway(); // -> Layer 3
      expect(useSessionStore.getState().exitFrictionLayer).toBe(3);
    });

    it("accepting rescue bargain keeps user in mall and triggers bonus wheel", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      initiateExit();
      leaveAnyway();
      leaveAnyway(); // Layer 3

      acceptRescueBargain();

      expect(useUIStore.getState().activeOverlay).toBe("none");
      expect(useSessionStore.getState().exitAttempts).toBe(0);
      // Bonus wheel should be available
      expect(useEconomyStore.getState().spinningWheel.available).toBe(true);
      // Streak protection active
      expect(usePlayerStore.getState().streak.streakProtected).toBe(true);
      // Rescue boost active
      expect(usePlayerStore.getState().rescueBoost).not.toBeNull();
      expect(usePlayerStore.getState().rescueBoost?.active).toBe(true);
    });

    it("exit attempts reset after staying", () => {
      completeOnboarding();
      initiateExit();
      stayInMall();
      expect(useSessionStore.getState().exitAttempts).toBe(0);

      // Next leave attempt starts at Layer 1 again
      const layer = initiateExit();
      expect(layer).toBe(1);
    });

    it("Layer 2 shows streak count matching playerStore", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();
      usePlayerStore.getState().incrementStreak(); // Day 2
      usePlayerStore.getState().incrementStreak(); // Day 3

      initiateExit();
      leaveAnyway(); // -> Layer 2

      const data = useUIStore.getState().overlayData as { layer: number; streakCount: number };
      expect(data.layer).toBe(2);
      expect(data.streakCount).toBe(usePlayerStore.getState().streak.count);
    });

    it("leave anyway on Layer 3 actually exits and resets state", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      initiateExit();
      leaveAnyway();
      leaveAnyway(); // Layer 3
      const result = leaveAnyway(); // actually leave

      expect(result).toBe("left");
      expect(useSessionStore.getState().exited).toBe(true);
      expect(useSessionStore.getState().exitAttempts).toBe(0);
    });
  });

  /* ======================================================================
     Flow 5: Engagement Loop Compounding (VAL-CROSS-026..031)
     ====================================================================== */

  describe("Flow 5: Engagement Loop Compounding", () => {
    it("multiple loops coexist: tasks + flash sale + wheel + progress", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      // Explore to get tokens and tasks
      revealZoneWithHooks(ZONE_EAST_WING);
      revealZoneWithHooks(ZONE_WEST_WING);

      // Create a flash sale
      const store = storesByZone[ZONE_EAST_WING]![0]!;
      buildAndPushSale(store, null);

      // Make wheel available
      useEconomyStore.getState().makeWheelAvailable();

      // All states coexist
      expect(useTaskStore.getState().activeTasks.length).toBeGreaterThan(0);
      expect(useEconomyStore.getState().flashSales.length).toBeGreaterThan(0);
      expect(useEconomyStore.getState().spinningWheel.available).toBe(true);
      expect(useMapStore.getState().explorationPercent).toBeGreaterThan(0);
    });

    it("interacting with one loop does not break others", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      revealZoneWithHooks(ZONE_EAST_WING);
      const store = storesByZone[ZONE_EAST_WING]![0]!;
      const sale = buildAndPushSale(store, null);
      const saleCountdownBefore = sale.countdownSeconds;

      // Complete a task (interact with task loop)
      const exploreTask = useTaskStore.getState().activeTasks.find(
        (t) => t.type === "explore-zone"
      );
      if (exploreTask?.targetZone) {
        onPlayerEnterZone(exploreTask.targetZone);
      }

      // Flash sale should still exist (not destroyed by task interaction)
      const sales = useEconomyStore.getState().flashSales;
      const survivingSale = sales.find((s) => s.id === sale.id);
      expect(survivingSale).toBeDefined();
      expect(survivingSale!.countdownSeconds).toBe(saleCountdownBefore);
    });

    it("task completion feeds token deficit loop", () => {
      completeOnboarding();
      revealZoneWithHooks(ZONE_EAST_WING);

      const balanceBefore = usePlayerStore.getState().tokens;

      // Complete a task
      const exploreTask = useTaskStore.getState().activeTasks.find(
        (t) => t.type === "explore-zone"
      );
      if (exploreTask?.targetZone) {
        onPlayerEnterZone(exploreTask.targetZone);
      }

      const balanceAfter = usePlayerStore.getState().tokens;
      // If a task was completed, tokens should have increased
      if (balanceAfter > balanceBefore) {
        // New flash sale should be deficit-priced relative to new balance
        const store = storesByZone[ZONE_EAST_WING]![0]!;
        const newSale = buildAndPushSale(store, null);
        expect(newSale.tokenCost).toBeGreaterThanOrEqual(balanceAfter + 2);
      }
    });

    it("wheel availability persists alongside task list", () => {
      completeOnboarding();
      useEconomyStore.getState().makeWheelAvailable();

      // Tasks should still be active
      expect(useTaskStore.getState().activeTasks.length).toBeGreaterThan(0);
      expect(useEconomyStore.getState().spinningWheel.available).toBe(true);
    });
  });

  /* ======================================================================
     Flow 6: Spinning Wheel to Token Deficit (VAL-CROSS-032..036)
     ====================================================================== */

  describe("Flow 6: Spinning Wheel to Token Deficit", () => {
    it("wheel becomes available and can award tokens", () => {
      completeOnboarding();
      const balanceBefore = usePlayerStore.getState().tokens;

      // Award a wheel reward
      const credited = awardWheelReward(5);
      expect(credited).toBeGreaterThan(0);
      expect(usePlayerStore.getState().tokens).toBeGreaterThan(balanceBefore);
    });

    it("post-spin flash sale is priced above new balance (deficit)", () => {
      completeOnboarding();
      awardWheelReward(5);

      const balance = usePlayerStore.getState().tokens;
      const store = storesByZone[ZONE_ENTRANCE]![0]!;
      const sale = buildAndPushSale(store, null);

      expect(sale.tokenCost).toBeGreaterThanOrEqual(balance + 2);
      expect(sale.tokenCost).toBeLessThanOrEqual(balance + 3);
    });

    it("post-spin deficit persists until further earning", () => {
      completeOnboarding();
      awardWheelReward(3);

      const store = storesByZone[ZONE_ENTRANCE]![0]!;
      const sale = buildAndPushSale(store, null);

      // User cannot afford the sale
      expect(usePlayerStore.getState().tokens).toBeLessThan(sale.tokenCost);
    });
  });

  /* ======================================================================
     Flow 7: Survey Personalization Impact (VAL-CROSS-037..041)
     ====================================================================== */

  describe("Flow 7: Survey Personalization Impact", () => {
    it("food preference routes flash sales to food court stores", () => {
      completeOnboarding({ style: "cozy", social: "friends", motivation: "deals" });

      const preferred = getPreferredCategory(
        usePlayerStore.getState().surveyAnswers
      );
      expect(preferred).toBe("food");
    });

    it("tech preference routes flash sales to tech stores", () => {
      completeOnboarding({ style: "bold", social: "solo", motivation: "deals" });

      const preferred = getPreferredCategory(
        usePlayerStore.getState().surveyAnswers
      );
      expect(preferred).toBe("tech");
    });

    it("fashion preference routes flash sales to fashion stores", () => {
      completeOnboarding({ style: "classic", social: "friends", motivation: "deals" });

      const preferred = getPreferredCategory(
        usePlayerStore.getState().surveyAnswers
      );
      expect(preferred).toBe("fashion");
    });

    it("discovery motivation frames tasks as discoveries", () => {
      completeOnboarding({ style: "trendy", social: "solo", motivation: "discovery" });

      // Generate a task and check its description is discovery-framed
      const task = generateTask({
        chainLevel: 1,
        revealedZoneIds: new Set([ZONE_ENTRANCE, ZONE_EAST_WING]),
      });

      // Discovery-framed tasks should use "Discover" or "Explore" language
      expect(task.description).toMatch(/discover|explore|find|hidden|secret/i);
    });

    it("deals motivation frames tasks transactionally", () => {
      completeOnboarding({ style: "bold", social: "friends", motivation: "deals" });

      const task = generateTask({
        chainLevel: 1,
        revealedZoneIds: new Set([ZONE_ENTRANCE, ZONE_EAST_WING]),
      });

      // Deals-framed tasks should use deal/hunt/grab language
      expect(task.description).toMatch(/deal|hunt|grab|claim|shop|visit/i);
    });

    it("survey data propagates to economy, task, and social engines", () => {
      completeOnboarding({ style: "cozy", social: "solo", motivation: "discovery" });

      const player = usePlayerStore.getState();
      // Economy engine reads surveyAnswers for personalization
      expect(getPreferredCategory(player.surveyAnswers)).toBe("food");
      // Task engine reads surveyAnswers for framing
      expect(player.surveyAnswers.motivation).toBe("discovery");
      // Social engine reads bartleType
      expect(player.bartleType).not.toBeNull();
    });

    it("non-food preference does not route sales to food court", () => {
      completeOnboarding({ style: "bold", social: "solo", motivation: "deals" });

      const preferred = getPreferredCategory(
        usePlayerStore.getState().surveyAnswers
      );
      expect(preferred).not.toBe("food");
      expect(preferred).toBe("tech");
    });
  });

  /* ======================================================================
     Flow 8: Streak to Exit Friction Interaction (VAL-CROSS-042..046)
     ====================================================================== */

  describe("Flow 8: Streak to Exit Friction Interaction", () => {
    it("streak count is reflected in player store", () => {
      completeOnboarding();
      usePlayerStore.getState().incrementStreak();
      usePlayerStore.getState().incrementStreak();

      expect(usePlayerStore.getState().streak.count).toBe(3);
    });

    it("exit Layer 2 references current streak count", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();
      usePlayerStore.getState().incrementStreak(); // Day 2
      usePlayerStore.getState().incrementStreak(); // Day 3

      initiateExit();
      leaveAnyway(); // -> Layer 2

      const data = useUIStore.getState().overlayData as { layer: number; streakCount: number };
      expect(data.layer).toBe(2);
      expect(data.streakCount).toBe(3);
      expect(data.streakCount).toBe(usePlayerStore.getState().streak.count);
    });

    it("accepting rescue bargain activates streak protection", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      initiateExit();
      leaveAnyway();
      leaveAnyway(); // Layer 3
      acceptRescueBargain();

      expect(usePlayerStore.getState().streak.streakProtected).toBe(true);
    });

    it("streak protection prevents streak break", () => {
      completeOnboarding();
      usePlayerStore.getState().activateStreakProtection();

      // Attempt to break the streak — should be a no-op
      usePlayerStore.getState().breakStreak();

      expect(usePlayerStore.getState().streak.broken).toBe(false);
    });
  });

  /* ======================================================================
     Flow 9: First 5 Minutes Day 1 Script (VAL-CROSS-047..053)
     ====================================================================== */

  describe("Flow 9: First 5 Minutes Day 1 Script", () => {
    it("onboarding completes and mall loads with fogged map", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      // Map should show only entrance visible
      const fog = useMapStore.getState().fogState;
      const revealedCount = Object.values(fog).filter(Boolean).length;
      expect(revealedCount).toBe(1); // only entrance
    });

    it("first zone reveal awards first token", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      const before = usePlayerStore.getState().tokens;
      revealZoneWithHooks(ZONE_EAST_WING);

      expect(usePlayerStore.getState().tokens).toBeGreaterThan(before);
    });

    it("breadcrumb task appears after first reveal", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      // Task list should already have initial tasks
      expect(useTaskStore.getState().activeTasks.length).toBeGreaterThan(0);

      revealZoneWithHooks(ZONE_EAST_WING);

      // Task list should still have tasks (never empty)
      expect(useTaskStore.getState().activeTasks.length).toBeGreaterThan(0);
    });

    it("phantom data is present in social store for map display", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      // Phantoms should exist in the social store
      expect(useSocialStore.getState().phantoms.length).toBeGreaterThan(0);

      // Each phantom should have a position (for map rendering)
      for (const phantom of useSocialStore.getState().phantoms) {
        expect(phantom.position).toBeDefined();
        expect(phantom.position.zoneId).toBeDefined();
        expect(phantom.currentAction).toBeDefined();
      }
    });

    it("full first-5-minutes sequence is non-blocking", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      // 1. Map is fogged
      expect(useMapStore.getState().fogState[ZONE_EAST_WING]).toBe(false);

      // 2. First reveal awards tokens
      revealZoneWithHooks(ZONE_EAST_WING);
      expect(usePlayerStore.getState().tokens).toBeGreaterThan(0);

      // 3. Tasks are present
      expect(useTaskStore.getState().activeTasks.length).toBeGreaterThan(0);

      // 4. Phantoms are present
      expect(useSocialStore.getState().phantoms.length).toBeGreaterThan(0);

      // 5. Flash sale can be triggered
      const store = storesByZone[ZONE_EAST_WING]![0]!;
      const sale = buildAndPushSale(store, null);
      expect(sale).toBeDefined();
      expect(sale.countdownSeconds).toBeGreaterThan(0);
    });
  });

  /* ======================================================================
     Flow 10: Navigation Reachability & Store Composability (VAL-CROSS-054..065)
     ====================================================================== */

  describe("Flow 10: Navigation Reachability & Store Composability", () => {
    it("all overlay types can be shown from mall without page reload", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      const overlayTypes = [
        "store-detail",
        "flash-sale",
        "spinning-wheel",
        "tier-upgrade",
        "exit-friction",
        "celebration",
        "shortcut-unlock",
        "leaderboard",
      ] as const;

      for (const type of overlayTypes) {
        useUIStore.getState().showOverlay(type, { test: true });
        expect(useUIStore.getState().activeOverlay).toBe(type);
        useUIStore.getState().hideOverlay();
        expect(useUIStore.getState().activeOverlay).toBe("none");
      }
    });

    it("only one overlay active at a time (no stacking)", () => {
      completeOnboarding();

      useUIStore.getState().showOverlay("flash-sale", { id: "sale1" });
      expect(useUIStore.getState().activeOverlay).toBe("flash-sale");

      // Opening a second overlay replaces the first
      useUIStore.getState().showOverlay("store-detail", { id: "store1" });
      expect(useUIStore.getState().activeOverlay).toBe("store-detail");
      expect(useUIStore.getState().overlayData).toEqual({ id: "store1" });
    });

    it("map state survives overlay open/close (no reset)", () => {
      completeOnboarding();
      revealZoneWithHooks(ZONE_EAST_WING);

      const fogBefore = { ...useMapStore.getState().fogState };
      const posBefore = { ...useMapStore.getState().playerPosition };
      const progressBefore = useMapStore.getState().explorationPercent;

      useUIStore.getState().showOverlay("store-detail", { id: "test" });
      useUIStore.getState().hideOverlay();

      expect(useMapStore.getState().fogState).toEqual(fogBefore);
      expect(useMapStore.getState().playerPosition).toEqual(posBefore);
      expect(useMapStore.getState().explorationPercent).toBe(progressBefore);
    });

    it("stores remain composable and independent", () => {
      completeOnboarding();
      const phantomsBefore = useSocialStore.getState().phantoms.length;
      const tasksBefore = useTaskStore.getState().activeTasks.length;

      // Update map store only
      useMapStore.getState().moveToZone(ZONE_EAST_WING);

      // Other stores should be unaffected (except via intentional hooks)
      expect(useSocialStore.getState().phantoms.length).toBe(phantomsBefore);
      expect(useTaskStore.getState().activeTasks.length).toBe(tasksBefore);
    });

    it("bottom panel can toggle expanded/collapsed", () => {
      completeOnboarding();
      const before = useUIStore.getState().bottomPanelExpanded;

      useUIStore.getState().toggleBottomPanel();
      expect(useUIStore.getState().bottomPanelExpanded).toBe(!before);

      useUIStore.getState().toggleBottomPanel();
      expect(useUIStore.getState().bottomPanelExpanded).toBe(before);
    });

    it("leaderboard does not reset game state", () => {
      completeOnboarding();
      revealZoneWithHooks(ZONE_EAST_WING);

      const tokensBefore = usePlayerStore.getState().tokens;
      const tasksBefore = useTaskStore.getState().activeTasks.length;
      const progressBefore = useMapStore.getState().explorationPercent;

      useUIStore.getState().showOverlay("leaderboard", null);
      useUIStore.getState().hideOverlay();

      expect(usePlayerStore.getState().tokens).toBe(tokensBefore);
      expect(useTaskStore.getState().activeTasks.length).toBe(tasksBefore);
      expect(useMapStore.getState().explorationPercent).toBe(progressBefore);
    });
  });

  /* ======================================================================
     Cross-Cutting Integration (VAL-CROSS-061..075)
     ====================================================================== */

  describe("Cross-Cutting Integration", () => {
    it("deficit pricing recalculates on every token balance change", () => {
      completeOnboarding();

      const price1 = useEconomyStore.getState().liveDeficitPrice;
      const balance1 = usePlayerStore.getState().tokens;
      expect(price1).toBeGreaterThanOrEqual(balance1 + 2);
      expect(price1).toBeLessThanOrEqual(balance1 + 3);

      // Earn tokens
      usePlayerStore.getState().addTokens(5);

      // Recalculate
      useEconomyStore.getState().refreshLiveDeficitPrice();
      const price2 = useEconomyStore.getState().liveDeficitPrice;
      const balance2 = usePlayerStore.getState().tokens;
      expect(price2).toBeGreaterThanOrEqual(balance2 + 2);
      expect(price2).toBeLessThanOrEqual(balance2 + 3);
    });

    it("event scheduler drives all time-based loops from a single tick", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      const scheduler = getEventScheduler({});
      scheduler.start();

      // Advance time by a few seconds
      vi.advanceTimersByTime(3000);

      // Session minutes should update (via tick)
      // Reward density should be hook phase (< 15 min)
      expect(useEconomyStore.getState().rewardDensity.phase).toBe("hook");

      scheduler.stop();
      resetEventSchedulerSingleton();
    });

    it("reward density phase transition at 15 minutes", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      // Before 15 minutes
      useEconomyStore.getState().updateRewardDensity(10);
      expect(useEconomyStore.getState().rewardDensity.phase).toBe("hook");

      // At 15 minutes
      useEconomyStore.getState().updateRewardDensity(15);
      expect(useEconomyStore.getState().rewardDensity.phase).toBe("chase");

      // After 15 minutes
      useEconomyStore.getState().updateRewardDensity(30);
      expect(useEconomyStore.getState().rewardDensity.phase).toBe("chase");
    });

    it("overlay data payload matches the triggering context", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      // Exit friction overlay data
      initiateExit();
      const exitData = useUIStore.getState().overlayData as { layer: number };
      expect(exitData.layer).toBe(1);
      expect(exitData).toHaveProperty("missedSales");
      expect(exitData).toHaveProperty("explorationPercent");
      expect(exitData).toHaveProperty("sunkCost");
      expect(exitData).toHaveProperty("friendsInside");
      expect(exitData).toHaveProperty("bargain");
      useUIStore.getState().hideOverlay();

      // Tier upgrade overlay data
      usePlayerStore.getState().addTokens(TIER_THRESHOLDS.silver);
      checkForTierUpgrade();
      const tierData = useUIStore.getState().overlayData as { newTier: string };
      expect(tierData.newTier).toBe("silver");
    });

    it("exit friction weaponizes all loop state as sunk cost", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();
      revealZoneWithHooks(ZONE_EAST_WING);
      revealZoneWithHooks(ZONE_WEST_WING);

      // Create a flash sale
      const store = storesByZone[ZONE_EAST_WING]![0]!;
      buildAndPushSale(store, null);

      const data = buildExitFrictionData(2);

      // Sunk cost should aggregate from all loops
      expect(data.sunkCost.cumulativeTokensEarned).toBe(usePlayerStore.getState().tierXP);
      expect(data.sunkCost.timeSpentMinutes).toBe(useSessionStore.getState().sessionMinutes);
      expect(data.sunkCost.explorationPercent).toBe(useMapStore.getState().explorationPercent);
      expect(data.sunkCost.perksUnlocked).toBe(
        usePlayerStore.getState().perks.length +
        usePlayerStore.getState().trialPerks.length
      );
      expect(data.sunkCost.tasksCompleted).toBe(useTaskStore.getState().completedTasks.length);
      expect(data.sunkCost.leaderboardRank).toBeGreaterThan(0);
      expect(data.friendsInside.length).toBeGreaterThan(0);
      expect(data.missedSales.length).toBeGreaterThan(0);
    });

    it("task chain escalates difficulty and reward", () => {
      completeOnboarding();

      // Verify chain level escalation: each generated task at chainLevel N+1
      // has chainLevel >= the previous. The reward formula is
      // baseReward + chainLevel, so for the same template type the reward
      // increases with chain level.
      const chainLevels: number[] = [];

      for (let i = 0; i < 5; i++) {
        const task = useTaskStore.getState().generateNextTask(i + 1);
        chainLevels.push(task.chainLevel);
      }

      // Chain levels should be strictly increasing (1, 2, 3, 4, 5)
      for (let i = 1; i < chainLevels.length; i++) {
        expect(chainLevels[i]).toBeGreaterThan(chainLevels[i - 1]);
      }

      // Verify the reward formula: reward = baseReward + chainLevel
      // The base reward varies by template type (3, 4, 5, 10), but for any
      // given task, reward >= chainLevel + 3 (minimum base reward).
      const task = useTaskStore.getState().generateNextTask(10);
      expect(task.reward).toBeGreaterThanOrEqual(task.chainLevel + 3);
    });

    it("phantom progress scaling front-loads then crawls", () => {
      completeOnboarding();

      const total = 5;

      // 1 zone revealed (entrance)
      const p1 = calculateExploration(1, total);
      // 2 zones
      const p2 = calculateExploration(2, total);
      // 3 zones
      const p3 = calculateExploration(3, total);
      // 5 zones (all)
      const p5 = calculateExploration(5, total);

      // First jump should be larger than later jumps (front-loaded)
      const jump1 = p2 - p1;
      const jump2 = p3 - p2;
      expect(jump1).toBeGreaterThan(jump2);

      // Full reveal should not be 100%
      expect(p5).toBeLessThan(100);
    });

    it("proximity-triggered flash sale fires near a store", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();
      revealZoneWithHooks(ZONE_EAST_WING);

      // Player is in East Wing, which has stores
      const playerZone = useMapStore.getState().playerPosition.zoneId;
      expect(playerZone).toBe(ZONE_EAST_WING);

      // Trigger a proximity flash sale (may need multiple attempts due to probability)
      let sale = null;
      for (let i = 0; i < 100 && !sale; i++) {
        sale = triggerProximityFlashSale();
      }

      if (sale) {
        // Sale should be for a store near the player
        const saleStore = storesByZone[ZONE_EAST_WING]?.find(
          (s) => s.id === sale!.storeId
        );
        const entranceStore = storesByZone[ZONE_ENTRANCE]?.find(
          (s) => s.id === sale!.storeId
        );
        // Sale store should be in player's zone or adjacent revealed zone
        expect(saleStore || entranceStore).toBeDefined();
      }
    });

    it("full session arc preserves accumulated state", () => {
      completeOnboarding();
      useSessionStore.getState().startSession();

      // Explore multiple zones
      revealZoneWithHooks(ZONE_EAST_WING);
      revealZoneWithHooks(ZONE_WEST_WING);
      revealZoneWithHooks(ZONE_CENTRAL_PLAZA);

      const tokens = usePlayerStore.getState().tokens;
      const progress = useMapStore.getState().explorationPercent;
      const tasksCompleted = useTaskStore.getState().completedTasks.length;

      // Open and close overlays (simulating interactions)
      useUIStore.getState().showOverlay("store-detail", { id: "test" });
      useUIStore.getState().hideOverlay();
      useUIStore.getState().showOverlay("leaderboard", null);
      useUIStore.getState().hideOverlay();

      // State should be preserved
      expect(usePlayerStore.getState().tokens).toBe(tokens);
      expect(useMapStore.getState().explorationPercent).toBe(progress);
      expect(useTaskStore.getState().completedTasks.length).toBe(tasksCompleted);
    });
  });
});
