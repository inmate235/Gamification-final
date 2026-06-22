import { describe, it, expect, beforeEach } from "vitest";
import {
  useEconomyStore,
  calculateDeficitPrice,
  HOOK_PHASE_MINUTES,
  WHEEL_COOLDOWN_MS,
} from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";

describe("economyStore", () => {
  beforeEach(() => {
    useEconomyStore.getState().reset();
    usePlayerStore.getState().reset();
  });

  it("initializes with no flash sales and an unavailable wheel", () => {
    const s = useEconomyStore.getState();
    expect(s.flashSales).toEqual([]);
    expect(s.spinningWheel.available).toBe(false);
    expect(s.spinningWheel.spinCount).toBe(0);
    expect(s.rewardDensity.phase).toBe("hook");
    expect(s.deficitMultiplier).toBe(1);
  });

  it("triggerFlashSale adds a sale with a unique id", () => {
    const sale = useEconomyStore.getState().triggerFlashSale({
      storeId: "store-bloom",
      discount: "30% off",
      tokenCost: 5,
      countdownSeconds: 120,
      personalized: false,
    });
    expect(sale.id).toBeTruthy();
    expect(useEconomyStore.getState().flashSales).toHaveLength(1);
  });

  it("removeFlashSale removes a sale by id", () => {
    const sale = useEconomyStore.getState().triggerFlashSale({
      storeId: "store-bloom",
      discount: "30% off",
      tokenCost: 5,
      countdownSeconds: 120,
      personalized: false,
    });
    useEconomyStore.getState().removeFlashSale(sale.id);
    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
  });

  it("makeWheelAvailable flips the wheel flag", () => {
    useEconomyStore.getState().makeWheelAvailable();
    expect(useEconomyStore.getState().spinningWheel.available).toBe(true);
  });

  it("spinWheel on an unavailable wheel is a no-op", () => {
    useEconomyStore.getState().spinWheel();
    expect(useEconomyStore.getState().spinningWheel.spinCount).toBe(0);
  });

  it("spinWheel on an available wheel increments count and disables it", () => {
    useEconomyStore.getState().makeWheelAvailable();
    useEconomyStore.getState().spinWheel();
    const s = useEconomyStore.getState();
    expect(s.spinningWheel.spinCount).toBe(1);
    expect(s.spinningWheel.available).toBe(false);
    expect(s.spinningWheel.lastSpin).toBeGreaterThan(0);
  });

  it("updateRewardDensity shifts from hook to chase at 15 minutes", () => {
    useEconomyStore.getState().updateRewardDensity(0);
    expect(useEconomyStore.getState().rewardDensity.phase).toBe("hook");
    useEconomyStore.getState().updateRewardDensity(HOOK_PHASE_MINUTES);
    expect(useEconomyStore.getState().rewardDensity.phase).toBe("chase");
  });

  it("calculateDeficitPrice returns balance + 2..3", () => {
    usePlayerStore.getState().addTokens(10);
    for (let i = 0; i < 20; i++) {
      const price = useEconomyStore.getState().calculateDeficitPrice();
      expect(price).toBeGreaterThanOrEqual(12);
      expect(price).toBeLessThanOrEqual(13);
    }
  });

  it("calculateDeficitPrice pure function matches the spec formula", () => {
    for (let i = 0; i < 20; i++) {
      const price = calculateDeficitPrice(0);
      expect(price).toBeGreaterThanOrEqual(2);
      expect(price).toBeLessThanOrEqual(3);
    }
  });

  it("setDeficitMultiplier updates the multiplier", () => {
    useEconomyStore.getState().setDeficitMultiplier(1.5);
    expect(useEconomyStore.getState().deficitMultiplier).toBe(1.5);
  });

  it("exposes the wheel cooldown constant (3 minutes)", () => {
    expect(WHEEL_COOLDOWN_MS).toBe(3 * 60 * 1000);
  });
});
