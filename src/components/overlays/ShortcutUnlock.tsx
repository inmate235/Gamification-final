"use client";

import { useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightning, Path, Check, Lock } from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { useEconomyStore } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import { unlockShortcut } from "@/engine/tokenEconomy";
import { getZoneById } from "@/data/mallData";
import { cn } from "@/lib/utils";
import type { Shortcut } from "@/types";

/**
 * ShortcutUnlock - the glass overlay where tokens buy faster routes.
 *
 * Shows the active (next locked) shortcut at its FROZEN deficit price, a
 * "next up" teaser at the live deficit price (always 2-3 above balance, the
 * perpetual "always short" anchor), and the list of already-unlocked routes.
 * The Unlock button is enabled only when the balance covers the frozen cost;
 * spending deducts the exact cost and opens the route on the map.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Floating entry button (always visible - the persistent spend opportunity)
   ========================================================================== */

export function ShortcutEntryButton() {
  const showOverlay = useUIStore((s) => s.showOverlay);
  const liveDeficitPrice = useEconomyStore((s) => s.liveDeficitPrice);
  const active = useEconomyStore((s) =>
    s.shortcuts.find((sc) => !sc.unlocked)
  );
  const activeOverlay = useUIStore((s) => s.activeOverlay);

  // Hidden while another overlay is open (avoid stacking).
  const open = useCallback(() => showOverlay("shortcut-unlock"), [showOverlay]);

  if (activeOverlay !== "none" && activeOverlay !== "shortcut-unlock") return null;
  if (!active) return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: PREMIUM_EASE }}
      onClick={open}
      aria-label={`Unlock shortcuts from ${liveDeficitPrice} tokens`}
      className="flex items-center gap-2 rounded-full bg-[#12121a]/80 px-4 py-2.5 ring-1 ring-[#9d7fdb]/30 backdrop-blur-md transition-all duration-700 hover:bg-[#12121a] active:scale-[0.97]"
      data-testid="shortcut-entry-button"
    >
      <Lightning size={16} weight="light" className="text-[#9d7fdb]" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a1a1aa]">
        Shortcuts
      </span>
      <span
        className="font-mono text-xs font-bold tabular-nums text-[#d4af37]"
        data-testid="shortcut-entry-price"
      >
        {liveDeficitPrice}
      </span>
    </motion.button>
  );
}

/* ============================================================================
   Overlay
   ========================================================================== */

