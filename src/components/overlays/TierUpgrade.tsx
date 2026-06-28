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
            {/* Premium Card Container */}
            <div 
              className="relative overflow-hidden rounded-[2.5rem] bg-white/80 backdrop-blur-2xl ring-1 ring-white/60 p-1.5"
              style={{
                boxShadow: `0 32px 64px -12px ${visual.color}40, inset 0 0 0 1px ${visual.color}20, 0 16px 32px -8px rgba(0,0,0,0.1)`
              }}
            >
              {/* Inner ambient glow */}
              <div 
                className="absolute -top-24 -left-24 h-64 w-64 rounded-full blur-3xl opacity-30 pointer-events-none"
                style={{ background: visual.color }}
              />
              <div 
                className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ background: visual.color }}
              />

              <div className="relative rounded-[2.25rem] bg-gradient-to-b from-white/95 to-white/70 p-8 flex flex-col items-center text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                {/* Eyebrow — staggered reveal #1 */}
                <motion.div
                  initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.6, ease: PREMIUM_EASE, delay: 0.15 }}
                  className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] uppercase tracking-[0.25em] font-bold shadow-sm"
                  style={{
                    color: visual.color,
                    background: `linear-gradient(135deg, white 0%, ${visual.color}0a 100%)`,
                    boxShadow: `0 2px 10px ${visual.color}15, inset 0 0 0 1px ${visual.color}30`,
                  }}
                >
                  <Sparkle size={14} weight="fill" style={{ color: visual.color }} />
                  Membership Upgrade
                </motion.div>

                {/* Tier badge — scales in with spring (staggered #2) */}
                <motion.div
                  initial={{ scale: 0, opacity: 0, rotate: -12 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.25 }}
                  className="mb-6 flex h-28 w-28 items-center justify-center rounded-full"
                  style={{
                    background: `linear-gradient(135deg, #ffffff 0%, ${visual.color}1a 100%)`,
                    boxShadow: `0 20px 40px -10px ${visual.color}50, inset 0 2px 4px rgba(255,255,255,1), inset 0 0 0 2px ${visual.color}30`,
                  }}
                  data-testid="tier-upgrade-badge"
                >
                  <div 
                    className="flex h-20 w-20 items-center justify-center rounded-full"
                    style={{
                      background: `linear-gradient(135deg, ${visual.color} 0%, ${visual.color}cc 100%)`,
                      boxShadow: `inset 0 2px 4px rgba(255,255,255,0.4), 0 8px 16px -4px ${visual.color}60`
                    }}
                  >
                    <Medal
                      size={42}
                      weight="fill"
                      className="text-white"
                      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
                    />
                  </div>
                </motion.div>

                {/* "You are now {Tier}!" — staggered reveal #3 */}
                <motion.h2
                  initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.7, ease: PREMIUM_EASE, delay: 0.45 }}
                  className="font-display text-4xl font-bold tracking-tight sm:text-5xl drop-shadow-sm"
                  style={{ 
                    color: visual.color,
                    textShadow: `0 2px 12px ${visual.color}30`
                  }}
                  data-testid="tier-upgrade-title"
                >
                  You are now {visual.label}!
                </motion.h2>

                {/* Tagline — staggered reveal #4 */}
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: PREMIUM_EASE, delay: 0.6 }}
                  className="mt-3 text-[15px] font-medium text-[#4b4b4b] opacity-90"
                >
                  {visual.tagline}
                </motion.p>

                {/* Perks summary — staggered reveal #5 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: PREMIUM_EASE, delay: 0.78 }}
                  className="mt-8 w-full space-y-3 text-left relative z-10"
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
                  className="group mt-10 relative flex w-full items-center justify-center gap-3 rounded-full py-4 text-base font-bold text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] transition-all hover:scale-[1.02] active:scale-95"
                  style={{
                    background: `linear-gradient(135deg, ${visual.color} 0%, ${visual.color}dd 100%)`,
                    boxShadow: `0 12px 24px -8px ${visual.color}60, inset 0 2px 4px rgba(255,255,255,0.3)`
                  }}
                  data-testid="tier-upgrade-cta"
                >
                  <span>Explore my perks</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 backdrop-blur-sm">
                    <ArrowRight size={16} weight="bold" />
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
    <div 
      className="flex items-center justify-between rounded-[1.25rem] px-5 py-3.5 shadow-sm transition-transform hover:scale-[1.01]"
      style={{
        background: `linear-gradient(90deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.7) 100%)`,
        boxShadow: `0 2px 12px rgba(0,0,0,0.03), inset 0 0 0 1px rgba(255,255,255,0.5)`,
        borderLeft: `4px solid ${color}`
      }}
    >
      <span className="text-xs uppercase tracking-[0.15em] font-bold text-[#8a8a8a]">
        {label}
      </span>
      <span className="text-[15px] font-bold tracking-tight" style={{ color }}>
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
