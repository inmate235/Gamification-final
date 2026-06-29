"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coin,
  Fire,
  Lightning,
  MapPin,
  ShoppingBag,
  SpinnerGap,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import type { CelebrationData, CelebrationHook } from "@/types";

/**
 * Celebration — a parallel celebration toast queue rendered at z-50.
 *
 * Unlike the old approach (which called `showOverlay("celebration")` and
 * replaced whatever was open), this component reads from
 * `uiStore.celebrationQueue` and is ALWAYS mounted. It floats above any open
 * overlay without unmounting it, preserving context (VAL-TOKEN-017).
 *
 * Three visual treatments:
 *   earn   — small gold pill + upward particle burst (existing feel, kept)
 *   spend  — taller purchase receipt card: deal label, animated balance
 *            counter, post-purchase hook CTA that loops the impulse
 *   streak — fire/gold milestone card on streak increments
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;
const EARN_DISMISS_MS = 1800;
const SPEND_DISMISS_MS = 3200;
const STREAK_DISMISS_MS = 2800;

function dismissMs(kind: CelebrationData["kind"]): number {
  if (kind === "spend") return SPEND_DISMISS_MS;
  if (kind === "streak") return STREAK_DISMISS_MS;
  return EARN_DISMISS_MS;
}

/* ============================================================================
   Hook action icons
   ========================================================================== */

const HOOK_ICONS = {
  explore: MapPin,
  wheel: SpinnerGap,
  shop: ShoppingBag,
  dismiss: X,
} as const;

/* ============================================================================
   Animated balance counter
   ========================================================================== */

function BalanceCounter({
  from,
  to,
  durationMs,
}: {
  from: number;
  to: number;
  durationMs: number;
}) {
  const [display, setDisplay] = useState(from);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (from === to) return;
    startRef.current = null;

    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [from, to, durationMs]);

  return <span className="tabular-nums">{display}</span>;
}

/* ============================================================================
   Earn pill (small, upward, gold — existing visual language)
   ========================================================================== */

function EarnPill({ data }: { data: CelebrationData }) {
  const accent = "#e6009e";
  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.95 }}
      transition={{ duration: 0.6, ease: PREMIUM_EASE }}
      className="relative flex items-center gap-3 rounded-full bg-white px-6 py-3 ring-1 shadow-[0_8px_24px_rgba(20,20,20,0.12)]"
      style={{ ["--tw-ring-color" as string]: "rgba(230,0,158,0.4)" }}
    >
      <motion.div
        animate={{ rotate: [0, 14, -14, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 0.8, ease: PREMIUM_EASE, repeat: Infinity }}
      >
        <Coin size={22} weight="fill" style={{ color: accent }} />
      </motion.div>
      <span
        className="font-mono text-lg font-bold tracking-tight"
        style={{ color: accent }}
        data-testid="celebration-message"
      >
        {data.message}
      </span>
      <span className="sr-only" data-testid="celebration-kind">earn</span>
    </motion.div>
  );
}

/* ============================================================================
   Spend receipt card (taller, with balance counter + hook CTA)
   ========================================================================== */

