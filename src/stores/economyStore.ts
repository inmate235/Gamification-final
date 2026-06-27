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
import type { EconomyState, FlashSale, Shortcut } from "@/types";
import { usePlayerStore } from "./playerStore";
import { shortcuts as shortcutSeed, unlockedShortcutEdges } from "@/data/shortcutData";

/* ============================================================================
   Constants
   ========================================================================== */

export const HOOK_PHASE_MINUTES = 15; // 0-15 min = hook, 15+ = chase
export const WHEEL_COOLDOWN_MS = 15 * 1000; // 15s cooldown between spins
/** Delay from session start before the wheel first becomes available. */
export const INITIAL_WHEEL_DELAY_MS = 5 * 1000; // 5s — wheel not always available (VAL-WHEEL-001)

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

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export interface EconomyStore extends EconomyState {
  triggerFlashSale: (sale: Omit<FlashSale, "id">) => FlashSale;
  removeFlashSale: (saleId: string) => void;
  /**
   * Batch-update the remaining `countdownSeconds` for multiple active flash
   * sales. Used by the EventScheduler's background timer tick so that ALL
   * active sales age out regardless of overlay state, not just the visible
   * one.
   */
  updateFlashSaleCountdowns: (
    updates: Array<{ id: string; remaining: number }>
  ) => void;
  /**
   * Trigger a minimal, deficit-priced flash sale for a given (or random)
   * store. The tokenCost is FROZEN at the current deficit price (balance +
   * 2..3) so the deal becomes affordable once the user earns a couple more
   * tokens. The full flash-sale feature layers proximity triggering,
   * synthetic timers and personalization on top of this spending path.
   */
  triggerDeficitFlashSale: (storeId?: string) => FlashSale | null;
  /**
   * Claim (purchase) a flash sale: deducts its frozen tokenCost when
   * affordable, marks the sale claimed, and removes it. Returns false when
   * the balance is insufficient or the sale does not exist / is claimed.
   */
  claimFlashSale: (saleId: string) => boolean;
  makeWheelAvailable: () => void;
  spinWheel: () => void;
  buySpins: (amount: number, cost: number) => boolean;
  setLastSpinNearMiss: (nearMiss: boolean) => void;
  clearLastSpinNearMiss: () => void;
  updateRewardDensity: (sessionMinutes: number) => void;
  calculateDeficitPrice: (userTokens?: number) => number;
  setDeficitMultiplier: (multiplier: number) => void;
  /** Recompute the live deficit teaser price (called each scheduler tick). */
  refreshLiveDeficitPrice: () => void;
  /** Returns the first locked shortcut (the active buyable offer), or null. */
  getActiveShortcut: () => Shortcut | null;
  /** Returns unlocked shortcut edges for map adjacency. */
  getUnlockedEdges: () => Array<[string, string]>;
  /**
   * Unlock a shortcut: deducts its frozen tokenCost when affordable and
   * marks it unlocked (opening the faster route). Freezes the next locked
   * shortcut's cost at the new deficit price. Returns false when the balance
   * is insufficient or the shortcut is already unlocked / unknown.
   */
  unlockShortcut: (shortcutId: string) => boolean;
  reset: () => void;
}

const initialEconomyState: Omit<EconomyState, "shortcuts" | "liveDeficitPrice"> = {
  flashSales: [],
  spinningWheel: { available: false, lastSpin: 0, spinCount: 0, extraSpins: 0, lastSpinNearMiss: false },
  rewardDensity: { phase: "hook", sessionMinutes: 0 },
  deficitMultiplier: 1,
};

/**
 * Build a fresh shortcuts list and freeze the first locked shortcut's cost at
 * the deficit price for the given balance. Used at init, reset, and after an
 * unlock (with the post-unlock balance) so the next offer is always priced
 * 2-3 tokens above what the user currently holds.
 */
function buildShortcuts(balance: number): Shortcut[] {
  const list = shortcutSeed.map((s) => ({ ...s, unlocked: false }));
  if (list.length > 0) {
    list[0]!.tokenCost = calculateDeficitPrice(balance);
  }
  return list;
}

/** Re-freeze the first locked shortcut's cost at the current deficit price. */
function refreezeNextLockedShortcut(
  list: Shortcut[],
  balance: number
): Shortcut[] {
  const idx = list.findIndex((s) => !s.unlocked);
  if (idx === -1) return list;
  return list.map((s, i) =>
    i === idx ? { ...s, tokenCost: calculateDeficitPrice(balance) } : s
  );
}

