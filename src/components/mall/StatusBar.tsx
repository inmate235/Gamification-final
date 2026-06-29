"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fire, MapPin, Lightning, Star, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";
import type { Tier } from "@/types";

/**
 * StatusBar — the persistent top chrome of the `/mall` route.
 *
 * Redesigned for visual distinctiveness and psychological engagement:
 *   - Staggered spring entrance cascade
 *   - Prominent tier badge with breathing color halo
 *   - Token pulse + floating reward bursts
 *   - Streak counter with reactive fire icon
 *   - Exploration progress bar with shimmer sweep on value change
 *
 * All values read directly from playerStore / mapStore.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;
const POP = [0.34, 1.56, 0.64, 1] as const;

/* ============================================================================
   Tier styling
   ========================================================================== */

const TIER_STYLES: Record<
  Tier,
  { color: string; label: string }
> = {
  bronze: { color: "#b87333", label: "Bronze" },
  silver: { color: "#c0c0c0", label: "Silver" },
  gold: { color: "#e6b800", label: "Gold" },
  neodymium: { color: "#7c3aed", label: "Neodymium" },
};

/* ============================================================================
   Component
   ========================================================================== */

const statVariants = {
  hidden: { opacity: 0, y: -12, scale: 0.92 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.55,
      ease: POP,
      delay: 0.05 + i * 0.07,
    },
  }),
};

