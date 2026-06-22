/**
 * economyStore - token economy + flash sales + spinning wheel + reward density.
 *
 * Holds: flashSales, spinningWheel, rewardDensity, deficitMultiplier.
 * Actions: triggerFlashSale, removeFlashSale, makeWheelAvailable,
 *          spinWheel (skeleton), updateRewardDensity, calculateDeficitPrice.
 *
 * The deficit engine prices rewards at (userTokens + 2..3) so the user is
 * always a couple tokens short of comfortably affording the next spend.
 */

import { create } from "zustand";
import type { EconomyState, FlashSale } from "@/types";
import { usePlayerStore } from "./playerStore";

/* ============================================================================
   Constants
   ========================================================================== */

export const HOOK_PHASE_MINUTES = 15; // 0-15 min = hook, 15+ = chase
export const WHEEL_COOLDOWN_MS = 3 * 60 * 1000; // 3 minute cooldown between spins

/* ============================================================================
   Deficit pricing engine (architecture.md)
   ========================================================================== */

/**
 * Always returns a price 2-3 tokens above the user's current balance.
 * userTokens + 2 + floor(random * 2) -> userTokens + 2 or userTokens + 3.
 */
export function calculateDeficitPrice(userTokens: number): number {
  return userTokens + 2 + Math.floor(Math.random() * 2);
}

/* ============================================================================
   Store
   ========================================================================== */

let flashSaleCounter = 0;
function nextFlashSaleId(): string {
  flashSaleCounter += 1;
  return `flash-sale-${flashSaleCounter}`;
}

export interface EconomyStore extends EconomyState {
  triggerFlashSale: (sale: Omit<FlashSale, "id">) => FlashSale;
  removeFlashSale: (saleId: string) => void;
  makeWheelAvailable: () => void;
  spinWheel: () => void;
  updateRewardDensity: (sessionMinutes: number) => void;
  calculateDeficitPrice: (userTokens?: number) => number;
  setDeficitMultiplier: (multiplier: number) => void;
  reset: () => void;
}

const initialEconomyState: EconomyState = {
  flashSales: [],
  spinningWheel: { available: false, lastSpin: 0, spinCount: 0 },
  rewardDensity: { phase: "hook", sessionMinutes: 0 },
  deficitMultiplier: 1,
};

export const useEconomyStore = create<EconomyStore>((set, get) => ({
  ...initialEconomyState,

  triggerFlashSale: (sale) => {
    const newSale: FlashSale = { ...sale, id: nextFlashSaleId() };
    set((state) => ({
      flashSales: [...state.flashSales, newSale],
    }));
    return newSale;
  },

  removeFlashSale: (saleId) =>
    set((state) => ({
      flashSales: state.flashSales.filter((s) => s.id !== saleId),
    })),

  makeWheelAvailable: () =>
    set((state) => ({
      spinningWheel: { ...state.spinningWheel, available: true },
    })),

  spinWheel: () => {
    const state = get();
    if (!state.spinningWheel.available) return;
    const now = Date.now();
    set({
      spinningWheel: {
        available: false, // cooldown enforced
        lastSpin: now,
        spinCount: state.spinningWheel.spinCount + 1,
      },
    });
    // Wheel re-availability is handled by the EventScheduler based on cooldown.
  },

  updateRewardDensity: (sessionMinutes) =>
    set(() => ({
      rewardDensity: {
        phase: sessionMinutes >= HOOK_PHASE_MINUTES ? "chase" : "hook",
        sessionMinutes,
      },
    })),

  calculateDeficitPrice: (userTokens) => {
    const tokens =
      userTokens ?? usePlayerStore.getState().tokens;
    return calculateDeficitPrice(tokens);
  },

  setDeficitMultiplier: (multiplier) => set({ deficitMultiplier: multiplier }),

  reset: () => set({ ...initialEconomyState }),
}));

export default useEconomyStore;
