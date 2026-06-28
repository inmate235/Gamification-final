"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Tag,
  Timer,
  Users,
  Eye,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { useEconomyStore } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import { claimFlashSale, showTokenFeedback } from "@/engine/tokenEconomy";
import {
  dismissFlashSale,
  expireFlashSale,
} from "@/engine/flashSaleEngine";
import { getStoreById } from "@/data/mallData";
import { cn } from "@/lib/utils";
import type { FlashSale as FlashSaleType } from "@/types";

/**
 * FlashSale — the proximity-triggered flash sale overlay.
 *
 * Sales appear when the player moves near a store (proximity-triggered via the
 * EventScheduler, see flashSaleEngine). The overlay shows:
 *   - store name + category
 *   - discount % and item description
 *   - a synthetic countdown timer (ticks slower than real time, VAL-SALE-006)
 *   - a deficit-engineered token cost (balance + 2..3, VAL-SALE-008)
 *   - social proof ("N people viewing this deal", VAL-SALE-010)
 *
 * Dismissal ("Maybe Later") closes the overlay without charging and applies a
 * refractory period to that store (VAL-SALE-012, VAL-SALE-019). Natural expiry
 * removes the sale without charging tokens (VAL-SALE-020). "Grab Deal"
 * deducts the frozen tokenCost and shows a claimed/success state before the
 * spend celebration takes over (VAL-SALE-015).
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;



/* ============================================================================
   Overlay
   ========================================================================== */

