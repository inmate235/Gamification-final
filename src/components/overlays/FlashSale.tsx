"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Tag,
  Timer,
  Users,
  Eye,
  Lightning,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { useEconomyStore } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import { claimFlashSale } from "@/engine/tokenEconomy";
import {
  dismissFlashSale,
  expireFlashSale,
  activeFlashSales,
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
   Floating entry button ("Deal Radar")
   ========================================================================== */

/**
 * Surfaces any pending proximity-triggered flash sale that wasn't shown
 * immediately (e.g. it triggered while another overlay was open). Shows a
 * badge with the pending count. On tap, opens the first pending sale.
 */
export function FlashSaleEntryButton() {
  const showOverlay = useUIStore((s) => s.showOverlay);
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const flashSaleCount = useEconomyStore((s) => s.flashSales.length);

  const onOpen = useCallback(() => {
    const pending = activeFlashSales();
    const sale = pending[0];
    if (sale) showOverlay("flash-sale", sale);
  }, [showOverlay]);

  // Hide while another (non-flash-sale) overlay is capturing the screen.
  if (activeOverlay !== "none" && activeOverlay !== "flash-sale") return null;
  // Only show when there is a pending sale to surface.
  if (flashSaleCount === 0) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 24, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.85 }}
      transition={{ duration: 0.7, ease: PREMIUM_EASE }}
      onClick={onOpen}
      aria-label={`Open flash deal (${flashSaleCount} pending)`}
      className="fixed bottom-28 left-3 z-30 flex items-center gap-2 rounded-full bg-[#12121a]/90 px-4 py-2.5 ring-1 ring-[#e879a1]/30 backdrop-blur-2xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] sm:bottom-32 sm:left-4"
      style={{ boxShadow: "0 0 20px rgba(232,121,161,0.22)" }}
      data-testid="flash-sale-entry-button"
    >
      <motion.div
        animate={{ scale: [1, 1.18, 1] }}
        transition={{
          duration: 1.6,
          ease: PREMIUM_EASE,
          repeat: Infinity,
        }}
      >
        <Lightning size={16} weight="light" className="text-[#e879a1]" />
      </motion.div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a1a1aa]">
        Deal Radar
      </span>
      <span
        className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e879a1] px-1.5 text-[10px] font-bold text-black"
        data-testid="flash-sale-entry-badge"
      >
        {flashSaleCount}
      </span>
    </motion.button>
  );
}

/* ============================================================================
   Overlay
   ========================================================================== */