export function StatusBar() {
  const tokens = usePlayerStore((s) => s.tokens);
  const tier = usePlayerStore((s) => s.tier);
  const streakCount = usePlayerStore((s) => s.streak.count);
  const streakBroken = usePlayerStore((s) => s.streak.broken);
  const comebackBonus = usePlayerStore((s) => s.streak.comebackBonus);
  const explorationPercent = useMapStore((s) => s.explorationPercent);
  const showOverlay = useUIStore((s) => s.showOverlay);
  const isSoundEnabled = useUIStore((s) => s.isSoundEnabled);
  const toggleSound = useUIStore((s) => s.toggleSound);

  const tierStyle = TIER_STYLES[tier];
  const comebackActive = comebackBonus !== null && comebackBonus.active;

  /* --- Pulse the token count and show float up indicators --- */
  const prevTokensRef = useRef(tokens);
  const prevExplorationRef = useRef(explorationPercent);
  const [isEarn, setIsEarn] = useState(true);
  const [explorationChanged, setExplorationChanged] = useState(false);
  const [floatRewards, setFloatRewards] = useState<
    { id: number; amount: string; isEarn: boolean }[]
  >([]);
  const floatIdRef = useRef(0);

  useEffect(() => {
    if (tokens !== prevTokensRef.current) {
      const diff = tokens - prevTokensRef.current;
      const earn = diff > 0;
      setIsEarn(earn);

      const id = floatIdRef.current++;
      const amountStr = earn ? `+${diff}` : `${diff}`;
      setFloatRewards((prev) => [
        ...prev,
        { id, amount: amountStr, isEarn: earn },
      ]);

      setTimeout(() => {
        setFloatRewards((prev) => prev.filter((r) => r.id !== id));
      }, 1000);

      prevTokensRef.current = tokens;
    }
  }, [tokens]);

  useEffect(() => {
    if (explorationPercent !== prevExplorationRef.current) {
      setExplorationChanged(true);
      const t = setTimeout(() => setExplorationChanged(false), 1200);
      prevExplorationRef.current = explorationPercent;
      return () => clearTimeout(t);
    }
  }, [explorationPercent]);

  const pulseKey = tokens;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4"
      role="banner"
      aria-label="Status bar"
      data-testid="status-bar"
    >
      {/* Light pill bar with subtle warm gradient */}
      <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-full px-3 py-2.5 shadow-[0_4px_18px_rgba(20,20,20,0.1),0_1px_0_rgba(20,20,20,0.06)] sm:gap-3 sm:px-4 sm:py-3"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,246,250,0.96) 100%)",
          border: "1px solid rgba(20,20,20,0.08)",
        }}
      >
        {/* ─── Tokens ─── */}
        <motion.div
          custom={0}
          variants={statVariants}
          className="flex items-center gap-1.5 relative"
          data-testid="status-tokens"
          aria-label="Tokens"
        >
          <motion.span
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 1.8, ease: PREMIUM_EASE, repeat: Infinity, repeatDelay: 4 }}
          >
            <Star size={14} weight="fill" className="text-[#e6009e]" />
          </motion.span>
          <motion.span
            key={pulseKey}
            initial={{
              opacity: 0.5,
              scale: 1.18,
              color: isEarn ? "#f30aac" : "#ef4444",
            }}
            animate={{ opacity: 1, scale: 1, color: "#141414" }}
            transition={{ duration: 0.45, ease: POP }}
            className="font-mono text-sm font-semibold tabular-nums sm:text-base"
            data-testid="status-tokens-value"
          >
            {tokens}
          </motion.span>

          <AnimatePresence>
            {floatRewards.map((r) => (
              <motion.span
                key={r.id}
                className={cn(
                  "absolute font-mono text-xs font-bold pointer-events-none left-4 top-[-22px]",
                  r.isEarn ? "text-[#e6009e]" : "text-[#ef4444]"
                )}
                initial={{ y: 0, opacity: 1, scale: 0.8 }}
                animate={{ y: -28, opacity: 0, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.85, ease: PREMIUM_EASE }}
              >
                {r.amount}
              </motion.span>
            ))}
          </AnimatePresence>
        </motion.div>

        <AnimatedDivider />

        {/* ─── Tier badge ─── */}
        <motion.button
          custom={1}
          variants={statVariants}
          type="button"
          onClick={() => showOverlay("tier-perks")}
          className="relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold active:scale-[0.97] sm:text-xs"
          style={{
            color: tierStyle.color,
            border: `1.5px solid ${tierStyle.color}55`,
            background: `${tierStyle.color}14`,
          }}
          data-testid="status-tier"
          aria-label={`Tier: ${tierStyle.label}. View perks.`}
        >
          {/* Breathing tier halo */}
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full"
            animate={{ opacity: [0, 0.24, 0] }}
            transition={{ duration: 3, ease: PREMIUM_EASE, repeat: Infinity }}
            style={{ background: tierStyle.color }}
            aria-hidden="true"
          />
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: tierStyle.color }}
            data-testid="status-tier-indicator"
          />
          {tierStyle.label}
        </motion.button>

        <AnimatedDivider />

        {/* ─── Streak ─── */}
        <motion.div
          custom={2}
          variants={statVariants}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-gradient-to-r from-[#fff7ed] to-[#ffedd5] ring-1 ring-[#f97316]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
          data-testid="status-streak"
          aria-label="Day Streak"
        >
          <motion.div
            key={streakCount}
            animate={{ scale: [1, 1.3, 1], rotate: [0, 12, -12, 0] }}
            transition={{ duration: 0.55, ease: POP }}
          >
            <Fire
              size={15}
              weight="fill"
              className={cn(
                "text-[#ea580c]",
                streakBroken && "opacity-50 grayscale"
              )}
            />
          </motion.div>
          <span className="font-mono text-[13px] font-bold tabular-nums text-[#c2410c] sm:text-sm">
            {streakCount} <span className="text-[9px] uppercase tracking-wider opacity-80">Day</span>
          </span>
          {comebackActive && (
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: POP }}
              className="ml-0.5 flex items-center gap-0.5 rounded-full bg-[#ea580c]/15 px-1 py-0.5 text-[9px] font-bold text-[#ea580c]"
              data-testid="status-comeback-bonus"
            >
              <Lightning size={8} weight="fill" />
              2x
            </motion.span>
          )}
        </motion.div>

        <AnimatedDivider />

        {/* ─── Exploration ─── */}
        <motion.div
          custom={3}
          variants={statVariants}
          className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 sm:ml-2 sm:gap-2"
          data-testid="status-exploration"
        >
          <MapPin size={13} weight="fill" className="shrink-0 text-[#7c3aed]" />
          <div className="relative h-2 min-w-[52px] flex-1 overflow-hidden rounded-full bg-[#141414]/7">
            {/* Shimmer sweep on progress change */}
            {explorationChanged && (
              <motion.div
                className="absolute inset-y-0 w-10 rounded-full bg-white/60"
                initial={{ x: "-100%" }}
                animate={{ x: "500%" }}
                transition={{ duration: 0.9, ease: PREMIUM_EASE }}
                aria-hidden="true"
              />
            )}
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-[#e6009e]"
              initial={false}
              animate={{ width: `${explorationPercent}%` }}
              transition={{
                duration: 0.8,
                ease: PREMIUM_EASE,
              }}
            />
          </div>
          <motion.span
            key={explorationPercent}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 0.35, ease: POP }}
            className="shrink-0 font-mono text-[11px] tabular-nums text-[#7c3aed] sm:text-xs"
          >
            {explorationPercent}%
          </motion.span>
        </motion.div>

        <AnimatedDivider />

        {/* ─── Sound toggle ─── */}
        <motion.button
          custom={4}
          variants={statVariants}
          type="button"
          onClick={toggleSound}
          className="flex shrink-0 items-center justify-center rounded-full p-1.5 active:scale-[0.92] transition-colors hover:bg-[#141414]/5"
          data-testid="status-sound-toggle"
          aria-label={isSoundEnabled ? "Mute sound effects" : "Enable sound effects"}
          aria-pressed={isSoundEnabled}
        >
          {isSoundEnabled ? (
            <SpeakerHigh size={16} weight="fill" className="text-[#7c3aed]" />
          ) : (
            <SpeakerSlash size={16} weight="fill" className="text-[#8a8a8a]" />
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ============================================================================
   Sub-components
   ========================================================================== */

function AnimatedDivider() {
  return (
    <motion.span
      className="h-5 w-px shrink-0 bg-[#141414]/10"
      animate={{ opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 4, ease: PREMIUM_EASE, repeat: Infinity }}
    />
  );
}

export default StatusBar;
