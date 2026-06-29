"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  X,
  Coin,
  Clock,
  MapPin,
  Crown,
  CaretUp,
  CaretDown,
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

interface MetricVisual {
  accent: string;
  softAccent: string;
  ring: string;
  panelBackground: string;
}

const METRIC_VISUALS: Record<LeaderboardMetric, MetricVisual> = {
  tokens: {
    accent: "#e6b800",
    softAccent: "rgba(230, 184, 0, 0.16)",
    ring: "rgba(230, 184, 0, 0.35)",
    panelBackground:
      "linear-gradient(135deg, rgba(230,184,0,0.18) 0%, rgba(255,255,255,0.95) 70%)",
  },
  time: {
    accent: "#7c3aed",
    softAccent: "rgba(124, 58, 237, 0.14)",
    ring: "rgba(124, 58, 237, 0.3)",
    panelBackground:
      "linear-gradient(135deg, rgba(124,58,237,0.14) 0%, rgba(255,255,255,0.95) 70%)",
  },
  exploration: {
    accent: "#14b8a6",
    softAccent: "rgba(20, 184, 166, 0.14)",
    ring: "rgba(20, 184, 166, 0.3)",
    panelBackground:
      "linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(255,255,255,0.95) 70%)",
  },
};

const METRIC_PHASE_SHIFT: Record<LeaderboardMetric, number> = {
  tokens: 0,
  time: 2,
  exploration: 4,
};

type MetricTrend = "up" | "down" | "flat";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function simulatedMetricValue(
  entry: LeaderboardEntry,
  tabMetric: LeaderboardMetric,
  tick: number,
  activeMetric: LeaderboardMetric,
): number {
  const base = entryMetricValue(entry, tabMetric);
  if (entry.isPlayer) return base;

  const phase = tick + entry.rank * 0.75 + METRIC_PHASE_SHIFT[tabMetric];
  const pulse = Math.sin(phase * 0.9);
  const drift = Math.cos(phase * 0.45);
  const amplitude =
    tabMetric === activeMetric
      ? tabMetric === "tokens"
        ? 3
        : tabMetric === "time"
          ? 2
          : 4
      : 1;
  const delta = Math.round(pulse * amplitude + drift);

  if (tabMetric === "exploration") {
    return clamp(base + delta, 1, 99);
  }
  return Math.max(0, base + delta);
}

