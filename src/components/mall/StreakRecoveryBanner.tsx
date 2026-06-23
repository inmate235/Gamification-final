"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fire, Lightning, Timer } from "@phosphor-icons/react/dist/ssr";
import { usePlayerStore } from "@/stores/playerStore";
import {
  formatRecoveryCountdown,
  getRecoveryCountdownMs,
  getComebackBonusCountdownMs,
  isComebackBonusActive,
} from "@/engine/streakEngine";

/**
 * StreakRecoveryBanner — shows when the 48-hour recovery window is active
 * (VAL-STREAK-010, VAL-STREAK-011). Displays a live countdown of the
 * remaining recovery time. When the comeback bonus (2x tokens for 30 min)
 * is also active, shows a distinct 2x indicator (VAL-STREAK-012).
 *
 * The countdown updates every second via a local timer, and the banner
 * auto-hides when the recovery window closes (either via expiry or via a
 * recovery return).
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

export function StreakRecoveryBanner() {
  const streak = usePlayerStore((s) => s.streak);
  const [now, setNow] = useState(() => Date.now());

  // Tick the countdown every second.
  useEffect(() => {
    if (!streak.recoveryWindow) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [streak.recoveryWindow]);

  // Track the recovery window start — when it changes, reset dismissal.
  const windowKey = streak.recoveryWindowStart;
  const [dismissedKey, setDismissedKey] = useState<number | null>(null);
  const handleDismiss = () => setDismissedKey(windowKey);

  const comebackActive = isComebackBonusActive(streak, now);
  const comebackRemainingMs = getComebackBonusCountdownMs(streak, now);
  const countdownText = formatRecoveryCountdown(streak, now);
  const recoveryRemaining = getRecoveryCountdownMs(streak, now);
  const visible = streak.recoveryWindow && dismissedKey !== windowKey && recoveryRemaining > 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.92 }}
          transition={{ duration: 0.6, ease: PREMIUM_EASE }}
          className="fixed left-1/2 top-20 z-30 flex max-w-[360px] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 ring-1 backdrop-blur-2xl"
          style={{
            background: "rgba(18,18,26,0.95)",
            borderColor: "rgba(157,127,219,0.40)",
            boxShadow: "0 0 24px rgba(157,127,219,0.20)",
          }}
          role="status"
          data-testid="streak-recovery-banner"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#9d7fdb]/15">
            <Fire size={16} weight="light" className="text-[#9d7fdb]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#f5f5f7]">
              Streak Recovery Window
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#a1a1aa]">
              <Timer size={10} weight="light" className="shrink-0 text-[#9d7fdb]" />
              <span className="font-mono tabular-nums text-[#9d7fdb]">
                {countdownText}
              </span>
              <span className="truncate">to recover your streak</span>
            </p>
            {comebackActive && (
              <p
                className="mt-1 flex items-center gap-1 text-xs font-semibold"
                style={{ color: "#d4af37" }}
                data-testid="comeback-bonus-indicator"
              >
                <Lightning size={10} weight="fill" className="shrink-0" />
                <span>
                  2x tokens active —{" "}
                  {Math.ceil(comebackRemainingMs / 60000)}m left
                </span>
              </p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#71717a] transition-colors hover:text-[#f5f5f7]"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default StreakRecoveryBanner;
