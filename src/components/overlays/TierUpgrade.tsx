"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkle,
  ArrowRight,
  Medal,
} from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import { TIER_VISUALS, TIER_PERKS } from "@/data/tierData";
import type { Tier, TierUpgradeData } from "@/types";

/**
 * TierUpgrade — the full-screen celebration played when the player is
 * promoted to a new tier (VAL-TIER-006..008, VAL-TIER-023, VAL-TIER-027).
 *
 * Choreography:
 *   - Full-viewport backdrop in the destination tier's color wash
 *   - Particle explosion in the tier color
 *   - Tier badge scales in with a spring
 *   - Staggered text reveal: eyebrow -> "You are now {Tier}!" -> tagline
 *   - Perks summary for the new tier
 *
 * The status bar tier badge updates immediately (playerStore.tier is set
 * before the overlay opens) so on dismiss the new tier is already shown.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Component
   ========================================================================== */

export function TierUpgrade() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const overlayData = useUIStore((s) => s.overlayData) as TierUpgradeData | null;
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  const tier = usePlayerStore((s) => s.tier);

  const isOpen = activeOverlay === "tier-upgrade" && overlayData !== null;
  const newTier: Tier = overlayData?.newTier ?? tier;
  const visual = TIER_VISUALS[newTier];
  const perks = TIER_PERKS[newTier];

  /* --- Esc to dismiss --- */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, hideOverlay]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: PREMIUM_EASE }}
          className="fixed inset-0 z-40 flex items-center justify-center px-4 py-12"
          onClick={hideOverlay}
          data-testid="tier-upgrade-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Tier upgrade to ${visual.label}`}
        >
          {/* Tier-colored full-viewport wash */}
          <div
            className="absolute inset-0 backdrop-blur-md"
            style={{
              background: `radial-gradient(ellipse at center, ${visual.color}1a 0%, rgba(20,20,20,0.3) 60%, rgba(20,20,20,0.45) 100%)`,
            }}
          />

          {/* Particle explosion in the tier color */}
          <TierParticleBurst color={visual.color} />

          {/* Content card */}
          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.8, ease: PREMIUM_EASE }}
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bezel-card">
              <div className="bezel-card-inner flex flex-col items-center text-center">
                {/* Eyebrow — staggered reveal #1 */}
                <motion.div
                  initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.6, ease: PREMIUM_EASE, delay: 0.15 }}
                  className="mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium ring-1"
                  style={{
                    color: visual.color,
                    borderColor: `${visual.color}55`,
                    background: `${visual.color}14`,
                  }}
                >
                  <Sparkle size={12} weight="fill" style={{ color: visual.color }} />
                  Membership Upgrade
                </motion.div>

                {/* Tier badge — scales in with spring (staggered #2) */}
                <motion.div
                  initial={{ scale: 0, opacity: 0, rotate: -12 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.25 }}
                  className="mb-5 flex h-24 w-24 items-center justify-center rounded-full ring-2"
                  style={{
                    borderColor: visual.color,
                    boxShadow: `0 0 40px ${visual.color}66, inset 0 0 24px ${visual.color}22`,
                    background: `radial-gradient(circle at center, ${visual.color}26, transparent 70%)`,
                  }}
                  data-testid="tier-upgrade-badge"
                >
                  <Medal
                    size={48}
                    weight="fill"
                    style={{ color: visual.color }}
                  />
                </motion.div>

                {/* "You are now {Tier}!" — staggered reveal #3 */}
                <motion.h2
                  initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.7, ease: PREMIUM_EASE, delay: 0.45 }}
                  className="font-display text-3xl font-bold tracking-tight sm:text-4xl"
                  style={{ color: visual.color }}
                  data-testid="tier-upgrade-title"
                >
                  You are now {visual.label}!
                </motion.h2>

                {/* Tagline — staggered reveal #4 */}
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: PREMIUM_EASE, delay: 0.6 }}
                  className="mt-3 text-sm text-[#4b4b4b]"
                >
                  {visual.tagline}
                </motion.p>

                {/* Perks summary — staggered reveal #5 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: PREMIUM_EASE, delay: 0.78 }}
                  className="mt-7 w-full space-y-2 text-left"
                  data-testid="tier-upgrade-perks"
                >
                  <PerkRow label="Flash sales" value={perks.flashSaleFrequency} color={visual.color} />
                  <PerkRow label="Token rate" value={perks.tokenMultiplier} color={visual.color} />
                  <PerkRow label="Map access" value={perks.mapVisibility} color={visual.color} />
                </motion.div>

                {/* CTA — staggered reveal #6 */}
                <motion.button
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: PREMIUM_EASE, delay: 0.95 }}
                  onClick={hideOverlay}
                  className="btn-magenta group mt-8"
                  data-testid="tier-upgrade-cta"
                >
                  Explore my perks
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/15 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
                    <ArrowRight size={14} weight="bold" />
                  </span>
                </motion.button>
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

function PerkRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#f4f4f5] px-3 py-2 ring-1 ring-[#141414]/8">
      <span className="text-xs uppercase tracking-[0.12em] text-[#8a8a8a]">
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

/**
 * Tier-colored particle explosion. GPU-safe (transform + opacity only).
 * Particles radiate outward from the center in the destination tier's color.
 */
function TierParticleBurst({ color }: { color: string }) {
  const particles = Array.from({ length: 24 });
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const distance = 120 + (i % 4) * 50;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        const size = 4 + (i % 3) * 2;
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              background: color,
              boxShadow: `0 0 10px ${color}`,
            }}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x: dx, y: dy, scale: 0.3 }}
            transition={{ duration: 1.4, ease: PREMIUM_EASE, delay: 0.2 }}
          />
        );
      })}
    </div>
  );
}

export default TierUpgrade;