export function FlashSale() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const overlayData = useUIStore((s) => s.overlayData) as FlashSaleType | null;
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  const flashSales = useEconomyStore((s) => s.flashSales);
  const tokens = usePlayerStore((s) => s.tokens);

  // The sale to display: prefer the overlay payload, else the first active.
  const sale =
    (overlayData as FlashSaleType | null) ?? flashSales[0] ?? null;

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

  // Grab Deal: deduct tokens, show claimed state, then the spend celebration.
  const onGrab = useCallback(() => {
    const current = sale?.id;
    if (!current) return;
    const ok = claimFlashSale(current);
    if (ok) {
      // Show an inline claimed confirmation for a beat before the celebration
      // overlay replaces this one.
      setClaimed(true);
      if (claimedTimerRef.current) clearTimeout(claimedTimerRef.current);
      claimedTimerRef.current = setTimeout(() => {
        setClaimed(false);
      }, 1200);
    }
  }, [sale?.id]);

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
          className="fixed inset-0 z-40 flex items-center justify-center px-4 py-20"
          onClick={handleDismiss}
          data-testid="flash-sale-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Flash sale"
        >
          <div className="absolute inset-0 backdrop-blur-2xl bg-black/60" />

          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="bezel-card"
              style={{ boxShadow: "0 0 24px rgba(232,121,161,0.18)" }}
            >
              <div className="bezel-card-inner p-6 sm:p-7">
                {/* Header */}
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e879a1]/10 ring-1 ring-[#e879a1]/30">
                      <Tag size={16} weight="light" className="text-[#e879a1]" />
                    </span>
                    <div>
                      <span className="inline-block rounded-full bg-[#e879a1]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] font-medium text-[#e879a1]">
                        Flash Sale
                      </span>
                      <h2
                        className="mt-1 text-lg font-bold tracking-tight text-[#f5f5f7]"
                        data-testid="flash-sale-store-name"
                      >
                        {store?.name ?? "Exclusive Deal"}
                      </h2>
                      {store && (
                        <span className="text-[10px] uppercase tracking-[0.14em] text-[#71717a]">
                          {store.category}
                          {sale.personalized ? " · picked for you" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleDismiss}
                    aria-label="Close flash sale"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/10 active:scale-[0.96]"
                  >
                    <X size={16} weight="light" className="text-[#a1a1aa]" />
                  </button>
                </div>

                {/* Discount + item */}
                <div
                  className="mb-4 rounded-2xl bg-[#e879a1]/8 p-4 ring-1 ring-[#e879a1]/20"
                  data-testid="flash-sale-deal"
                >
                  <p
                    className="font-mono text-2xl font-bold tabular-nums text-[#e879a1]"
                    data-testid="flash-sale-discount"
                  >
                    {sale.discount}
                  </p>
                  <p
                    className="mt-1 text-sm leading-relaxed text-[#a1a1aa]"
                    data-testid="flash-sale-item"
                  >
                    {sale.itemDescription ?? "A members-only flash deal."}
                  </p>
                </div>

                {/* Countdown + social proof */}
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div
                    className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
                    data-testid="flash-sale-timer"
                  >
                    <div className="flex items-center gap-1.5 text-[#e879a1]">
                      <Timer size={14} weight="light" />
                      <span className="text-[10px] uppercase tracking-[0.12em]">
                        Ends in
                      </span>
                    </div>
                    <Countdown
                      key={sale.id}
                      seconds={sale.countdownSeconds}
                      tickMs={sale.syntheticTickMs ?? 1000}
                      onExpire={onExpire}
                      paused={claimed}
                    />
                  </div>
                  <div className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                    <div className="flex items-center gap-1.5 text-[#4fd1c5]">
                      <Users size={14} weight="light" />
                      <span className="text-[10px] uppercase tracking-[0.12em]">
                        Viewing
                      </span>
                    </div>
                    <p
                      className="mt-1 font-mono text-lg font-bold tabular-nums text-[#f5f5f7]"
                      data-testid="flash-sale-social-proof"
                    >
                      {sale.socialProof ?? 23}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#71717a]">
                      people viewing this deal
                    </p>
                  </div>
                </div>

                {/* Token cost + grab / claimed state */}
                {claimed ? (
                  <div
                    className="flex items-center justify-center gap-2 rounded-2xl bg-[#4fd1c5]/10 px-4 py-4 ring-1 ring-[#4fd1c5]/30"
                    data-testid="flash-sale-claimed"
                  >
                    <CheckCircle
                      size={18}
                      weight="light"
                      className="text-[#4fd1c5]"
                    />
                    <span className="text-sm font-semibold tracking-tight text-[#4fd1c5]">
                      Deal Claimed!
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-2xl bg-black/30 px-4 py-3 ring-1 ring-white/[0.06]">
                    <div>
                      <p
                        className="font-mono text-xl font-bold tabular-nums text-[#d4af37]"
                        data-testid="flash-sale-cost"
                      >
                        {sale.tokenCost}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#71717a]">
                        Tokens to grab
                      </p>
                    </div>
                    <button
                      onClick={onGrab}
                      disabled={!canAfford}
                      aria-label={`Grab deal for ${sale.tokenCost} tokens`}
                      className={cn(
                        "flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]",
                        canAfford
                          ? "bg-gradient-to-r from-[#d4af37] to-[#b8941f] text-black"
                          : "cursor-not-allowed bg-white/5 text-[#71717a] ring-1 ring-white/10"
                      )}
                      data-testid="flash-sale-grab-button"
                    >
                      <Eye size={14} weight="light" />
                      {canAfford ? "Grab Deal" : `${shortfall} more`}
                    </button>
                  </div>
                )}

                {!claimed && (
                  <button
                    onClick={handleDismiss}
                    className="mt-4 w-full rounded-full bg-white/5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#a1a1aa] ring-1 ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/10 active:scale-[0.98]"
                    data-testid="flash-sale-maybe-later"
                  >
                    Maybe Later
                  </button>
                )}
              </div>
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
 * Self-contained ticking countdown. Keyed by sale.id in the parent so each new
 * sale remounts it with a fresh `seconds` initializer. The tick interval is
 * `tickMs`, which is intentionally slower than a real second for the synthetic
 * timer (VAL-SALE-006). `paused` freezes the countdown (e.g. while the claimed
 * state is shown).
 */
function Countdown({
  seconds,
  tickMs,
  onExpire,
  paused = false,
}: {
  seconds: number;
  tickMs: number;
  onExpire: () => void;
  paused?: boolean;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, tickMs);
    return () => clearInterval(t);
  }, [tickMs, paused]);

  useEffect(() => {
    if (remaining <= 0 && !expiredRef.current && !paused) {
      expiredRef.current = true;
      onExpire();
    }
  }, [remaining, onExpire, paused]);

  return (
    <p
      className="mt-1 font-mono text-lg font-bold tabular-nums text-[#f5f5f7]"
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
