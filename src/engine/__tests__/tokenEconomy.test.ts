import { describe, it, expect, beforeEach } from "vitest";
import {
  awardTaskReward,
  awardWheelReward,
  unlockShortcut,
  claimFlashSale,
  showTokenFeedback,
} from "@/engine/tokenEconomy";
import { usePlayerStore } from "@/stores/playerStore";
import { useEconomyStore } from "@/stores/economyStore";
import { useUIStore } from "@/stores/uiStore";
import { useMapStore } from "@/stores/mapStore";
import type { Task } from "@/types";

function makeTask(reward: number): Task {
  return {
    id: "task-x",
    type: "explore-zone",
    description: "Explore the East Wing",
    reward,
    timeGated: false,
    difficulty: 1,
    chainLevel: 0,
  };
}

describe("engine/tokenEconomy", () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
    useEconomyStore.getState().reset();
    useUIStore.getState().reset();
    useMapStore.getState().reset();
  });

  describe("awardTaskReward", () => {
    it("credits the displayed reward at bronze 1x and shows an earn celebration", () => {
      const credited = awardTaskReward(makeTask(5));
      expect(credited).toBe(5);
      expect(usePlayerStore.getState().tokens).toBe(5);
      expect(useUIStore.getState().activeOverlay).toBe("celebration");
      const data = useUIStore.getState().overlayData as {
        message: string;
        kind: string;
      };
      expect(data.message).toContain("+5");
      expect(data.kind).toBe("earn");
    });

    it("applies tier multipliers to the credited reward (gold 2x)", () => {
      usePlayerStore.getState().setTier("gold");
      const credited = awardTaskReward(makeTask(4));
      expect(credited).toBe(8);
      expect(usePlayerStore.getState().tokens).toBe(8);
    });

    it("neodymium 3x multiplier applies to task rewards", () => {
      usePlayerStore.getState().setTier("neodymium");
      expect(awardTaskReward(makeTask(3))).toBe(9);
      expect(usePlayerStore.getState().tokens).toBe(9);
    });
  });

  describe("awardWheelReward", () => {
    it("credits a wheel token prize with the tier multiplier (silver 1.5x)", () => {
      usePlayerStore.getState().setTier("silver");
      const credited = awardWheelReward(4);
      expect(credited).toBe(6); // 4 * 1.5 = 6
      expect(usePlayerStore.getState().tokens).toBe(6);
      const data = useUIStore.getState().overlayData as { message: string };
      expect(data.message).toContain("+6");
    });

    it("gold 2x and neodymium 3x apply to wheel prizes", () => {
      usePlayerStore.getState().setTier("gold");
      expect(awardWheelReward(5)).toBe(10);
      usePlayerStore.getState().reset();
      usePlayerStore.getState().setTier("neodymium");
      expect(awardWheelReward(3)).toBe(9);
    });
  });

  describe("unlockShortcut (spending)", () => {
    it("deducts the frozen cost and opens the route when affordable", () => {
      const active = useEconomyStore.getState().getActiveShortcut()!;
      usePlayerStore.getState().addTokens(active.tokenCost);
      const ok = unlockShortcut(active.id);
      expect(ok).toBe(true);
      expect(usePlayerStore.getState().tokens).toBe(0);
      // Spend feedback is distinct (red, -N).
      const data = useUIStore.getState().overlayData as {
        message: string;
        kind: string;
      };
      expect(data.kind).toBe("spend");
      expect(data.message).toContain(`-${active.tokenCost}`);
    });

    it("fails without spending when balance is insufficient", () => {
      const active = useEconomyStore.getState().getActiveShortcut()!;
      const ok = unlockShortcut(active.id);
      expect(ok).toBe(false);
      expect(usePlayerStore.getState().tokens).toBe(0);
    });
  });

  describe("claimFlashSale (spending)", () => {
    it("deducts the frozen cost and closes the sale when affordable", () => {
      const sale = useEconomyStore.getState().triggerDeficitFlashSale();
      usePlayerStore.getState().addTokens(sale!.tokenCost);
      const ok = claimFlashSale(sale!.id);
      expect(ok).toBe(true);
      expect(usePlayerStore.getState().tokens).toBe(0);
      expect(useEconomyStore.getState().flashSales).toHaveLength(0);
      const data = useUIStore.getState().overlayData as {
        message: string;
        kind: string;
      };
      expect(data.kind).toBe("spend");
    });
  });

  describe("showTokenFeedback", () => {
    it("earn and spend produce visually distinct kinds", () => {
      showTokenFeedback("earn", 3, "+3 Tokens");
      expect(
        (useUIStore.getState().overlayData as { kind: string }).kind
      ).toBe("earn");
      showTokenFeedback("spend", 2, "-2 Tokens");
      expect(
        (useUIStore.getState().overlayData as { kind: string }).kind
      ).toBe("spend");
    });
  });

  describe("non-negative invariant + single balance (VAL-TOKEN-016/019)", () => {
    it("spending never pushes the balance negative", () => {
      usePlayerStore.getState().addTokens(2);
      usePlayerStore.getState().spendTokens(5);
      expect(usePlayerStore.getState().tokens).toBe(2); // no-op, stays non-negative
      usePlayerStore.getState().spendTokens(2);
      expect(usePlayerStore.getState().tokens).toBe(0);
      usePlayerStore.getState().spendTokens(1);
      expect(usePlayerStore.getState().tokens).toBe(0);
    });

    it("all sources/sinks reflect in the single playerStore.tokens value", () => {
      usePlayerStore.getState().setTier("gold");
      awardTaskReward(makeTask(3)); // +6
      awardWheelReward(2); // +4
      expect(usePlayerStore.getState().tokens).toBe(10);
      // spend via shortcut
      const active = useEconomyStore.getState().getActiveShortcut()!;
      // active cost was frozen at balance 0 = 2..3; ensure we can afford
      usePlayerStore.getState().addTokens(0);
      // Make sure balance covers frozen cost (it does, 10 >= 2..3)
      const cost = active.tokenCost;
      unlockShortcut(active.id);
      expect(usePlayerStore.getState().tokens).toBe(10 - cost);
    });
  });
});
