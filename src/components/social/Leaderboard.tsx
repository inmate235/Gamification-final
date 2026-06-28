"use client";

import { useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  X,
  Coin,
  Clock,
  MapPin,
  Crown,
  CaretUp,
} from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { useSocialStore } from "@/stores/socialStore";
import { useSessionStore } from "@/stores/sessionStore";
import { cn } from "@/lib/utils";
import {
  entryMetricValue,
  MAX_LEADERBOARD_ENTRIES,
} from "@/engine/phantomEngine";
import { TIER_VISUALS } from "@/data/tierData";
import type {
  LeaderboardEntry,
  LeaderboardMetric,
} from "@/types";

/**
 * Leaderboard — the fabricated social ranking overlay + entry button.
 *
 * Implements the leaderboard dark pattern (Area 10):
 *   - Entry button accessible from the mall view (VAL-LEADER-001)
 *   - Ranked list with the user's row highlighted (VAL-LEADER-002, -003,
 *     -018)
 *   - Three metrics shown simultaneously: time-in-mall, tokens, exploration %
 *     (VAL-LEADER-004..007)
 *   - Multi-metric sort tabs (VAL-LEADER-019)
 *   - Phantom users with fabricated names + scores (VAL-LEADER-008, -009)
 *   - Phantoms just barely ahead + new phantom on overtake (handled by
 *     phantomEngine; VAL-LEADER-010, -014, -017)
 *   - Contiguous 1-indexed ranks (VAL-LEADER-021)
 *   - Bounded entry count (VAL-LEADER-022)
 *   - Uses the uiStore overlay system (VAL-LEADER-023)
 *   - Proximity alert banner naming phantom + gap + rank (VAL-LEADER-011..013,
 *     -020)
 *
 * The leaderboard updates in real-time because it subscribes to the
 * socialStore.leaderboard which is refreshed by the EventScheduler every
 * 10th tick (VAL-LEADER-015).
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Metric tab config
   ========================================================================== */

interface MetricTab {
  metric: LeaderboardMetric;
  label: string;
  icon: React.ReactNode;
}

const METRIC_TABS: MetricTab[] = [
  { metric: "tokens", label: "Tokens", icon: <Coin size={13} weight="fill" /> },
  { metric: "time", label: "Time", icon: <Clock size={13} weight="fill" /> },
  {
    metric: "exploration",
    label: "Explore",
    icon: <MapPin size={13} weight="fill" />,
  },
];

/* ============================================================================
   Floating entry button (always visible from the mall view)
   ========================================================================== */

export function LeaderboardEntryButton() {
  const showOverlay = useUIStore((s) => s.showOverlay);
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const exited = useSessionStore((s) => s.exited);

  const open = useCallback(
    () => showOverlay("leaderboard"),
    [showOverlay],
  );

  // Hide while another overlay is capturing the screen or after exit.
  if (exited) return null;
  if (activeOverlay !== "none" && activeOverlay !== "leaderboard") return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.7, ease: PREMIUM_EASE }}
      onClick={open}
      aria-label="Open the leaderboard"
      className="flex items-center gap-2 rounded-full bg-[#e6009e] px-4 py-2.5 ring-2 ring-white shadow-[0_6px_0_#b8007e] transition-all duration-200 active:translate-y-[3px] active:shadow-[0_3px_0_#b8007e]"
      data-testid="leaderboard-entry-button"
    >
      <Trophy size={16} weight="fill" className="text-white" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
        Ranks
      </span>
    </motion.button>
  );
}

/* ============================================================================
   Overlay
   ========================================================================== */

