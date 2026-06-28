"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Warning, Coin, Crown, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { usePlayerStore } from "@/stores/playerStore";
import { computeDay1Penalty } from "@/engine/streakEngine";
import type { PenaltyResult } from "@/engine/streakEngine";

/**
 * StreakPenaltyNotification — a dismissible alert that surfaces when a
 * streak miss penalty is applied (VAL-STREAK-005..008).
 *
 * Watches the playerStore streak state for changes to `missedDays` and
 * `broken`. When a new miss is detected, it reads the `lastStreakPenalty`
 * snapshot (written by `simulateMissedDay` / the EventScheduler's missed-day
 * processing) which carries the ACTUAL capped token loss, so the Day-1
 * notification never overstates the deduction when the balance is below the
 * computed penalty.
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
  "perk-loss": "#e6009e",
  "tier-demotion": "#b87333",
} as const;

export function StreakPenaltyNotification() {
  const missedDays = usePlayerStore((s) => s.streak.missedDays);
  const lastStreakPenalty = usePlayerStore((s) => s.lastStreakPenalty);
  const tier = usePlayerStore((s) => s.tier);
  const [prevMissedDays, setPrevMissedDays] = useState(0);
  const [penalty, setPenalty] = useState<PenaltyResult | null>(null);

  // Adjust local state when missedDays increases (React-recommended
  // "adjusting state when a prop/store value changes" pattern — no effect or
  // ref needed). Prefer the engine-written `lastStreakPenalty` snapshot which
  // carries the ACTUAL capped token loss so the Day-1 notification never
  // overstates the deduction (VAL-STREAK-005..008).
  if (missedDays > prevMissedDays) {
    setPrevMissedDays(missedDays);
    if (lastStreakPenalty) {
      setPenalty(lastStreakPenalty as PenaltyResult);
    } else {
      setPenalty(buildPenaltyDisplay(missedDays, tier));
    }
  }

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
        className="fixed left-1/2 top-32 z-40 flex max-w-[340px] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 ring-1 backdrop-blur-sm"
        style={{
          background: "rgba(255,255,255,0.97)",
          borderColor: `${color}40`,
          boxShadow: "0 4px 20px rgba(20,20,20,0.08)",
        }}
        role="alert"
        data-testid="streak-penalty-notification"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${color}15` }}
        >
          <Icon size={16} weight="fill" style={{ color }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#141414]">
            <Warning size={12} weight="fill" style={{ color }} />
            <span className="capitalize">{penalty.type.replace("-", " ")}</span>
            <span className="text-xs font-normal text-[#8a8a8a]">
              · Day {penalty.missedDay} miss
            </span>
          </p>
          <p className="mt-0.5 text-xs text-[#4b4b4b]">{penalty.message}</p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#8a8a8a] transition-colors hover:text-[#141414]"
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Build a fallback penalty display result for a given missed day. This is
 * used ONLY when no `lastStreakPenalty` snapshot is available (e.g. a path
 * that bypassed `simulateMissedDay`). The Day-1 token loss is capped at the
 * player's current balance so the notification never overstates the actual
 * deduction (VAL-STREAK-005).
 */
function buildPenaltyDisplay(missedDay: number, currentTier: string): PenaltyResult {
  const player = usePlayerStore.getState();
  switch (missedDay) {
    case 1: {
      // Cap the displayed loss at the current balance so the notification
      // never claims more tokens were lost than the player actually had.
      const penalty = computeDay1Penalty(player.tierXP);
      const actualLost = Math.min(player.tokens, penalty);
      return {
        type: "token-loss",
        missedDay: 1,
        message: `Streak broken! You lost ${actualLost} tokens for missing Day 1.`,
        tokensLost: actualLost,
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
