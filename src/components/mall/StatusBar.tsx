"use client";

import { motion } from "framer-motion";
import { Coin, Fire, MapPin } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import type { Tier } from "@/types";

/**
 * StatusBar — the persistent top chrome of the `/mall` route.
 *
 * Shows four reactive values:
 *   - Token count (gold)
 *   - Tier badge (tier-colored pill)
 *   - Streak counter (amethyst flame)
 *   - Exploration progress bar (non-linear, teal gradient)
 *
 * All values are read directly from the playerStore / mapStore so they update
 * reactively whenever the underlying state changes.
 */

/* ============================================================================
   Tier styling
   ========================================================================== */

const TIER_STYLES: Record<
  Tier,
  { color: string; glow: string; label: string }
> = {
  bronze: {
    color: "#b87333",
    glow: "0 0 12px rgba(184, 115, 51, 0.3)",
    label: "Bronze",
  },
  silver: {
    color: "#c0c0c0",
    glow: "0 0 12px rgba(192, 192, 192, 0.3)",
    label: "Silver",
  },
  gold: {
    color: "#d4af37",
    glow: "0 0 16px rgba(212, 175, 55, 0.4)",
    label: "Gold",
  },
  neodymium: {
    color: "#9d7fdb",
    glow: "0 0 20px rgba(157, 127, 219, 0.5)",
    label: "Neodymium",
  },
};

/* ============================================================================
   Component
   ========================================================================== */

export function StatusBar() {
  const tokens = usePlayerStore((s) => s.tokens);
  const tier = usePlayerStore((s) => s.tier);
  const streakCount = usePlayerStore((s) => s.streak.count);
  const explorationPercent = useMapStore((s) => s.explorationPercent);

  const tierStyle = TIER_STYLES[tier];

  return (
    <header
      className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4"
      aria-label="Status bar"
      data-testid="status-bar"
    >
      {/* Double-bezel glass pill */}
      <div className="bezel-card !rounded-[1.25rem] !p-1 sm:!rounded-[1.5rem]">
        <div
          className={cn(
            "bezel-card-inner !rounded-[calc(1.25rem-0.375rem)] !p-2.5 sm:!rounded-[calc(1.5rem-0.375rem)] sm:!p-3",
            "flex items-center gap-2 sm:gap-3"
          )}
        >
          {/* Tokens */}
          <StatItem
            icon={<Coin size={16} weight="light" className="text-[#d4af37]" />}
            value={tokens}
            label="Tokens"
            valueClassName="text-[#d4af37]"
            data-testid="status-tokens"
          />

          <Divider />

          {/* Tier badge */}
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:text-xs"
            style={{
              color: tierStyle.color,
              boxShadow: tierStyle.glow,
              border: `1px solid ${tierStyle.color}55`,
              background: `${tierStyle.color}14`,
            }}
            data-testid="status-tier"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: tierStyle.color }}
            />
            {tierStyle.label}
          </div>

          <Divider />

          {/* Streak */}
          <StatItem
            icon={<Fire size={16} weight="light" className="text-[#9d7fdb]" />}
            value={streakCount}
            label="Day Streak"
            valueClassName="text-[#9d7fdb]"
            data-testid="status-streak"
          />

          {/* Exploration progress — fills remaining width */}
          <div
            className="ml-1 flex min-w-0 flex-1 items-center gap-2 sm:ml-2"
            data-testid="status-exploration"
          >
            <MapPin
              size={14}
              weight="light"
              className="shrink-0 text-[#4fd1c5]"
            />
            <div className="relative h-2 min-w-[60px] flex-1 overflow-hidden rounded-full bg-white/8 ring-1 ring-white/10">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#4fd1c5] to-[#3a9d94]"
                style={{ boxShadow: "0 0 12px rgba(79, 209, 197, 0.4)" }}
                initial={false}
                animate={{ width: `${explorationPercent}%` }}
                transition={{
                  duration: 0.8,
                  ease: [0.32, 0.72, 0, 1],
                }}
              />
            </div>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#4fd1c5] sm:text-xs">
              {explorationPercent}%
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ============================================================================
   Sub-components
   ========================================================================== */

function StatItem({
  icon,
  value,
  label,
  valueClassName,
  "data-testid": testId,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  valueClassName?: string;
  "data-testid"?: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      data-testid={testId}
      aria-label={label}
    >
      {icon}
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums sm:text-base",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <span className="h-5 w-px shrink-0 bg-white/10" />;
}

export default StatusBar;