function simulatedMetricTrend(
  entry: LeaderboardEntry,
  tabMetric: LeaderboardMetric,
  tick: number,
  activeMetric: LeaderboardMetric,
): MetricTrend {
  if (entry.isPlayer) return "flat";
  const previous = simulatedMetricValue(
    entry,
    tabMetric,
    Math.max(0, tick - 1),
    activeMetric,
  );
  const current = simulatedMetricValue(entry, tabMetric, tick, activeMetric);
  if (current === previous) return "flat";
  return current > previous ? "up" : "down";
}

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
  const [pulseTick, setPulseTick] = useState(0);

  const isOpen = activeOverlay === "leaderboard";
  const activeVisual = METRIC_VISUALS[activeMetric];

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
  const maxPrimaryMetric = useMemo(
    () =>
      Math.max(
        1,
        ...displayEntries.map((entry) => entryMetricValue(entry, activeMetric)),
      ),
    [displayEntries, activeMetric],
  );

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setInterval(() => {
      setPulseTick((tick) => tick + 1);
    }, 1300);
    return () => window.clearInterval(id);
  }, [isOpen]);

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
                  className="relative mb-3 flex gap-1.5 overflow-hidden rounded-full bg-[#f4f4f5] p-1 ring-1 ring-[#141414]/8"
                  data-testid="leaderboard-metric-tabs"
                  role="tablist"
                  aria-label="Sort leaderboard by metric"
                >
                  <motion.div
                    key={`metric-tabs-bg-${activeMetric}`}
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0.2 }}
                    transition={{ duration: 0.35, ease: PREMIUM_EASE }}
                    className="pointer-events-none absolute inset-1 rounded-full"
                    style={{ background: activeVisual.panelBackground }}
                  />
                  {METRIC_TABS.map((tab) => {
                    const active = tab.metric === activeMetric;
                    return (
                      <button
                        key={tab.metric}
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActiveMetric(tab.metric)}
                        className={cn(
                          "relative z-10 flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all duration-200",
                          active
                            ? "text-[#141414]"
                            : "text-[#8a8a8a] hover:text-[#4b4b4b]",
                        )}
                        data-testid={`leaderboard-metric-${tab.metric}`}
                        data-active={active ? "true" : "false"}
                      >
                        {active && (
                          <motion.span
                            layoutId="leaderboard-tab-pill"
                            className="absolute inset-0 rounded-full"
                            style={{
                              background: METRIC_VISUALS[tab.metric].softAccent,
                              boxShadow: `inset 0 0 0 1px ${METRIC_VISUALS[tab.metric].ring}`,
                            }}
                            transition={{ duration: 0.35, ease: PREMIUM_EASE }}
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-1.5">
                          {tab.icon}
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`metric-highlight-${activeMetric}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.28, ease: PREMIUM_EASE }}
                    className="mb-4 flex items-center justify-between rounded-2xl px-3 py-2 ring-1"
                    style={{
                      background: activeVisual.panelBackground,
                      borderColor: activeVisual.ring,
                    }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4b4b4b]">
                      Live {activeMetric === "time" ? "time pressure" : activeMetric}
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: activeVisual.accent }}
                    >
                      Scores shifting in real time
                    </span>
                  </motion.div>
                </AnimatePresence>

                {/* Ranked list */}
                <motion.ol
                  layout
                  className="space-y-1.5"
                  data-testid="leaderboard-list"
                >
                  {displayEntries.map((entry) => (
                    <LeaderboardRow
                      key={entry.isPlayer ? "player-entry" : entry.avatarSeed}
                      entry={entry}
                      metric={activeMetric}
                      pulseTick={pulseTick}
                      maxPrimaryMetric={maxPrimaryMetric}
                    />
                  ))}
                </motion.ol>

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
  pulseTick,
  maxPrimaryMetric,
}: {
  entry: LeaderboardEntry;
  metric: LeaderboardMetric;
  pulseTick: number;
  maxPrimaryMetric: number;
}) {
  const isPlayer = entry.isPlayer;
  const isTop = entry.rank === 1;
  const tierVisual = TIER_VISUALS[entry.tier];
  const metricVisual = METRIC_VISUALS[metric];

  const tokenValue = simulatedMetricValue(entry, "tokens", pulseTick, metric);
  const timeValue = simulatedMetricValue(entry, "time", pulseTick, metric);
  const explorationValue = simulatedMetricValue(
    entry,
    "exploration",
    pulseTick,
    metric,
  );

  const primaryValue =
    metric === "tokens"
      ? tokenValue
      : metric === "time"
        ? timeValue
        : explorationValue;
  const primaryProgress = clamp(primaryValue / maxPrimaryMetric, 0.08, 1);
  const primaryTrend = simulatedMetricTrend(entry, metric, pulseTick, metric);

  const primaryLabel =
    metric === "tokens"
      ? `${primaryValue}`
      : metric === "time"
        ? `${primaryValue}m`
        : `${primaryValue}%`;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.3, ease: PREMIUM_EASE }}
      className={cn(
        "relative overflow-hidden flex items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 transition-all duration-200",
        isPlayer
          ? "bg-[#e6009e]/8 ring-[#e6009e]/30"
          : "bg-[#f4f4f5]",
      )}
      style={
        isPlayer
          ? undefined
          : {
              boxShadow: `inset 0 0 0 1px ${metricVisual.ring}`,
            }
      }
      data-testid="leaderboard-row"
      data-player={isPlayer ? "true" : "false"}
      data-rank={entry.rank}
    >
      {!isPlayer && (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5"
          style={{ background: metricVisual.softAccent }}
          aria-hidden="true"
        />
      )}

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
          value={`${tokenValue}`}
          color={metric === "tokens" ? "#e6b800" : "#8a8a8a"}
          active={metric === "tokens"}
          trend={simulatedMetricTrend(entry, "tokens", pulseTick, metric)}
        />
        <MetricChip
          icon={<Clock size={11} weight="fill" />}
          value={`${timeValue}m`}
          color={metric === "time" ? "#7c3aed" : "#8a8a8a"}
          active={metric === "time"}
          trend={simulatedMetricTrend(entry, "time", pulseTick, metric)}
        />
        <MetricChip
          icon={<MapPin size={11} weight="fill" />}
          value={`${explorationValue}%`}
          color={metric === "exploration" ? "#14b8a6" : "#8a8a8a"}
          active={metric === "exploration"}
          trend={simulatedMetricTrend(entry, "exploration", pulseTick, metric)}
        />
      </div>

      {/* Primary metric value (the active sort metric) for quick scanning */}
      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: isPlayer ? "#e6009e" : "#141414" }}
        >
          {primaryLabel}
        </span>
        {!isPlayer && primaryTrend !== "flat" && (
          <span
            style={{ color: metricVisual.accent }}
            aria-label={primaryTrend === "up" ? "Trending up" : "Trending down"}
          >
            {primaryTrend === "up" ? (
              <CaretUp size={10} weight="bold" />
            ) : (
              <CaretDown size={10} weight="bold" />
            )}
          </span>
        )}
      </div>

      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[#141414]/6" />
      <motion.span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left"
        style={{ background: metricVisual.accent }}
        animate={{ scaleX: primaryProgress }}
        transition={{ duration: 0.45, ease: PREMIUM_EASE }}
      />
    </motion.li>
  );
}

function MetricChip({
  icon,
  value,
  color,
  active,
  trend,
}: {
  icon: React.ReactNode;
  value: string;
  color: string;
  active: boolean;
  trend: MetricTrend;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-[11px] transition-all duration-200",
        active && "scale-110 font-semibold",
      )}
      style={{ color }}
    >
      {icon}
      {value}
      {active && trend !== "flat" && (
        <motion.span
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: PREMIUM_EASE }}
        >
          {trend === "up" ? (
            <CaretUp size={9} weight="bold" />
          ) : (
            <CaretDown size={9} weight="bold" />
          )}
        </motion.span>
      )}
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

  // Don't show the banner while a non-shopping overlay is open or after exit.
  // Allow it to persist when the shop or flash-sale is open — rank pressure
  // is most persuasive exactly at the purchase decision moment.
  if (exited) return null;
  if (
    activeOverlay !== "none" &&
    activeOverlay !== "shop" &&
    activeOverlay !== "flash-sale"
  )
    return null;

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
        className="fixed left-1/2 top-[96px] z-30 -translate-x-1/2 px-3 w-[calc(100%-120px)] max-w-[280px] sm:w-auto"
        data-testid="proximity-alert-banner"
      >
        <button
          type="button"
          onClick={() => dismiss(latest.id)}
          className="flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-full bg-[#141414] px-4 py-2 ring-1 ring-[#ffffff]/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-200 active:scale-[0.97] hover:bg-[#202020] backdrop-blur-md"
          aria-label={`${latest.message} — tap to dismiss`}
        >
          <motion.span
            animate={{ scale: [1, 1.25, 1] }}
            transition={{
              duration: 1.4,
              ease: PREMIUM_EASE,
              repeat: Infinity,
            }}
          >
            <CaretUp size={14} weight="bold" className="text-[#e6b800]" />
          </motion.span>
          <span
            className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.06em] text-white truncate"
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
