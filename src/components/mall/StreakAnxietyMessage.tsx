"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fire, ClockClockwise } from "@phosphor-icons/react/dist/ssr";
import { usePlayerStore } from "@/stores/playerStore";
import { getStreakAnxietyMessage } from "@/engine/streakEngine";

/**
 * StreakAnxietyMessage — a dismissible banner that surfaces streak-anxiety
 * messaging ("Visit tomorrow to keep your streak!") to pressure the user
 * into returning (VAL-STREAK-014).
 *
 * The banner appears after a short delay (simulating end-of-session timing)
 * and shows the current streak count alongside the anxiety message. It
 * auto-hides on dismiss and reappears if the streak state changes
 * significantly (e.g. after a break).
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

export function StreakAnxietyMessage() {
  const streak = usePlayerStore((s) => s.streak);
  const [visible, setVisible] = useState(false);

  // Track the "dismissed key" — a combination of streak count + broken state.
  // When the streak changes, the key changes and the banner reappears.
  const streakKey = `${streak.count}-${streak.broken}`;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  // Show the banner after a delay (simulating end-of-session anxiety).
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  const message = getStreakAnxietyMessage(streak);
  const show = visible && dismissedKey !== streakKey;

  const handleDismiss = () => setDismissedKey(streakKey);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.92 }}
          transition={{ duration: 0.6, ease: PREMIUM_EASE }}
          className="fixed bottom-24 left-1/2 z-20 flex max-w-[340px] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 ring-1 backdrop-blur-2xl sm:bottom-28"
          style={{
            background: "rgba(18,18,26,0.92)",
            borderColor: "rgba(157,127,219,0.35)",
            boxShadow: "0 0 20px rgba(157,127,219,0.15)",
          }}
          role="status"
          data-testid="streak-anxiety-message"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#9d7fdb]/15">
            <Fire size={16} weight="light" className="text-[#9d7fdb]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#f5f5f7]">
              {streak.broken ? "Streak broken" : `Day ${streak.count} streak`}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-[#a1a1aa]">
              <ClockClockwise size={10} weight="light" className="shrink-0 text-[#9d7fdb]" />
              <span className="truncate">{message}</span>
            </p>
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

export default StreakAnxietyMessage;