export function ShortcutUnlock() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  const shortcuts = useEconomyStore((s) => s.shortcuts);
  const liveDeficitPrice = useEconomyStore((s) => s.liveDeficitPrice);
  const tokens = usePlayerStore((s) => s.tokens);

  const isOpen = activeOverlay === "shortcut-unlock";

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, hideOverlay]);

  const handleClose = useCallback(() => hideOverlay(), [hideOverlay]);

  const active = shortcuts.find((s) => !s.unlocked) ?? null;
  const nextUp = shortcuts.find((s) => !s.unlocked && s.id !== active?.id) ?? null;
  const unlocked = shortcuts.filter((s) => s.unlocked);
  const canAfford = active !== null && tokens >= active.tokenCost;

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
          data-testid="shortcut-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Unlock shortcuts"
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
            <div className="bezel-card glow-amethyst">
              <div className="bezel-card-inner p-6 sm:p-7">
                {/* Header */}
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#9d7fdb]/10 ring-1 ring-[#9d7fdb]/30">
                      <Lightning size={16} weight="light" className="text-[#9d7fdb]" />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-[#f5f5f7]">
                        Secret Shortcuts
                      </h2>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#71717a]">
                        Faster routes through the mall
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    aria-label="Close shortcuts"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/10 active:scale-[0.96]"
                  >
                    <X size={16} weight="light" className="text-[#a1a1aa]" />
                  </button>
                </div>

                {/* Active buyable offer */}
                {active ? (
                  <ActiveShortcutCard
                    shortcut={active}
                    canAfford={canAfford}
                    tokens={tokens}
                  />
                ) : (
                  <p className="rounded-2xl bg-white/5 p-4 text-center text-sm text-[#a1a1aa] ring-1 ring-white/10">
                    All shortcuts unlocked. You know every hidden path.
                  </p>
                )}

                {/* Next-up live deficit teaser (the "always short" anchor) */}
                {nextUp && (
                  <div
                    className="mt-3 flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]"
                    data-testid="shortcut-nextup"
                  >
                    <div className="flex items-center gap-2.5">
                      <Lock size={14} weight="light" className="text-[#71717a]" />
                      <div>
                        <p className="text-xs font-medium text-[#a1a1aa]">
                          {nextUp.name}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-[#71717a]">
                          Next up
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className="font-mono text-sm font-bold tabular-nums text-[#a1a1aa]"
                        data-testid="shortcut-nextup-price"
                      >
                        {liveDeficitPrice}
                      </p>
                      <p className="text-[10px] text-[#71717a]">
                        {Math.max(0, liveDeficitPrice - tokens)} more to unlock
                      </p>
                    </div>
                  </div>
                )}

                {/* Unlocked routes */}
                {unlocked.length > 0 && (
                  <div className="mt-4 space-y-2" data-testid="shortcut-unlocked-list">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#71717a]">
                      Unlocked routes
                    </p>
                    {unlocked.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2.5 rounded-2xl bg-[#4fd1c5]/8 px-4 py-2.5 ring-1 ring-[#4fd1c5]/20"
                      >
                        <Check size={14} weight="bold" className="text-[#4fd1c5]" />
                        <span className="text-xs font-medium text-[#4fd1c5]">
                          {zoneLabel(s.fromZoneId)} ↔ {zoneLabel(s.toZoneId)}
                        </span>
                        <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-[#71717a]">
                          {s.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleClose}
                  className="mt-5 w-full rounded-full bg-white/5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#a1a1aa] ring-1 ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/10 active:scale-[0.98]"
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
   Sub-components
   ========================================================================== */

function ActiveShortcutCard({
  shortcut,
  canAfford,
  tokens,
}: {
  shortcut: Shortcut;
  canAfford: boolean;
  tokens: number;
}) {
  const onUnlock = useCallback(() => {
    unlockShortcut(shortcut.id);
  }, [shortcut.id]);

  const shortfall = Math.max(0, shortcut.tokenCost - tokens);

  return (
    <div
      className="rounded-2xl bg-[#9d7fdb]/8 p-4 ring-1 ring-[#9d7fdb]/25"
      data-testid="shortcut-active-card"
    >
      <div className="mb-2 flex items-center gap-2">
        <Path size={16} weight="light" className="text-[#9d7fdb]" />
        <span className="text-sm font-bold text-[#f5f5f7]">{shortcut.name}</span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-[#a1a1aa]">
        {shortcut.description}
      </p>
      <div className="mb-3 flex items-center justify-between rounded-xl bg-black/30 px-3 py-2 ring-1 ring-white/[0.06]">
        <span className="text-[11px] uppercase tracking-[0.14em] text-[#71717a]">
          Route
        </span>
        <span className="font-mono text-xs font-semibold text-[#f5f5f7]">
          {zoneLabel(shortcut.fromZoneId)} ↔ {zoneLabel(shortcut.toZoneId)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p
            className="font-mono text-xl font-bold tabular-nums text-[#d4af37]"
            data-testid="shortcut-active-cost"
          >
            {shortcut.tokenCost}
          </p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#71717a]">
            Tokens to unlock
          </p>
        </div>
        <button
          onClick={onUnlock}
          disabled={!canAfford}
          aria-label={`Unlock ${shortcut.name} for ${shortcut.tokenCost} tokens`}
          className={cn(
            "rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]",
            canAfford
              ? "bg-gradient-to-r from-[#d4af37] to-[#b8941f] text-black"
              : "cursor-not-allowed bg-white/5 text-[#71717a] ring-1 ring-white/10"
          )}
          data-testid="shortcut-unlock-button"
        >
          {canAfford ? "Unlock" : `${shortfall} more`}
        </button>
      </div>
    </div>
  );
}

function zoneLabel(zoneId: string): string {
  return getZoneById(zoneId)?.name ?? zoneId;
}

export default ShortcutUnlock;