export const useEconomyStore = create<EconomyStore>((set, get) => ({
  ...initialEconomyState,
  shortcuts: buildShortcuts(0),
  liveDeficitPrice: calculateDeficitPrice(0),

  triggerFlashSale: (sale) => {
    const newSale: FlashSale = {
      ...sale,
      id: nextFlashSaleId(),
      // Freeze the starting countdown so the EventScheduler can recompute the
      // remaining time from createdAt + syntheticTickMs for background ticking
      // (sales that age out even when their overlay is never opened).
      initialCountdownSeconds:
        sale.initialCountdownSeconds ?? sale.countdownSeconds,
    };
    set((state) => ({
      flashSales: [...state.flashSales, newSale],
    }));
    return newSale;
  },

  triggerDeficitFlashSale: (storeId) => {
    const balance = usePlayerStore.getState().tokens;
    const tokenCost = calculateDeficitPrice(balance);
    const id =
      storeId ??
      pickRandom([
        "store-bloom",
        "store-technova",
        "store-lumiere",
        "store-cafe-nuit",
        "store-prism",
      ]);
    const deals = [
      { discount: "40% off", percent: 40, item: "Limited-edition capsule, tonight only." },
      { discount: "30% off", percent: 30, item: "A statement piece at a steal." },
      { discount: "Buy 1 Get 1", percent: 50, item: "Double the indulgence, half the price." },
      { discount: "35% off", percent: 35, item: "Members-only clearance flash." },
    ];
    const deal = deals[Math.floor(Math.random() * deals.length)] ?? deals[0]!;
    const sale = get().triggerFlashSale({
      storeId: id,
      discount: deal.discount,
      tokenCost,
      countdownSeconds: 90, // synthetic timer (not 1:1 wall-clock per 4.5.1)
      personalized: false,
      itemDescription: deal.item,
      discountPercent: deal.percent,
      socialProof: 12 + Math.floor(Math.random() * 40),
      createdAt: Date.now(),
    });
    return sale;
  },

  claimFlashSale: (saleId) => {
    const state = get();
    const sale = state.flashSales.find((s) => s.id === saleId);
    if (!sale || sale.claimed) return false;
    const ok = usePlayerStore.getState().spendTokens(sale.tokenCost);
    if (!ok) return false;
    set((st) => ({
      flashSales: st.flashSales.filter((s) => s.id !== saleId),
    }));
    return true;
  },

  removeFlashSale: (saleId) =>
    set((state) => ({
      flashSales: state.flashSales.filter((s) => s.id !== saleId),
    })),

  updateFlashSaleCountdowns: (updates) => {
    if (updates.length === 0) return;
    const map = new Map(updates.map((u) => [u.id, u.remaining]));
    set((state) => ({
      flashSales: state.flashSales.map((s) =>
        map.has(s.id) ? { ...s, countdownSeconds: map.get(s.id)! } : s
      ),
    }));
  },

  makeWheelAvailable: () =>
    set((state) => ({
      spinningWheel: { ...state.spinningWheel, available: true },
    })),

  spinWheel: () => {
    const state = get();
    const { available, extraSpins, spinCount, lastSpin, lastSpinNearMiss } = state.spinningWheel;
    if (!available && extraSpins <= 0) return;

    const now = Date.now();
    if (available) {
      set({
        spinningWheel: {
          available: false,
          lastSpin: now,
          spinCount: spinCount + 1,
          extraSpins,
          lastSpinNearMiss,
        },
      });
    } else {
      set({
        spinningWheel: {
          available,
          lastSpin,
          spinCount: spinCount + 1,
          extraSpins: extraSpins - 1,
          lastSpinNearMiss,
        },
      });
    }
  },

  buySpins: (amount, cost) => {
    const ok = usePlayerStore.getState().spendTokens(cost);
    if (!ok) return false;
    set((state) => ({
      spinningWheel: {
        ...state.spinningWheel,
        extraSpins: state.spinningWheel.extraSpins + amount,
      },
    }));
    return true;
  },

  setLastSpinNearMiss: (nearMiss) =>
    set((state) => ({
      spinningWheel: {
        ...state.spinningWheel,
        lastSpinNearMiss: nearMiss,
      },
    })),

  clearLastSpinNearMiss: () =>
    set((state) => ({
      spinningWheel: {
        ...state.spinningWheel,
        lastSpinNearMiss: false,
      },
    })),

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

  refreshLiveDeficitPrice: () =>
    set({ liveDeficitPrice: calculateDeficitPrice(usePlayerStore.getState().tokens) }),

  getActiveShortcut: () => {
    const list = get().shortcuts;
    return list.find((s) => !s.unlocked) ?? null;
  },

  getUnlockedEdges: () => unlockedShortcutEdges(get().shortcuts),

  unlockShortcut: (shortcutId) => {
    const state = get();
    const shortcut = state.shortcuts.find((s) => s.id === shortcutId);
    if (!shortcut || shortcut.unlocked) return false;
    const ok = usePlayerStore.getState().spendTokens(shortcut.tokenCost);
    if (!ok) return false;
    // Mark unlocked and freeze the next locked shortcut's cost at the new
    // (post-spend) deficit price so the following offer is always 2-3 above
    // the user's new balance.
    const newBalance = usePlayerStore.getState().tokens;
    const updated = state.shortcuts.map((s) =>
      s.id === shortcutId ? { ...s, unlocked: true } : s
    );
    set({
      shortcuts: refreezeNextLockedShortcut(updated, newBalance),
      liveDeficitPrice: calculateDeficitPrice(newBalance),
    });
    return true;
  },

  reset: () =>
    set({
      ...initialEconomyState,
      shortcuts: buildShortcuts(0),
      liveDeficitPrice: calculateDeficitPrice(0),
    }),
}));

export default useEconomyStore;