export function FlashSale() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const overlayData = useUIStore((s) => s.overlayData) as FlashSaleType | null;
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  const flashSales = useEconomyStore((s) => s.flashSales);
  const tokens = usePlayerStore((s) => s.tokens);

  // The sale to display: prefer the live store object (looked up by the
  // overlay payload's id) so the countdown reflects background ticking by the
  // EventScheduler. Fall back to the first active sale, then to the overlay
  // snapshot (e.g. after the sale is claimed/removed but the claimed state is
  // still shown briefly).
  const liveSale = overlayData
    ? flashSales.find((s) => s.id === overlayData.id) ?? null
    : flashSales[0] ?? null;
  const sale = liveSale ?? overlayData;

  const isOpen = activeOverlay === "flash-sale" && sale !== null;

  // Claimed state: shown briefly after a successful grab before the spend
  // celebration overlay takes over (VAL-SALE-015).
  const [claimed, setClaimed] = useState(false);
  const claimedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset the claimed flag whenever a different sale is displayed. Using the
  // React-recommended "adjust state during render when a prop changes" pattern
  // (avoids a setState-in-effect lint violation). A stale claimed-timer, if
  // any, only sets claimed back to false (already the reset value), so it is
  // harmless; the timer is also cleared on unmount and overwritten on grab.
  const [prevSaleId, setPrevSaleId] = useState<string | undefined>(sale?.id);
  if (sale?.id !== prevSaleId) {
    setPrevSaleId(sale?.id);
    setClaimed(false);
  }

  const [liveViewers, setLiveViewers] = useState(sale?.socialProof ?? 23);
  const [prevSaleIdForViewers, setPrevSaleIdForViewers] = useState<string | undefined>(sale?.id);
  if (sale?.id !== prevSaleIdForViewers) {
    setPrevSaleIdForViewers(sale?.id);
    setLiveViewers(sale?.socialProof ?? 23);
  }

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setLiveViewers((prev) => {
        const change = Math.random() > 0.5 ? 1 : -1;
        const newVal = prev + change;
        return newVal > 3 ? newVal : 4;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Dismiss ("Maybe Later" / X / Escape / backdrop): no charge + refractory.
  const handleDismiss = useCallback(() => {
    const current = sale?.id;
    if (!current) {
      hideOverlay();
      return;
    }
    dismissFlashSale(current);
  }, [sale?.id, hideOverlay]);

  // Natural expiry: remove the sale without charging (VAL-SALE-020).
  const onExpire = useCallback(() => {
    const current = sale?.id;
    if (!current) return;
    expireFlashSale(current);
  }, [sale?.id]);

  // Grab Deal: deduct tokens, show claimed state for ~1s, then the spend
  // celebration overlay. The celebration is delayed so the inline "Deal
  // Claimed!" confirmation is visible before the overlay switches.
  const onGrab = useCallback(() => {
    const current = sale?.id;
    if (!current) return;
    const cost = sale.tokenCost;
    // Claim without immediate feedback — we'll show the celebration after the
    // claimed state has been visible for ~1s.
    const ok = claimFlashSale(current, { showFeedback: false });
    if (ok) {
      setClaimed(true);
      if (claimedTimerRef.current) clearTimeout(claimedTimerRef.current);
      claimedTimerRef.current = setTimeout(() => {
        showTokenFeedback("spend", cost, `Deal Claimed! -${cost} Tokens`);
        setClaimed(false);
      }, 1000);
    }
  }, [sale]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleDismiss]);

  // Cleanup the claimed timer on unmount.
  useEffect(() => {
    return () => {
      if (claimedTimerRef.current) clearTimeout(claimedTimerRef.current);
    };
  }, []);

  if (!sale) return null;

  const store = getStoreById(sale.storeId);
  const canAfford = tokens >= sale.tokenCost;
  const shortfall = Math.max(0, sale.tokenCost - tokens);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: PREMIUM_EASE }}
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center px-0 sm:px-4 pb-0 sm:py-20"
          onClick={handleDismiss}
          data-testid="flash-sale-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Flash sale"
        >
          <div className="absolute inset-0 backdrop-blur-md bg-[#141414]/40" />

          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "rounded-t-3xl sm:rounded-3xl bg-white p-6 sm:p-7 ring-2 ring-[#141414]/8 transition-all duration-300",
                sale.countdownSeconds < 30 ? "animate-deal-pulse" : ""
              )}
              style={{
                boxShadow:
                  sale.countdownSeconds < 30
                    ? "0 0 24px rgba(239, 68, 68, 0.25)"
                    : "0 24px 64px rgba(20, 20, 20, 0.22)",
              }}
            >
                {/* Header */}
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e6009e]/12 ring-1 ring-[#e6009e]/30">
                      <Tag size={16} weight="fill" className="text-[#e6009e]" />
                    </span>
                    <div>
                      <span className="inline-block rounded-full bg-[#e6009e]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] font-medium text-[#e6009e]">
                        Flash Sale
                      </span>
                      <h2
                        className="mt-1 text-lg font-bold tracking-tight text-[#141414] font-display"
                        data-testid="flash-sale-store-name"
                      >
                        {store?.name ?? "Exclusive Deal"}
                      </h2>
                      {store && (
                        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a8a]">
                          {store.category}
                          {sale.personalized ? " · picked for you" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleDismiss}
                    aria-label="Close flash sale"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#141414]/5 ring-1 ring-[#141414]/10 transition-all duration-200 hover:bg-[#141414]/10 active:scale-[0.96]"
                  >
                    <X size={16} weight="bold" className="text-[#141414]" />
                  </button>
                </div>

                {/* Discount + item */}
                <div
                  className="mb-4 rounded-2xl bg-[#ffe600]/35 p-4 ring-1 ring-[#141414]/12"
                  data-testid="flash-sale-deal"
                >
                  <p
                    className="font-mono text-2xl font-bold tabular-nums text-[#e6009e]"
                    data-testid="flash-sale-discount"
                  >
                    {sale.discount}
                  </p>
                  <p
                    className="mt-1 text-sm leading-relaxed text-[#4b4b4b]"
                    data-testid="flash-sale-item"
                  >
                    {sale.itemDescription ?? "A members-only flash deal."}
                  </p>
                </div>

                {/* Countdown + social proof */}
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div
                    className="rounded-2xl bg-[#f4f4f5] px-4 py-3 ring-1 ring-[#141414]/8 flex items-center justify-between"
                    data-testid="flash-sale-timer"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-[#e6009e]">
                        <Timer size={14} weight="fill" />
                        <span className="text-[10px] uppercase tracking-[0.12em]">
                          Ends in
                        </span>
                      </div>
                      <Countdown
                        key={sale.id}
                        remaining={sale.countdownSeconds}
                        onExpire={onExpire}
                      />
                    </div>
                    {/* SVG Countdown Ring */}
                    <div className="relative w-8 h-8 shrink-0">
                      <svg className="w-8 h-8 transform -rotate-90">
                        <circle
                          cx="16"
                          cy="16"
                          r="12"
                          className="stroke-[#141414]/10"
                          strokeWidth="2.5"
                          fill="transparent"
                        />
                        <motion.circle
                          cx="16"
                          cy="16"
                          r="12"
                          className={sale.countdownSeconds < 30 ? "stroke-red-500" : "stroke-[#e6009e]"}
                          strokeWidth="2.5"
                          fill="transparent"
                          strokeDasharray="75.4"
                          strokeDashoffset={75.4 - (75.4 * Math.max(0, sale.countdownSeconds)) / 90}
                          transition={{ duration: 1, ease: PREMIUM_EASE }}
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[#f4f4f5] px-4 py-3 ring-1 ring-[#141414]/8">
                    <div className="flex items-center gap-1.5 text-[#14b8a6]">
                      <Users size={14} weight="fill" />
                      <span className="text-[10px] uppercase tracking-[0.12em]">
                        Viewing
                      </span>
                    </div>
                    <p
                      className="mt-1 font-mono text-lg font-bold tabular-nums text-[#141414]"
                      data-testid="flash-sale-social-proof"
                    >
                      {liveViewers}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#8a8a8a]">
                      people viewing this deal
                    </p>
                  </div>
                </div>

                {/* Token cost + grab / claimed state */}
                {claimed ? (
                  <div
                    className="flex items-center justify-center gap-2 rounded-2xl bg-[#14b8a6]/10 px-4 py-4 ring-1 ring-[#14b8a6]/30"
                    data-testid="flash-sale-claimed"
                  >
                    <CheckCircle
                      size={18}
                      weight="fill"
                      className="text-[#14b8a6]"
                    />
                    <span className="text-sm font-semibold tracking-tight text-[#14b8a6]">
                      Deal Claimed!
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-2xl bg-[#141414]/5 px-4 py-3 ring-1 ring-[#141414]/10">
                    <div>
                      <p
                        className="font-mono text-xl font-bold tabular-nums text-[#e6009e]"
                        data-testid="flash-sale-cost"
                      >
                        {sale.tokenCost}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8a8a]">
                        Tokens to grab
                      </p>
                    </div>
                    <button
                      onClick={onGrab}
                      disabled={!canAfford}
                      aria-label={`Grab deal for ${sale.tokenCost} tokens`}
                      className={cn(
                        "flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] transition-all duration-200 active:scale-[0.98]",
                        canAfford
                          ? "btn-magenta"
                          : "cursor-not-allowed bg-white text-[#8a8a8a] ring-1 ring-[#141414]/10"
                      )}
                      data-testid="flash-sale-grab-button"
                    >
                      <Eye size={14} weight="fill" />
                      {canAfford ? "Grab Deal" : `${shortfall} more`}
                    </button>
                  </div>
                )}

                {!claimed && (
                  <button
                    onClick={handleDismiss}
                    className="mt-4 w-full rounded-full bg-white py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#4b4b4b] ring-1 ring-[#141414]/10 transition-all duration-200 hover:bg-[#f4f4f5] active:scale-[0.98]"
                    data-testid="flash-sale-maybe-later"
                  >
                    Maybe Later
                  </button>
                )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
   Helpers
   ========================================================================== */

/**
 * Countdown display. The remaining seconds are driven by the EventScheduler's
 * background timer tick (which updates `sale.countdownSeconds` in the economy
 * store for ALL active sales), so this component is a pure display + expiry
 * safety net. It no longer runs its own interval — the scheduler is the single
 * source of truth for countdown progression, ensuring hidden pending sales
 * age out even when the overlay is closed.
 */
function Countdown({
  remaining,
  onExpire,
}: {
  remaining: number;
  onExpire: () => void;
}) {
  const expiredRef = useRef(false);

  useEffect(() => {
    if (remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire();
    }
  }, [remaining, onExpire]);

  return (
    <p
      className="mt-1 font-mono text-lg font-bold tabular-nums text-[#141414]"
      data-testid="flash-sale-timer-value"
    >
      {formatTime(remaining)}
    </p>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default FlashSale;
