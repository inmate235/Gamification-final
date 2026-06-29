"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, X } from "@phosphor-icons/react/dist/ssr";
import { usePlayerStore } from "@/stores/playerStore";
import { useUIStore } from "@/stores/uiStore";
import { getTierHint, computeTierProgressScore } from "@/engine/tierEngine";
import { TIER_VISUALS } from "@/data/tierData";

/**
 * TierHint — a dismissible aspiration banner that surfaces before a tier
 * upgrade (VAL-TIER-028). Shows how much progress remains to the next tier
 * and a teaser of the next tier's earn-rate multiplier.
 *
 * The hint appears when the player is within a reasonable distance of the
 * next tier threshold and is auto-dismissable. Tapping it opens the perks
 * panel.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;
/** Show the hint when within this many score points of the next tier. */
const HINT_PROXIMITY = 8;

export function TierHint() {
  const tier = usePlayerStore((s) => s.tier);
  const tierXP = usePlayerStore((s) => s.tierXP);
  const showOverlay = useUIStore((s) => s.showOverlay);
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const [dismissed, setDismissed] = useState(false);

  const hint = useMemo(() => {
    const score = computeTierProgressScore(tierXP);
    return getTierHint(tier, score);
  }, [tier, tierXP]);

  // Don't show while an overlay is open or after dismissal or when at top tier
  // or when the remaining distance is larger than the proximity window.
  const visible =
    hint !== null &&
    !dismissed &&
    activeOverlay === "none" &&
    hint.remaining <= HINT_PROXIMITY;

  if (!hint) return null;

  const nextVisual = TIER_VISUALS[hint.nextTier];

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          layout
          initial={{ opacity: 0, y: -24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.9 }}
          transition={{ duration: 0.7, ease: PREMIUM_EASE }}
          onClick={() => showOverlay("tier-perks")}
          className="fixed top-24 left-1/2 z-40 flex -translate-x-1/2 w-max items-center gap-2.5 rounded-full bg-[#16161a]/95 px-4 py-2 border border-white/[0.08] backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.02)] transition-[background-color,border-color,transform,box-shadow] duration-200 hover:bg-[#1f1f24] hover:border-white/[0.12] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6009e]/50"
          aria-label={hint.message}
          data-testid="tier-hint"
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{ background: `${nextVisual.color}26` }}
          >
            <ArrowUp size={12} weight="bold" style={{ color: nextVisual.color }} />
          </span>
          <span className="min-w-0 flex-1 text-left text-[12px] font-medium leading-tight text-white/90">
            <span style={{ color: nextVisual.color }}>
              {hint.remaining} more
            </span>{" "}
            to {nextVisual.label}!
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                setDismissed(true);
              }
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white/80"
            aria-label="Dismiss hint"
          >
            <X size={11} weight="bold" />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default TierHint;
