"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Warning, ArrowDown } from "@phosphor-icons/react/dist/ssr";
import { usePlayerStore } from "@/stores/playerStore";
import { TIER_VISUALS } from "@/data/tierData";
import { previousTierOf } from "@/engine/tierEngine";

/**
 * TierDemotionThreat — a dismissible warning banner shown when the player's
 * streak breaks, signalling that their tier is at risk of demotion
 * (VAL-TIER-021). References the current tier and the demotion consequence
 * (the tier one level below).
 *
 * The banner appears when `playerStore.streak.broken` is true and auto-hides
 * on dismiss. When the streak-break escalation reaches Day 3 the playerStore
 * demotes the tier directly (VAL-TIER-022, VAL-TIER-024), and the status bar
 * / perks panel update immediately.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

export function TierDemotionThreat() {
  const streak = usePlayerStore((s) => s.streak);
  const tier = usePlayerStore((s) => s.tier);
  const [dismissed, setDismissed] = useState(false);

  const threatenedTier = previousTierOf(tier);
  const visible = streak.broken && !dismissed && threatenedTier !== null;

  const currentVisual = TIER_VISUALS[tier];
  const threatenedVisual = threatenedTier ? TIER_VISUALS[threatenedTier] : currentVisual;

  return (
    <AnimatePresence>
      {visible && threatenedTier && (
        <motion.div
          layout
          initial={{ opacity: 0, y: -24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.9 }}
          transition={{ duration: 0.7, ease: PREMIUM_EASE }}
          className="fixed left-1/2 top-20 z-30 flex max-w-[320px] -translate-x-1/2 items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 backdrop-blur-sm"
          style={{
            borderColor: "rgba(239,68,68,0.35)",
            boxShadow: "0 4px 20px rgba(20,20,20,0.08)",
          }}
          role="alert"
          data-testid="tier-demotion-threat"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ef4444]/12">
            <Warning size={16} weight="fill" className="text-[#ef4444]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#141414]">
              Your {currentVisual.label} tier is at risk
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-[#4b4b4b]">
              <ArrowDown size={10} weight="bold" style={{ color: threatenedVisual.color }} />
              Miss another day and you drop to{" "}
              <span className="font-semibold" style={{ color: threatenedVisual.color }}>
                {threatenedVisual.label}
              </span>
              . Day {streak.missedDays + 1} of 3.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss warning"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#8a8a8a] transition-colors hover:text-[#141414]"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default TierDemotionThreat;
