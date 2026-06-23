import { describe, it, expect, beforeEach } from "vitest";

import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useEconomyStore } from "@/stores/economyStore";
import { useSocialStore } from "@/stores/socialStore";
import { useTaskStore } from "@/stores/taskStore";
import {
  buildExitFrictionData,
  initiateExit,
  stayInMall,
  leaveAnyway,
  acceptRescueBargain,
  checkRescueBoostExpiry,
  BARGAIN_STAY_MINUTES,
} from "@/engine/exitFrictionEngine";

/* Reset every store before each case so tests are independent. */
function resetAllStores() {
  useUIStore.getState().reset();
  useSessionStore.getState().reset();
  usePlayerStore.getState().reset();
  useMapStore.getState().reset();
  useEconomyStore.getState().reset();
  useSocialStore.getState().reset();
  useTaskStore.getState().reset();
}

describe("exitFrictionEngine — exit attempt counter & layering", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("starts with exitAttempts === 0 and exitFrictionLayer === 0", () => {
    expect(useSessionStore.getState().exitAttempts).toBe(0);
    expect(useSessionStore.getState().exitFrictionLayer).toBe(0);
  });

  it("initiateExit opens Layer 1 on first attempt and increments counter", () => {
    const layer = initiateExit();
    expect(layer).toBe(1);
    expect(useSessionStore.getState().exitAttempts).toBe(1);
    expect(useSessionStore.getState().exitFrictionLayer).toBe(1);
    expect(useUIStore.getState().activeOverlay).toBe("exit-friction");
  });

  it("initiateExit opens Layer 2 on second attempt (VAL-EXIT-008, VAL-EXIT-026)", () => {
    initiateExit();
    stayInMall(); // resets counter to 0
    // To reach layer 2 we need exitAttempts === 2: leaveAnyway advances.
    initiateExit(); // attempt 1 -> layer 1
    const result = leaveAnyway(); // advance -> attempt 2 -> layer 2
    expect(result).toBe("advance");
    expect(useSessionStore.getState().exitAttempts).toBe(2);
    expect(useSessionStore.getState().exitFrictionLayer).toBe(2);
  });

  it("initiateExit opens Layer 3 on third attempt (VAL-EXIT-012)", () => {
    initiateExit(); // 1
    leaveAnyway(); // -> 2
    leaveAnyway(); // -> 3
    expect(useSessionStore.getState().exitAttempts).toBe(3);
    expect(useSessionStore.getState().exitFrictionLayer).toBe(3);
  });

  it("exit attempt counter caps at 3 (VAL-EXIT-021, no Layer 4)", () => {
    initiateExit(); // 1
    leaveAnyway(); // 2
    leaveAnyway(); // 3
    leaveAnyway(); // final -> left (counter reset via leaveMall)
    // After leaving, the state is reset to 0 and exited is true.
    expect(useSessionStore.getState().exitAttempts).toBe(0);
    expect(useSessionStore.getState().exitFrictionLayer).toBe(0);
    expect(useSessionStore.getState().exited).toBe(true);
  });

  it("stayInMall resets the exit counter to 0 (VAL-EXIT-022)", () => {
    initiateExit();
    expect(useSessionStore.getState().exitAttempts).toBe(1);
    stayInMall();
    expect(useSessionStore.getState().exitAttempts).toBe(0);
    expect(useSessionStore.getState().exitFrictionLayer).toBe(0);
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });

  it("after staying, the next attempt starts again at Layer 1 (VAL-EXIT-022)", () => {
    initiateExit();
    leaveAnyway(); // -> layer 2
    stayInMall(); // reset
    const layer = initiateExit(); // should be layer 1 again
    expect(layer).toBe(1);
  });
});