export function Leaderboard() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  const leaderboard = useSocialStore((s) => s.leaderboard);
  const activeMetric = useSocialStore((s) => s.activeMetric);
  const setActiveMetric = useSocialStore((s) => s.setActiveMetric);

  const isOpen = activeOverlay === "leaderboard";

  /* Esc to dismiss */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, hideOverlay]);

  const handleClose = useCallback(() => hideOverlay(), [hideOverlay]);

  // Bound the displayed entries (VAL-LEADER-022). Always include the user's
  // neighborhood so they can find themselves.
  const displayEntries = useMemo(() => {
    const sorted = [...leaderboard].sort((a, b) => a.rank - b.rank);
    if (sorted.length <= MAX_LEADERBOARD_ENTRIES) return sorted;
    const playerIdx = sorted.findIndex((e) => e.isPlayer);
    // Show a window centered on the player, capped at MAX.
    const half = Math.floor(MAX_LEADERBOARD_ENTRIES / 2);
    let start = Math.max(0, (playerIdx >= 0 ? playerIdx : 0) - half);
    const end = Math.min(sorted.length, start + MAX_LEADERBOARD_ENTRIES);
    // If we underflowed at the end, shift the window back.
    if (end - start < MAX_LEADERBOARD_ENTRIES) {
      start = Math.max(0, end - MAX_LEADERBOARD_ENTRIES);
    }
    return sorted.slice(start, end);
  }, [leaderboard]);

  const playerEntry = leaderboard.find((e) => e.isPlayer) ?? null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: PREMIUM_EASE }}
          className="fixed inset-0 z-40 flex items-center justify-center px-4 py-16"
          onClick={handleClose}
          data-testid="leaderboard-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Leaderboard"
        >
          <div className="absolute inset-0 backdrop-blur-md bg-[#141414]/40" />

          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="relative w-full max-w-lg max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bezel-card">
              <div className="bezel-card-inner">
                {/* Header */}
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium text-[#8a8a8a] ring-1 ring-[#141414]/10">
                      <Trophy size={12} weight="fill" className="text-[#e6009e]" />
                      Leaderboard
                    </span>
                    <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#141414]">
                      Mall Rankings
                    </h2>
                    {playerEntry && (
                      <p className="mt-1 text-xs text-[#4b4b4b]">
                        You&apos;re ranked{" "}
                        <span className="font-semibold text-[#e6009e]">
                          #{playerEntry.rank}
                        </span>{" "}
                        of {leaderboard.length}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleClose}
                    aria-label="Close leaderboard"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#141414]/5 ring-1 ring-[#141414]/10 transition-all duration-200 active:scale-[0.97] hover:bg-[#141414]/10"
                  >
                    <X size={16} weight="bold" className="text-[#141414]" />
                  </button>
                </div>

                {/* Metric sort tabs (VAL-LEADER-019) */}
                <div
                  className="mb-4 flex gap-1.5 rounded-full bg-[#f4f4f5] p-1 ring-1 ring-[#141414]/8"
                  data-testid="leaderboard-metric-tabs"
                  role="tablist"
                  aria-label="Sort leaderboard by metric"
                >
                  {METRIC_TABS.map((tab) => {
                    const active = tab.metric === activeMetric;
                    return (
                      <button
                        key={tab.metric}
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActiveMetric(tab.metric)}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all duration-200",
                          active
                            ? "bg-[#e6009e]/15 text-[#e6009e]"
                            : "text-[#8a8a8a] hover:text-[#4b4b4b]",
                        )}
                        data-testid={`leaderboard-metric-${tab.metric}`}
                        data-active={active ? "true" : "false"}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Ranked list */}
                <ol
                  className="space-y-1.5"
                  data-testid="leaderboard-list"
                >
                  {displayEntries.map((entry) => (
                    <LeaderboardRow
                      key={`${entry.rank}-${entry.name}`}
                      entry={entry}
                      metric={activeMetric}
                    />
                  ))}
                </ol>

                {/* Caption */}
                <p className="mt-4 text-center text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a]">
                  Updates live as you explore
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
   Row
   ========================================================================== */

function LeaderboardRow({
  entry,
  metric,
}: {
  entry: LeaderboardEntry;
  metric: LeaderboardMetric;
}) {
  const isPlayer = entry.isPlayer;
  const isTop = entry.rank === 1;
  const tierVisual = TIER_VISUALS[entry.tier];

  const primaryValue = entryMetricValue(entry, metric);
  const primaryLabel =
    metric === "tokens"
      ? `${primaryValue}`
      : metric === "time"
        ? `${primaryValue}m`
        : `${primaryValue}%`;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 transition-all duration-200",
        isPlayer
          ? "bg-[#e6009e]/8 ring-[#e6009e]/30"
          : "bg-[#f4f4f5] ring-[#141414]/8",
      )}
      data-testid="leaderboard-row"
      data-player={isPlayer ? "true" : "false"}
      data-rank={entry.rank}
    >
      {/* Rank */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
        style={{
          color: isTop ? "#e6b800" : isPlayer ? "#e6009e" : "#8a8a8a",
          background: isTop ? "rgba(230,184,0,0.12)" : "rgba(20,20,20,0.04)",
        }}
        data-testid="leaderboard-rank"
      >
        {isTop ? <Crown size={14} weight="fill" /> : entry.rank}
      </div>

      {/* Avatar dot + name */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            background: tierVisual.color,
          }}
        />
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-sm font-medium",
              isPlayer ? "text-[#e6009e]" : "text-[#141414]",
            )}
          >
            {entry.name}
            {isPlayer && (
              <span className="ml-1.5 text-[10px] uppercase tracking-[0.15em] text-[#e6009e]/70">
                You
              </span>
            )}
          </p>
          <p className="truncate text-[10px] uppercase tracking-[0.12em] text-[#8a8a8a]">
            {tierVisual.label}
          </p>
        </div>
      </div>

      {/* All three metrics (VAL-LEADER-007) — active one emphasized */}
      <div className="flex shrink-0 items-center gap-2.5 font-mono tabular-nums">
        <MetricChip
          icon={<Coin size={11} weight="fill" />}
          value={`${entry.tokenCount}`}
          color={metric === "tokens" ? "#e6b800" : "#8a8a8a"}
          active={metric === "tokens"}
        />
        <MetricChip
          icon={<Clock size={11} weight="fill" />}
          value={`${entry.timeInMall}m`}
          color={metric === "time" ? "#7c3aed" : "#8a8a8a"}
          active={metric === "time"}
        />
        <MetricChip
          icon={<MapPin size={11} weight="fill" />}
          value={`${entry.explorationPercent}%`}
          color={metric === "exploration" ? "#14b8a6" : "#8a8a8a"}
          active={metric === "exploration"}
        />
      </div>

      {/* Primary metric value (the active sort metric) for quick scanning */}
      <span
        className="hidden shrink-0 text-sm font-bold tabular-nums sm:block"
        style={{ color: isPlayer ? "#e6009e" : "#141414" }}
      >
        {primaryLabel}
      </span>
    </li>
  );
}

