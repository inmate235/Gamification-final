"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Warning, Coin, Crown, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { usePlayerStore } from "@/stores/playerStore";
import {
  computeDay1Penalty,
} from "@/engine/streakEngine";
import type { PenaltyResult } from "@/engine/streakEngine";

/**
 * StreakPenaltyNotification — a dismissible alert that surfaces when a
 * streak miss penalty is applied (VAL-STREAK-005..008).
 *
 * Watches the playerStore streak state for changes to `missedDays` and
 * `broken`. When a new miss is detected, it generates the appropriate
 * penalty notification (token loss -> perk loss -> tier demotion, in that
 * order across consecutive missed days, VAL-STREAK-008).
 *
 * This component is self-contained: it subscribes to the store and shows
 * notifications automatically when the streak-break escalation advances.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

const PENALTY_ICONS = {
  "token-loss": Coin,
  "perk-loss": Sparkle,
  "tier-demotion": Crown,
} as const;

const PENALTY_COLORS = {
  "token-loss": "#ef4444",
  "perk-loss": "#e879a1",
  "tier-demotion": "#b87333",
} as const;

export function StreakPenaltyNotification() {
  const missedDays = usePlayerStore((s) => s.streak.missedDays);
  const broken = usePlayerStore((s) => s.streak.broken);
  const tier = usePlayerStore((s) => s.tier);
  const prevMissedDaysRef = useRef(0);
  const [penalty, setPenalty] = useState<PenaltyResult | null>(null);

  // When missedDays increases, generate a penalty notification for that
  // specific day (VAL-STREAK-005..008).
  useEffect(() => {
    if (missedDays > prevMissedDaysRef.current) {
      // Reconstruct the penalty result for this missed day. The store has
      // already applied the penalty (via registerMissedDay / demoteTier),
      // so we generate the notification info for display only.
      const result = buildPenaltyDisplay(missedDays, tier);
      setPenalty(result);
    }
    prevMissedDaysRef.current = missedDays;
  }, [missedDays, tier, broken]);

  const handleDismiss = () => setPenalty(null);

  if (!penalty) return null;

  const Icon = PENALTY_ICONS[penalty.type];
  const color = PENALTY_COLORS[penalty.type];

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, y: -24, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -24, scale: 0.9 }}
        transition={{ duration: 0.6, ease: PREMIUM_EASE }}
        className="fixed left-1/2 top-32 z-40 flex max-w-[340px] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 ring-1 backdrop-blur-2xl"
        style={{
          background: "rgba(18,18,26,0.96)",
          borderColor: `${color}55`,
          boxShadow: `0 0 24px ${color}33`,
        }}
        role="alert"
        data-testid="streak-penalty-notification"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${color}15` }}
        >
          <Icon size={16} weight="light" style={{ color }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#f5f5f7]">
            <Warning size={12} weight="fill" style={{ color }} />
            <span className="capitalize">{penalty.type.replace("-", " ")}</span>
            <span className="text-xs font-normal text-[#71717a]">
              · Day {penalty.missedDay} miss
            </span>
          </p>
          <p className="mt-0.5 text-xs text-[#a1a1aa]">{penalty.message}</p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#71717a] transition-colors hover:text-[#f5f5f7]"
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Build a penalty display result for a given missed day. This is for UI
 * notification only — the actual penalty (token deduction, perk removal,
 * tier demotion) has already been applied by the store.
 */
function buildPenaltyDisplay(missedDay: number, currentTier: string): PenaltyResult {
  const player = usePlayerStore.getState();
  switch (missedDay) {
    case 1: {
      const penalty = computeDay1Penalty(player.tierXP);
      return {
        type: "token-loss",
        missedDay: 1,
        message: `Streak broken! You lost ${penalty} tokens for missing Day 1.`,
        tokensLost: penalty,
      };
    }
    case 2: {
      return {
        type: "perk-loss",
        missedDay: 2,
        message: `Day 2 missed! You've lost a perk. Don't lose your tier next!`,
      };
    }
    case 3: {
      return {
        type: "tier-demotion",
        missedDay: 3,
        message: `Day 3 missed! You've been demoted to ${currentTier}.`,
        newTier: currentTier as PenaltyResult["newTier"],
      };
    }
    default: {
      return {
        type: "tier-demotion",
        missedDay,
        message: `Streak fully broken. Visit to start a new streak.`,
      };
    }
  }
}

export default StreakPenaltyNotification;
