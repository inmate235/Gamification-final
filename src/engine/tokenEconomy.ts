/**
 * tokenEconomy - the central orchestration layer for earning + spending.
 *
 * All token sources (exploration, tasks, the spinning wheel, the secret token)
 * and all token sinks (shortcut unlocks, flash sale purchases) flow through
 * the single `playerStore.tokens` balance reflected in the status bar
 * (VAL-TOKEN-019). Earning applies the current tier's earn-rate multiplier
 * (Bronze 1x, Silver 1.5x, Gold 2x, Neodymium 3x) via `playerStore.awardTokens`
 * (VAL-TOKEN-012..015). Spending uses `playerStore.spendTokens`, which enforces
 * the non-negative integer invariant (VAL-TOKEN-016).
 *
 * Each event also triggers a transient token-feedback overlay. Earn events
 * use the gold +N upward treatment; spend events use the distinct red -N
 * downward treatment (VAL-TOKEN-017).
 *
 * Exploration + secret-token earning is wired directly in `MallMap` (it needs
 * zone-reveal context); this module provides the earning paths for tasks and
 * the spinning wheel (used by their respective features) plus the spending
 * paths for shortcuts and flash sales.
 */

import { usePlayerStore } from "@/stores/playerStore";
import { useEconomyStore } from "@/stores/economyStore";
import { useUIStore } from "@/stores/uiStore";
import { markRefractory } from "@/engine/flashSaleEngine";
import type { Task } from "@/types";

/* ============================================================================
   Feedback helper
   ========================================================================== */

/** Show the transient token-feedback celebration overlay. */
export function showTokenFeedback(
  kind: "earn" | "spend",
  amount: number,
  message: string
): void {
  useUIStore.getState().showOverlay("celebration", { message, amount, kind });
}

/* ============================================================================
   Earning
   ========================================================================== */

/**
 * Credit a breadcrumb task's reward. Applies the tier multiplier and shows an
 * earn celebration. Returns the exact integer amount credited so callers can
 * verify the displayed reward matched (VAL-TOKEN-005, VAL-TASK-021).
 */
export function awardTaskReward(task: Task): number {
  const credited = usePlayerStore.getState().awardTokens(task.reward);
  showTokenFeedback("earn", credited, `+${credited} Tokens`);
  return credited;
}

/**
 * Credit a spinning-wheel token prize. Applies the tier multiplier and shows an
 * earn celebration (VAL-TOKEN-006, VAL-WHEEL-017). `baseTokens` is the face
 * value of the slot (1-10); the credited amount is baseTokens * tierMultiplier.
 */
export function awardWheelReward(baseTokens: number): number {
  const credited = usePlayerStore.getState().awardTokens(baseTokens);
  if (credited > 0) {
    showTokenFeedback("earn", credited, `Wheel! +${credited} Tokens`);
  }
  return credited;
}

/* ============================================================================
   Spending
   ========================================================================== */

/**
 * Unlock a shortcut: deducts its frozen deficit tokenCost when affordable,
 * opening the faster route. Shows a spend feedback on success. Returns true
 * when the unlock succeeded (VAL-TOKEN-008, VAL-TOKEN-003).
 */
export function unlockShortcut(shortcutId: string): boolean {
  const shortcut = useEconomyStore
    .getState()
    .shortcuts.find((s) => s.id === shortcutId);
  const cost = shortcut?.tokenCost ?? 0;
  const ok = useEconomyStore.getState().unlockShortcut(shortcutId);
  if (ok) {
    showTokenFeedback("spend", cost, `-${cost} Tokens`);
  }
  return ok;
}

/**
 * Claim (purchase) a flash sale: deducts its frozen deficit tokenCost when
 * affordable and closes the sale. Shows a spend feedback on success
 * (VAL-TOKEN-009, VAL-TOKEN-003).
 *
 * When `showFeedback` is false the spend celebration overlay is NOT shown
 * immediately — the caller is responsible for surfacing the feedback (e.g.
 * the FlashSale overlay delays it ~1s so the inline "Deal Claimed!" state is
 * visible before the celebration takes over). Defaults to true for backward
 * compatibility with other call sites.
 */
export function claimFlashSale(
  saleId: string,
  opts: { showFeedback?: boolean } = {}
): boolean {
  const sale = useEconomyStore.getState().flashSales.find((s) => s.id === saleId);
  const cost = sale?.tokenCost ?? 0;
  const ok = useEconomyStore.getState().claimFlashSale(saleId);
  if (ok) {
    // Mark the store refractory so the same deal cannot instantly re-trigger
    // after being claimed (VAL-SALE-015).
    if (sale) {
      markRefractory(sale.storeId);
    }
    if (opts.showFeedback !== false) {
      showTokenFeedback("spend", cost, `Deal Claimed! -${cost} Tokens`);
    }
  }
  return ok;
}

const tokenEconomy = {
  showTokenFeedback,
  awardTaskReward,
  awardWheelReward,
  unlockShortcut,
  claimFlashSale,
};

export default tokenEconomy;
