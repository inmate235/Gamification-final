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
 * Each event also triggers a transient token-feedback toast pushed to the
 * parallel `celebrationQueue` in uiStore. Because celebrations use their own
 * queue (independent of `activeOverlay`), they render at z-50 on top of any
 * open overlay without unmounting it (VAL-TOKEN-017).
 *
 * Exploration + secret-token earning is wired directly in `MallMap` (it needs
 * zone-reveal context); this module provides the earning paths for tasks and
 * the spinning wheel (used by their respective features) plus the spending
 * paths for shortcuts and flash sales.
 */

import { usePlayerStore } from "@/stores/playerStore";
import { useEconomyStore } from "@/stores/economyStore";
import { useUIStore } from "@/stores/uiStore";
import { useSocialStore } from "@/stores/socialStore";
import { markRefractory } from "@/engine/flashSaleEngine";
import { playAchievement } from "@/lib/sound";
import type { CelebrationHook, Task } from "@/types";

/* ============================================================================
   Post-purchase hook selector
   ========================================================================== */

/**
 * Choose the single most contextually relevant post-purchase hook CTA.
 * Priority: proximity alert > low balance > active streak > default (shop).
 */
function choosePurchaseHook(): CelebrationHook {
  const alerts = useSocialStore.getState().proximityAlerts;
  if (alerts.length > 0) {
    const latest = alerts[alerts.length - 1]!;
    return {
      label: `Only ${latest.tokenGap} token${latest.tokenGap !== 1 ? "s" : ""} behind ${latest.targetName} for #${latest.rank}`,
      action: "explore",
    };
  }

  const tokens = usePlayerStore.getState().tokens;
  if (tokens < 5) {
    return {
      label: "Spin the Wheel to earn tokens back",
      action: "wheel",
    };
  }

  const streak = usePlayerStore.getState().streak;
  if (streak.count > 0 && !streak.broken) {
    return {
      label: `Day ${streak.count} streak — come back tomorrow!`,
      action: "dismiss",
    };
  }

  return {
    label: "Keep Shopping",
    action: "shop",
  };
}

/* ============================================================================
   Feedback helpers
   ========================================================================== */

/**
 * Push a token-feedback toast to the parallel celebration queue.
 *
 * For `kind="spend"`: computes before/after balances and attaches a
 * post-purchase hook CTA so the spend moment loops back into an earn/explore
 * action. Accepts an optional `label` (item or deal name) shown in the receipt.
 *
 * Unlike the old `showOverlay("celebration", ...)` approach, this never
 * touches `activeOverlay`, so any open overlay (shop, flash-sale) stays
 * mounted while the toast floats above it at z-50.
 */
export function showTokenFeedback(
  kind: "earn" | "spend",
  amount: number,
  message: string,
  opts: { label?: string } = {}
): void {
  const newBalance = usePlayerStore.getState().tokens;
  const balanceBefore = kind === "spend" ? newBalance + amount : Math.max(0, newBalance - amount);

  useUIStore.getState().pushCelebration({
    message,
    amount,
    kind,
    label: opts.label,
    balanceBefore,
    balanceAfter: newBalance,
    hook: kind === "spend" ? choosePurchaseHook() : undefined,
  });
}

/**
 * Push a streak milestone celebration toast. Called when `checkStreakOnVisit`
 * returns `incremented` or `recovered` so the visit hook is positive and
 * rewarding rather than anxiety-only.
 */
export function showStreakCelebration(streakCount: number): void {
  const message =
    streakCount === 1
      ? "Streak started! Come back tomorrow."
      : streakCount >= 7
        ? `Day ${streakCount} — you're on fire!`
        : `Day ${streakCount} streak — keep it going!`;

  useUIStore.getState().pushCelebration({
    message,
    amount: streakCount,
    kind: "streak",
  });
  playAchievement();
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
  playAchievement();
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
    playAchievement();
  }
  return credited;
}

/* ============================================================================
   Spending
   ========================================================================== */

/**
 * Buy a real-money token pack: credits the pack's tokenAmount to the player
 * balance and shows a purchase feedback. Returns true when the purchase
 * succeeded.
 */
export function buyTokenPack(packId: string): boolean {
  const pack = useEconomyStore
    .getState()
    .tokenPacks.find((p) => p.id === packId);
  const ok = useEconomyStore.getState().buyTokenPack(packId);
  if (ok) {
    playAchievement();
    showTokenFeedback("earn", pack?.tokenAmount ?? 0, `+${pack?.tokenAmount ?? 0} Tokens`, {
      label: pack?.name,
    });
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
    playAchievement();
  }
  return ok;
}

/**
 * Purchase spins: deducts token cost, increments extra spins count,
 * and triggers a spend celebration overlay.
 */
export function buySpins(amount: number, cost: number): boolean {
  const ok = useEconomyStore.getState().buySpins(amount, cost);
  if (ok) {
    showTokenFeedback("spend", cost, `Spins Purchased! -${cost} Tokens`, {
      label: `${amount} extra spin${amount !== 1 ? "s" : ""}`,
    });
    playAchievement();
  }
  return ok;
}

const tokenEconomy = {
  showTokenFeedback,
  showStreakCelebration,
  awardTaskReward,
  awardWheelReward,
  buyTokenPack,
  claimFlashSale,
  buySpins,
};

export default tokenEconomy;
