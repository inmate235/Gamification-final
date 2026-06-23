"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tag, Timer, Users, Eye, Lightning } from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { useEconomyStore } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import { claimFlashSale } from "@/engine/tokenEconomy";
import { getStoreById } from "@/data/mallData";
import { cn } from "@/lib/utils";
import type { FlashSale as FlashSaleType } from "@/types";

/**
 * FlashSale - a minimal flash-sale overlay demonstrating the token SPENDING
 * path (VAL-TOKEN-009). Shows a deficit-priced deal and a "Grab Deal" control
 * that deducts the frozen tokenCost via the canonical economyStore.claimFlashSale
 * action.
 *
 * NOTE: This is a foundation for the dedicated flash-sales feature, which will
 * layer on proximity triggering, synthetic timers, personalization, social
 * proof and refractory periods. The spending action + deficit-priced cost live
 * in economyStore/engine and are reused as-is by that feature.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Floating trigger button ("Deal Radar")
   ========================================================================== */

export function FlashSaleEntryButton() {
  const showOverlay = useUIStore((s) => s.showOverlay);
  const triggerDeficitFlashSale = useEconomyStore((s) => s.triggerDeficitFlashSale);
  const activeOverlay = useUIStore((s) => s.activeOverlay);

  const onTrigger = useCallback(() => {
    const s = triggerDeficitFlashSale();
    if (s) showOverlay("flash-sale", s);
  }, [triggerDeficitFlashSale, showOverlay]);

  if (activeOverlay !== "none" && activeOverlay !== "flash-sale") return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: PREMIUM_EASE }}
      onClick={onTrigger}
      aria-label="Open a flash deal"
      className="fixed bottom-28 left-3 z-30 flex items-center gap-2 rounded-full bg-[#12121a]/90 px-4 py-2.5 ring-1 ring-[#e879a1]/30 backdrop-blur-2xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] sm:bottom-32 sm:left-4"
      style={{ boxShadow: "0 0 20px rgba(232,121,161,0.22)" }}
      data-testid="flash-sale-entry-button"
    >
      <Lightning size={16} weight="light" className="text-[#e879a1]" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a1a1aa]">
        Deal Radar
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
  const removeFlashSale = useEconomyStore((s) => s.removeFlashSale);
  const flashSales = useEconomyStore((s) => s.flashSales);
  const tokens = usePlayerStore((s) => s.tokens);

  // The sale to display: prefer the overlay payload, else the first active.
  const sale =
    (overlayData as FlashSaleType | null) ??
    flashSales[0] ??
    null;

  const isOpen = activeOverlay === "flash-sale" && sale !== null;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, hideOverlay]);

  const handleClose = useCallback(() => hideOverlay(), [hideOverlay]);

  // Expire the sale when its countdown reaches zero.
  const onExpire = useCallback(() => {
    const current = sale?.id;
    if (!current) return;
    removeFlashSale(current);
    hideOverlay();
  }, [sale?.id, removeFlashSale, hideOverlay]);

  // onGrab must be declared before the early return so hook count is stable.
  // claimFlashSale already switches the overlay to the spend celebration, which
  // replaces the flash-sale overlay, so no explicit hide is needed here.
  const onGrab = useCallback(() => {
    const current = sale?.id;
    if (!current) return;
    claimFlashSale(current);
  }, [sale?.id]);

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
          onClick={handleClose}
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
                      <h2 className="mt-1 text-lg font-bold tracking-tight text-[#f5f5f7]">
                        {store?.name ?? "Exclusive Deal"}
                      </h2>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
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
                  <p className="mt-1 text-sm leading-relaxed text-[#a1a1aa]">
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
                      onExpire={onExpire}
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
                  </div>
                </div>

                {/* Token cost + grab */}
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

                <button
                  onClick={handleClose}
                  className="mt-4 w-full rounded-full bg-white/5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#a1a1aa] ring-1 ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/10 active:scale-[0.98]"
                >
                  Maybe Later
                </button>
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
 * Self-contained ticking countdown. Keyed by sale.id in the parent so each
 * new sale remounts it with a fresh `seconds` initializer (no synchronous
 * setState in an effect needed to reset). setState only happens inside the
 * interval callback.
 */
function Countdown({
  seconds,
  onExpire,
}: {
  seconds: number;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire();
    }
  }, [remaining, onExpire]);

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