describe("exitFrictionEngine — buildExitFrictionData (VAL-EXIT-031)", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("builds Layer 1 data with exploration %, unexplored %, and token deficit", () => {
    usePlayerStore.getState().addTokens(5);
    useEconomyStore.getState().refreshLiveDeficitPrice();
    const data = buildExitFrictionData(1);
    expect(data.layer).toBe(1);
    expect(data.explorationPercent).toBe(useMapStore.getState().explorationPercent);
    expect(data.unexploredPercent).toBe(100 - data.explorationPercent);
    // deficit is balance + 2..3, so tokensAway is 2 or 3.
    expect(data.tokensAwayFromShortcut).toBeGreaterThanOrEqual(2);
    expect(data.tokensAwayFromShortcut).toBeLessThanOrEqual(3);
  });

  it("builds Layer 2 data with streak count and sunk-cost stats from stores", () => {
    usePlayerStore.getState().addTokens(7);
    useSessionStore.setState({ sessionMinutes: 4 });
    const data = buildExitFrictionData(2);
    expect(data.streakCount).toBe(usePlayerStore.getState().streak.count);
    expect(data.sunkCost.cumulativeTokensEarned).toBe(
      usePlayerStore.getState().tierXP
    );
    expect(data.sunkCost.timeSpentMinutes).toBe(4);
    expect(data.sunkCost.explorationPercent).toBe(
      useMapStore.getState().explorationPercent
    );
    expect(data.sunkCost.tasksCompleted).toBe(
      useTaskStore.getState().completedTasks.length
    );
  });

  it("builds Layer 3 bargain enumerating wheel, streak protection, and 2x boost", () => {
    const data = buildExitFrictionData(3);
    expect(data.bargain.bonusWheel).toBe(true);
    expect(data.bargain.streakProtection).toBe(true);
    expect(data.bargain.tokenBoost).toBe(2);
    expect(data.bargain.stayMinutes).toBe(BARGAIN_STAY_MINUTES);
  });

  it("friendsInside names come from the socialStore phantom list (VAL-EXIT-011)", () => {
    const data = buildExitFrictionData(2);
    const phantomNames = useSocialStore.getState().phantoms.map((p) => p.name);
    expect(data.friendsInside).toEqual(phantomNames);
  });
});

describe("exitFrictionEngine — rescue bargain activation (VAL-EXIT-027, VAL-EXIT-028)", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("acceptRescueBargain activates bonus wheel, streak protection, and 2x boost", () => {
    // reach layer 3
    initiateExit();
    leaveAnyway();
    leaveAnyway();
    expect(useSessionStore.getState().exitFrictionLayer).toBe(3);

    acceptRescueBargain();

    expect(useEconomyStore.getState().spinningWheel.available).toBe(true);
    expect(usePlayerStore.getState().streak.streakProtected).toBe(true);
    const boost = usePlayerStore.getState().rescueBoost;
    expect(boost).not.toBeNull();
    expect(boost!.active).toBe(true);
    expect(boost!.expiresAt).toBeGreaterThan(Date.now());
  });

  it("acceptRescueBargain keeps user in the mall (overlay closed, not exited)", () => {
    initiateExit();
    leaveAnyway();
    leaveAnyway();
    acceptRescueBargain();
    expect(useUIStore.getState().activeOverlay).toBe("none");
    expect(useSessionStore.getState().exited).toBe(false);
    // exit attempts reset (chose to stay)
    expect(useSessionStore.getState().exitAttempts).toBe(0);
  });

  it("streak protection prevents breakStreak from setting broken (VAL-EXIT-028)", () => {
    usePlayerStore.getState().activateStreakProtection();
    usePlayerStore.getState().breakStreak();
    expect(usePlayerStore.getState().streak.broken).toBe(false);
  });

  it("streak protection prevents registerMissedDay from breaking the streak", () => {
    usePlayerStore.getState().activateStreakProtection();
    const missed = usePlayerStore.getState().registerMissedDay();
    expect(missed).toBe(0);
    expect(usePlayerStore.getState().streak.broken).toBe(false);
  });

  it("rescue boost doubles token awards while active (VAL-EXIT-016)", () => {
    usePlayerStore.getState().setTier("bronze"); // 1x base
    const before = usePlayerStore.getState().tokens;
    usePlayerStore.getState().activateRescueBoost(Date.now() + 60_000);
    const credited = usePlayerStore.getState().awardTokens(3);
    expect(credited).toBe(6); // 2x
    expect(usePlayerStore.getState().tokens).toBe(before + 6);
  });

  it("checkRescueBoostExpiry clears the boost once expired", () => {
    usePlayerStore.getState().activateRescueBoost(Date.now() - 1);
    const expired = checkRescueBoostExpiry();
    expect(expired).toBe(true);
    expect(usePlayerStore.getState().rescueBoost).toBeNull();
  });
});

describe("exitFrictionEngine — leaving resets state (VAL-EXIT-032)", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("leaveAnyway on Layer 3 marks exited and resets exit friction state", () => {
    initiateExit();
    leaveAnyway(); // -> 2
    leaveAnyway(); // -> 3
    const result = leaveAnyway(); // -> left
    expect(result).toBe("left");
    expect(useSessionStore.getState().exited).toBe(true);
    expect(useSessionStore.getState().exitAttempts).toBe(0);
    expect(useSessionStore.getState().exitFrictionLayer).toBe(0);
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });

  it("returnToMall clears the exited flag", () => {
    useSessionStore.getState().leaveMall();
    expect(useSessionStore.getState().exited).toBe(true);
    useSessionStore.getState().returnToMall();
    expect(useSessionStore.getState().exited).toBe(false);
  });
});