function SpendReceipt({
  data,
  onHookTap,
  onDismiss,
}: {
  data: CelebrationData;
  onHookTap: (action: CelebrationHook["action"]) => void;
  onDismiss: () => void;
}) {
  const total = SPEND_DISMISS_MS;
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const e = Math.min(now - startRef.current, total);
      setElapsed(e);
      if (e < total) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [total]);

  const HookIcon = data.hook ? HOOK_ICONS[data.hook.action] : null;
  const progressFraction = elapsed / total;

  return (
    <motion.div
      initial={{ opacity: 0, y: -24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.96 }}
      transition={{ duration: 0.55, ease: PREMIUM_EASE }}
      className="relative w-[300px] overflow-hidden rounded-2xl bg-white ring-1 shadow-[0_12px_32px_rgba(20,20,20,0.16)]"
      style={{ ["--tw-ring-color" as string]: "rgba(239,68,68,0.25)" }}
      data-testid="celebration-overlay"
    >
      {/* Top section */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ef4444]/10">
            <Coin size={16} weight="fill" className="text-[#ef4444]" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ef4444]">
              Tokens Spent
            </p>
            <span className="sr-only" data-testid="celebration-kind">spend</span>
            {data.label && (
              <p className="text-xs font-medium text-[#4b4b4b] leading-tight max-w-[160px] truncate">
                {data.label}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#8a8a8a] transition-colors hover:text-[#141414]"
        >
          <X size={14} weight="bold" />
        </button>
      </div>

      {/* Balance counter */}
      <div className="mx-4 mb-3 flex items-center justify-between rounded-xl bg-[#f4f4f5] px-3 py-2.5 ring-1 ring-[#141414]/8">
        <div className="text-center">
          <p className="font-mono text-base font-bold tabular-nums text-[#ef4444] line-through opacity-60">
            {data.balanceBefore ?? data.amount + (data.balanceAfter ?? 0)}
          </p>
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#8a8a8a]">Before</p>
        </div>
        <motion.div
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 0.6, ease: PREMIUM_EASE }}
          className="text-[#8a8a8a]"
        >
          <span className="font-mono text-xs font-bold">−{data.amount}</span>
        </motion.div>
        <div className="text-center">
          <p className="font-mono text-base font-bold tabular-nums text-[#141414]">
            <BalanceCounter
              from={data.balanceBefore ?? data.balanceAfter ?? 0}
              to={data.balanceAfter ?? 0}
              durationMs={900}
            />
          </p>
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#8a8a8a]">Now</p>
        </div>
      </div>

      {/* Hook CTA */}
      {data.hook && HookIcon && (
        <button
          onClick={() => onHookTap(data.hook!.action)}
          className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-2 rounded-xl bg-[#141414] px-3 py-2.5 text-left transition-all duration-200 hover:bg-[#202020] active:scale-[0.98]"
          data-testid="celebration-hook-cta"
        >
          <HookIcon size={13} weight="fill" className="shrink-0 text-[#e6b800]" />
          <span className="flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
            {data.hook.label}
          </span>
          <span className="text-[#8a8a8a] text-[10px]">→</span>
        </button>
      )}

      {/* Progress bar auto-dismiss indicator */}
      <div className="h-0.5 w-full bg-[#f4f4f5]">
        <motion.div
          className="h-full bg-[#ef4444]/40"
          initial={{ width: "100%" }}
          animate={{ width: `${(1 - progressFraction) * 100}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

/* ============================================================================
   Streak milestone card (fire/gold)
   ========================================================================== */

function StreakCard({ data }: { data: CelebrationData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{ duration: 0.55, ease: PREMIUM_EASE }}
      className="flex items-center gap-3 rounded-2xl px-5 py-3.5 ring-1 shadow-[0_8px_24px_rgba(20,20,20,0.12)] bg-white"
      style={{ ["--tw-ring-color" as string]: "rgba(230,184,0,0.4)" }}
      data-testid="celebration-overlay"
    >
      <motion.span
        animate={{ scale: [1, 1.3, 1], rotate: [0, -8, 8, 0] }}
        transition={{ duration: 0.9, ease: PREMIUM_EASE }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e6b800]/15"
      >
        <Fire size={20} weight="fill" className="text-[#e6b800]" />
      </motion.span>
      <div>
        <p className="font-display text-sm font-bold tracking-tight text-[#141414]" data-testid="celebration-message">
          {data.message}
        </p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a8a]">
          Day {data.amount} streak
        </p>
      </div>
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        <Lightning size={14} weight="fill" className="text-[#e6b800]" />
      </motion.span>
      <span className="sr-only" data-testid="celebration-kind">streak</span>
    </motion.div>
  );
}

/* ============================================================================
   Particle burst — GPU-safe (transform + opacity only)
   ========================================================================== */

function ParticleBurst({ kind }: { kind: CelebrationData["kind"] }) {
  const isEarn = kind === "earn";
  if (!isEarn) return null;
  const color = "#e6009e";
  const particles = Array.from({ length: 14 });
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const distance = 80 + (i % 3) * 30;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        return (
          <motion.span
            key={i}
            className="absolute h-2 w-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 8px ${color}cc` }}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x: dx, y: dy, scale: 0.4 }}
            transition={{ duration: 1.1, ease: PREMIUM_EASE }}
          />
        );
      })}
    </div>
  );
}

/* ============================================================================
   Root component — always mounted, reads from queue
   ========================================================================== */

export function Celebration() {
  const celebrationQueue = useUIStore((s) => s.celebrationQueue);
  const shiftCelebration = useUIStore((s) => s.shiftCelebration);
  const showOverlay = useUIStore((s) => s.showOverlay);
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  const activeOverlay = useUIStore((s) => s.activeOverlay);

  const current = celebrationQueue[0] ?? null;
  const kind = current?.kind ?? "earn";

  // Auto-dismiss
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => shiftCelebration(), dismissMs(current.kind));
    return () => clearTimeout(t);
  }, [current, shiftCelebration]);

  const handleHookTap = (action: CelebrationHook["action"]) => {
    shiftCelebration();
    if (action === "wheel") {
      showOverlay("spinning-wheel");
    } else if (action === "shop") {
      showOverlay("shop");
    } else if (action === "explore") {
      // Close any open overlay so the map is visible and the user can explore
      if (activeOverlay !== "none") hideOverlay();
    }
    // "dismiss" just shifts the queue (already done above)
  };

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.message + current.amount + (current.kind ?? "earn")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: PREMIUM_EASE }}
          className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28"
          data-testid="celebration-overlay-wrapper"
          aria-live="assertive"
        >
          <ParticleBurst kind={kind} />

          <div className="pointer-events-auto">
            {kind === "spend" ? (
              <SpendReceipt
                data={current}
                onHookTap={handleHookTap}
                onDismiss={shiftCelebration}
              />
            ) : kind === "streak" ? (
              <StreakCard data={current} />
            ) : (
              <EarnPill data={current} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Celebration;
