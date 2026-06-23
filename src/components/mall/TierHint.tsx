"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, X } from "@phosphor-icons/react/dist/ssr";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
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
  const explorationPercent = useMapStore((s) => s.explorationPercent);
  const showOverlay = useUIStore((s) => s.showOverlay);
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const [dismissed, setDismissed] = useState(false);

  const hint = useMemo(() => {
    const score = computeTierProgressScore(tierXP, explorationPercent);
    return getTierHint(tier, score);
  }, [tier, tierXP, explorationPercent]);

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
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.9 }}
          transition={{ duration: 0.7, ease: PREMIUM_EASE }}
          onClick={() => showOverlay("tier-perks")}
          className="fixed bottom-28 right-3 z-30 flex max-w-[220px] items-center gap-2 rounded-full bg-[#12121a]/90 px-3.5 py-2.5 ring-1 backdrop-blur-2xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] sm:bottom-32 sm:right-4"
          style={{
            borderColor: `${nextVisual.color}55`,
            boxShadow: `0 0 18px ${nextVisual.color}33`,
          }}
          aria-label={hint.message}
          data-testid="tier-hint"
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{ background: `${nextVisual.color}26` }}
          >
            <ArrowUp size={12} weight="bold" style={{ color: nextVisual.color }} />
          </span>
          <span className="min-w-0 flex-1 text-left text-[11px] leading-tight text-[#f5f5f7]">
            <span className="font-semibold" style={{ color: nextVisual.color }}>
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
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#71717a] transition-colors hover:text-[#f5f5f7]"
            aria-label="Dismiss hint"
          >
            <X size={11} weight="light" />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default TierHint;
