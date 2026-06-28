"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fire, MapPin, Lightning, Star } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";
import type { Tier } from "@/types";

/**
 * StatusBar — the persistent top chrome of the `/mall` route.
 *
 * Light + playful pill bar showing four reactive values:
 *   - Token count (magenta star)
 *   - Tier badge (tier-colored pill using --color-tier-*)
 *   - Streak counter
 *   - Exploration progress bar (magenta fill on a light track)
 *
 * All values are read directly from the playerStore / mapStore so they update
 * reactively whenever the underlying state changes.
 */

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

export function StatusBar() {
  const tokens = usePlayerStore((s) => s.tokens);
  const tier = usePlayerStore((s) => s.tier);
  const streakCount = usePlayerStore((s) => s.streak.count);
  const streakBroken = usePlayerStore((s) => s.streak.broken);
  const comebackBonus = usePlayerStore((s) => s.streak.comebackBonus);
  const explorationPercent = useMapStore((s) => s.explorationPercent);
  const showOverlay = useUIStore((s) => s.showOverlay);

  const tierStyle = TIER_STYLES[tier];
  const comebackActive = comebackBonus !== null && comebackBonus.active;

  /* --- Pulse the token count and show float up indicators --- */
  const prevTokensRef = useRef(tokens);
  const [isEarn, setIsEarn] = useState(true);
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

  const pulseKey = tokens;

  return (
    <header
      className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4"
      aria-label="Status bar"
      data-testid="status-bar"
    >
      {/* Light pill bar */}
      <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-full border border-[#141414]/10 bg-white/95 px-3 py-2 shadow-[0_4px_16px_rgba(20,20,20,0.08)] backdrop-blur-sm sm:gap-3 sm:px-4">
        {/* Tokens — magenta star accent (Figma node 11:53) */}
        <div
          className="flex items-center gap-1.5 relative"
          data-testid="status-tokens"
          aria-label="Tokens"
        >
          <Star size={13} weight="fill" className="text-[#e6009e]" />
          <motion.span
            key={pulseKey}
            initial={{
              opacity: 0.5,
              scale: 1.18,
              color: isEarn ? "#f30aac" : "#ef4444",
            }}
            animate={{ opacity: 1, scale: 1, color: "#141414" }}
            transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
            className="font-mono text-sm font-semibold tabular-nums sm:text-base"
            data-testid="status-tokens-value"
          >
            {tokens}
          </motion.span>

          {/* Floating Reward Burst */}
          <AnimatePresence>
            {floatRewards.map((r) => (
              <motion.span
                key={r.id}
                className={cn(
                  "absolute font-mono text-xs font-bold pointer-events-none left-4 top-[-20px] drop-shadow-md",
                  r.isEarn ? "text-[#e6009e]" : "text-[#ef4444]"
                )}
                initial={{ y: 0, opacity: 1, scale: 0.8 }}
                animate={{ y: -25, opacity: 0, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                {r.amount}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>

        <Divider />

        {/* Tier badge — tap to open the perks panel (VAL-TIER-003, -004, -009) */}
        <button
          type="button"
          onClick={() => showOverlay("tier-perks")}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] sm:text-xs"
          style={{
            color: tierStyle.color,
            border: `1.5px solid ${tierStyle.color}55`,
            background: `${tierStyle.color}14`,
          }}
          data-testid="status-tier"
          aria-label={`Tier: ${tierStyle.label}. View perks.`}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: tierStyle.color }}
            data-testid="status-tier-indicator"
          />
          {tierStyle.label}
        </button>

        <Divider />

        {/* Streak */}
        <div
          className="flex items-center gap-1.5"
          data-testid="status-streak"
          aria-label="Day Streak"
        >
          <motion.div
            key={streakCount}
            animate={{ scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <Fire
              size={16}
              weight="fill"
              className={cn("text-[#f59e0b]", streakBroken && "opacity-50")}
            />
          </motion.div>
          <span className="font-mono text-sm font-semibold tabular-nums text-[#141414] sm:text-base">
            {streakCount}
          </span>
          {comebackActive && (
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              className="flex items-center gap-0.5 rounded-full bg-[#e6009e]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#e6009e]"
              data-testid="status-comeback-bonus"
            >
              <Lightning size={8} weight="fill" />
              2x
            </motion.span>
          )}
        </div>

        {/* Exploration progress — fills remaining width */}
        <div
          className="ml-1 flex min-w-0 flex-1 items-center gap-2 sm:ml-2"
          data-testid="status-exploration"
        >
          <MapPin size={14} weight="fill" className="shrink-0 text-[#7c3aed]" />
          <div className="relative h-2 min-w-[60px] flex-1 overflow-hidden rounded-full bg-[#141414]/8">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-[#e6009e]"
              initial={false}
              animate={{ width: `${explorationPercent}%` }}
              transition={{
                duration: 0.8,
                ease: [0.32, 0.72, 0, 1],
              }}
            />
          </div>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#7c3aed] sm:text-xs">
            {explorationPercent}%
          </span>
        </div>
      </div>
    </header>
  );
}

/* ============================================================================
   Sub-components
   ========================================================================== */

function Divider() {
  return <span className="h-5 w-px shrink-0 bg-[#141414]/10" />;
}

export default StatusBar;