function MetricChip({
  icon,
  value,
  color,
  active,
}: {
  icon: React.ReactNode;
  value: string;
  color: string;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-[11px] transition-all duration-200",
        active && "scale-110",
      )}
      style={{ color }}
    >
      {icon}
      {value}
    </span>
  );
}

/* ============================================================================
   Proximity alert banner (rendered persistently on the mall view)
   ========================================================================== */

/**
 * Renders the most recent undismissed proximity alert as a floating banner.
 * The alert names the phantom, the exact gap, and the rank at stake
 * (VAL-LEADER-011..013). Only fires when genuinely close (the engine enforces
 * the threshold, VAL-LEADER-020).
 */
export function ProximityAlertBanner() {
  const alerts = useSocialStore((s) => s.proximityAlerts);
  const dismiss = useSocialStore((s) => s.dismissProximityAlert);
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const exited = useSessionStore((s) => s.exited);

  // Don't show the banner while an overlay is open or after exit.
  if (exited) return null;
  if (activeOverlay !== "none") return null;

  const latest = alerts[alerts.length - 1];
  if (!latest) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={latest.id}
        initial={{ opacity: 0, y: -24, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.95 }}
        transition={{ duration: 0.6, ease: PREMIUM_EASE }}
        className="fixed left-1/2 top-20 z-30 -translate-x-1/2 px-3 sm:top-24"
        data-testid="proximity-alert-banner"
      >
        <button
          type="button"
          onClick={() => dismiss(latest.id)}
          className="flex items-center gap-2.5 rounded-full bg-white px-4 py-2.5 ring-2 ring-[#e6009e]/30 shadow-[0_4px_16px_rgba(20,20,20,0.1)] transition-all duration-200 active:scale-[0.97]"
          aria-label={`${latest.message} — tap to dismiss`}
        >
          <motion.span
            animate={{ scale: [1, 1.18, 1] }}
            transition={{
              duration: 1.4,
              ease: PREMIUM_EASE,
              repeat: Infinity,
            }}
          >
            <CaretUp size={14} weight="fill" className="text-[#e6009e]" />
          </motion.span>
          <span
            className="text-xs font-medium text-[#141414]"
            data-testid="proximity-alert-text"
          >
            {latest.message}
          </span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

export default Leaderboard;
