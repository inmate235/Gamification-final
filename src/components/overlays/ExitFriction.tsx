"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  SignOut,
  Sparkle,
  Fire,
  Coins,
  Clock,
  MapPin,
  Trophy,
  Users,
  Tag,
  CircleNotch,
  ShieldStar,
  ArrowRight,
  Heartbeat,
} from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import {
  buildExitFrictionData,
  stayInMall,
  leaveAnyway,
  acceptRescueBargain,
} from "@/engine/exitFrictionEngine";
import type { ExitFrictionData } from "@/types";

/**
 * ExitFriction — the 3-layer leave-mall friction overlay
 * (VAL-EXIT-001..032).
 *
 * Layer 1 (Soft Nudge): dismissible screen showing what they'll miss — active
 *   flash sales, unexplored %, tokens away from the nearest shortcut.
 * Layer 2 (Guilt Escalation): streak status, sunk-cost summary, friends still
 *   inside.
 * Layer 3 (Rescue Bargain): "Stay 5 more min for bonus spinning wheel + streak
 *   protection + 2x token boost".
 *
 * Each layer provides a "Stay" option (resets the exit counter and returns to
 * the mall) and a "Leave anyway" option (advances to the next layer, or on
 * Layer 3 actually exits). The user can always eventually leave — friction,
 * not blocking (VAL-EXIT-017).
 *
 * The overlay is driven by `uiStore.activeOverlay === 'exit-friction'`
 * (VAL-EXIT-030). The displayed numbers are re-derived from the live stores
 * on every render and synced back into `overlayData` so the data and the
 * rendered text can never diverge (VAL-EXIT-031).
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Component
   ========================================================================== */

export function ExitFriction() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const overlayData = useUIStore((s) => s.overlayData) as ExitFrictionData | null;
  const exitFrictionLayer = useSessionStore((s) => s.exitFrictionLayer);
  const showOverlay = useUIStore((s) => s.showOverlay);

  const isOpen = activeOverlay === "exit-friction";

  // The authoritative layer is the sessionStore counter (matches the attempt
  // count, VAL-EXIT-020, VAL-EXIT-026). Fall back to the overlay payload.
  const layer = (Math.max(1, Math.min(3, exitFrictionLayer)) as 1 | 2 | 3) ?? 1;

  /* --- Keep overlayData in sync with the live-rendered values (VAL-EXIT-031) */
  useEffect(() => {
    if (!isOpen) return;
    const data = buildExitFrictionData(layer);
    // Only update when the layer changes or values shift to avoid loops.
    showOverlay("exit-friction", data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, layer, exitFrictionLayer]);

  /* --- Esc acts as "Stay" (dismiss) --- */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stayInMall();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <ExitFrictionContent
          key={`exit-friction-${layer}`}
          layer={layer}
          data={overlayData}
        />
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
   Content (mounted fresh per layer so AnimatePresence replays the entrance)
   ========================================================================== */

interface ContentProps {
  layer: 1 | 2 | 3;
  data: ExitFrictionData | null;
}

function ExitFrictionContent({ layer, data }: ContentProps) {
  // Always derive from the live stores so the rendered text matches the
  // overlayData we synced in the parent effect (VAL-EXIT-031).
  const live = buildExitFrictionData(layer);
  const d: ExitFrictionData = data ?? live;
  // Prefer the freshest values for display, but keep `d` as a fallback for
  // any field live might not have populated yet.
  const display = { ...d, ...live };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: PREMIUM_EASE }}
      className="fixed inset-0 z-40 flex items-center justify-center px-4 py-10"
      data-testid="exit-friction-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Leave mall — layer ${layer}`}
    >
      {/* Backdrop — light tinted glass */}
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{
          background:
            layer === 3
              ? "radial-gradient(ellipse at center, rgba(124,58,237,0.12) 0%, rgba(20,20,20,0.3) 60%, rgba(20,20,20,0.45) 100%)"
              : layer === 2
                ? "radial-gradient(ellipse at center, rgba(239,68,68,0.1) 0%, rgba(20,20,20,0.3) 60%, rgba(20,20,20,0.45) 100%)"
                : "radial-gradient(ellipse at center, rgba(230,0,158,0.08) 0%, rgba(20,20,20,0.3) 60%, rgba(20,20,20,0.45) 100%)",
        }}
        data-testid="exit-friction-backdrop"
      />

      {/* Double-bezel glass card */}
      <motion.div
        initial={{ opacity: 0, y: 48, scale: 0.94, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: 24, scale: 0.96, filter: "blur(4px)" }}
        transition={{ duration: 0.7, ease: PREMIUM_EASE }}
        className="relative w-full max-w-md"
        data-testid="exit-friction-card"
      >
        <div className="bezel-card">
          <div className="bezel-card-inner relative max-h-[80dvh] overflow-y-auto p-6 sm:p-8">
            {/* Close (Stay) control */}
            <button
              onClick={stayInMall}
              aria-label="Stay in the mall"
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#141414]/5 ring-1 ring-[#141414]/10 text-[#8a8a8a] transition-all duration-200 active:scale-[0.97] hover:text-[#141414]"
              data-testid="exit-friction-close"
            >
              <X size={16} weight="bold" />
            </button>

            {/* Layer indicator */}
            <div className="mb-5 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]">
                {layer === 3 ? "Final offer" : `Attempt ${layer} of 3`}
              </span>
            </div>

            {layer === 1 && <Layer1 display={display} />}
            {layer === 2 && <Layer2 display={display} />}
            {layer === 3 && <Layer3 display={display} />}

            {/* Action buttons (shared) */}
            <Actions layer={layer} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============================================================================
   Layer 1 — Soft Nudge
   ========================================================================== */

function Layer1({ display }: { display: ExitFrictionData }) {
  return (
    <div data-testid="exit-friction-layer-1">
      <Eyebrow color="#e6009e">Before you go</Eyebrow>
      <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#141414] sm:text-3xl">
        Wait — you&rsquo;ll miss out
      </h2>
      <p className="mt-2 text-sm text-[#4b4b4b]">
        A few things are still waiting for you inside the mall.
      </p>

      <div className="mt-6 space-y-3" data-testid="exit-friction-miss">
        {/* Active flash sales (VAL-EXIT-005) */}
        {display.missedSales.length > 0 ? (
          <div data-testid="exit-friction-missed-sales">
            {display.missedSales.slice(0, 3).map((sale, i) => (
              <MissRow
                key={`sale-${i}`}
                icon={<Tag size={16} weight="fill" className="text-[#e6009e]" />}
                title={`${sale.discount} at ${sale.storeName}`}
                sub={`${formatCountdown(sale.countdownSeconds)} left`}
                accent="#e6009e"
              />
            ))}
          </div>
        ) : (
          <MissRow
            icon={<Tag size={16} weight="fill" className="text-[#8a8a8a]" />}
            title="No flash sales right now"
            sub="But new ones appear as you explore"
            accent="#8a8a8a"
          />
        )}

        {/* Unexplored percentage (VAL-EXIT-006) */}
        <MissRow
          icon={<MapPin size={16} weight="fill" className="text-[#14b8a6]" />}
          title={`You're ${display.explorationPercent}% explored`}
          sub={`${display.unexploredPercent}% of the mall remains a mystery`}
          accent="#14b8a6"
          testId="exit-friction-unexplored"
        />

        {/* Tokens away from shortcut (VAL-EXIT-007) */}
        <MissRow
          icon={<Coins size={16} weight="fill" className="text-[#e6b800]" />}
          title={`Only ${display.tokensAwayFromShortcut} tokens from a shortcut`}
          sub="Earn just a couple more to unlock a faster route"
          accent="#e6b800"
          testId="exit-friction-tokens-away"
        />
      </div>
    </div>
  );
}

/* ============================================================================
   Layer 2 — Guilt Escalation
   ========================================================================== */

function Layer2({ display }: { display: ExitFrictionData }) {
  const sunk = display.sunkCost;
  const friends = display.friendsInside.slice(0, 4);
  const primaryFriend = friends[0] ?? "Sarah";
  const others = Math.max(0, display.friendsInside.length - 1);

  return (
    <div data-testid="exit-friction-layer-2">
      <Eyebrow color="#ef4444">Think twice</Eyebrow>
      <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#141414] sm:text-3xl">
        Your {display.streakCount}-day streak will break
      </h2>
      <p className="mt-2 text-sm text-[#4b4b4b]">
        You&rsquo;ve built real momentum. Leaving now puts all of it at risk.
      </p>

      {/* Streak status (VAL-EXIT-009) */}
      <div
        className="mt-6 flex items-center gap-3 rounded-2xl bg-[#f4f4f5] px-4 py-3 ring-1 ring-[#141414]/8"
        data-testid="exit-friction-streak"
      >
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2, ease: PREMIUM_EASE, repeat: Infinity }}
        >
          <Fire size={22} weight="fill" className="text-[#f59e0b]" />
        </motion.div>
        <div>
          <p className="text-sm font-semibold text-[#141414]">
            Day {display.streakCount} streak
          </p>
          <p className="text-xs text-[#4b4b4b]">
            Leave now and you risk losing it.
          </p>
        </div>
      </div>

      {/* Sunk-cost summary (VAL-EXIT-010, VAL-EXIT-023..025) */}
      <div className="mt-4" data-testid="exit-friction-sunk-cost">
        <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]">
          What you&rsquo;ve invested
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <SunkStat
            icon={<Coins size={14} weight="fill" />}
            label="Tokens earned"
            value={sunk.cumulativeTokensEarned}
            color="#e6b800"
            testId="exit-friction-sunk-tokens"
          />
          <SunkStat
            icon={<Clock size={14} weight="fill" />}
            label="Time spent"
            value={`${sunk.timeSpentMinutes}m`}
            color="#14b8a6"
            testId="exit-friction-sunk-time"
          />
          <SunkStat
            icon={<MapPin size={14} weight="fill" />}
            label="Explored"
            value={`${sunk.explorationPercent}%`}
            color="#14b8a6"
            testId="exit-friction-sunk-progress"
          />
          <SunkStat
            icon={<Trophy size={14} weight="fill" />}
            label="Perks unlocked"
            value={sunk.perksUnlocked}
            color="#7c3aed"
          />
          <SunkStat
            icon={<Sparkle size={14} weight="fill" />}
            label="Tasks done"
            value={sunk.tasksCompleted}
            color="#e6b800"
          />
          <SunkStat
            icon={<Trophy size={14} weight="fill" />}
            label="Rank"
            value={sunk.leaderboardRank > 0 ? `#${sunk.leaderboardRank}` : "—"}
            color="#e6009e"
          />
        </div>
      </div>

      {/* Friends still inside (VAL-EXIT-011) */}
      <div
        className="mt-4 flex items-center gap-3 rounded-2xl bg-[#f4f4f5] px-4 py-3 ring-1 ring-[#141414]/8"
        data-testid="exit-friction-friends"
      >
        <Users size={20} weight="fill" className="text-[#7c3aed]" />
        <p className="text-sm text-[#141414]">
          <span className="font-semibold">{primaryFriend}</span>
          {others > 0 ? (
            <span className="text-[#4b4b4b]">
              {" "}
              and {others} other{others === 1 ? "" : "s"} are still exploring
            </span>
          ) : (
            <span className="text-[#4b4b4b]"> is still exploring</span>
          )}
        </p>
      </div>
    </div>
  );
}

/* ============================================================================
   Layer 3 — Rescue Bargain
   ========================================================================== */

function Layer3({ display }: { display: ExitFrictionData }) {
  const bargain = display.bargain;
  return (
    <div data-testid="exit-friction-layer-3">
      <Eyebrow color="#7c3aed">Last chance</Eyebrow>
      <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#141414] sm:text-3xl">
        Stay just {bargain.stayMinutes} more minutes
      </h2>
      <p className="mt-2 text-sm text-[#4b4b4b]">
        We&rsquo;ll make it worth your while. Accept these bonuses and keep your
        progress safe.
      </p>

      <div className="mt-6 space-y-2.5" data-testid="exit-friction-bargain">
        <BargainRow
          icon={<CircleNotch size={18} weight="fill" />}
          title="Bonus spinning wheel"
          sub="A free spin, right now"
          color="#e6009e"
          testId="exit-friction-bonus-wheel"
        />
        <BargainRow
          icon={<ShieldStar size={18} weight="fill" />}
          title="Streak protection"
          sub={`Your ${display.streakCount}-day streak is safe`}
          color="#7c3aed"
          testId="exit-friction-streak-protection"
        />
        <BargainRow
          icon={<Heartbeat size={18} weight="fill" />}
          title={`${bargain.tokenBoost}x token boost`}
          sub={`For the next ${bargain.stayMinutes} minutes`}
          color="#14b8a6"
          testId="exit-friction-token-boost"
        />
      </div>
    </div>
  );
}

/* ============================================================================
   Action buttons (Stay / Leave anyway) — VAL-EXIT-018, VAL-EXIT-019
   ========================================================================== */

function Actions({ layer }: { layer: 1 | 2 | 3 }) {
  const isFinal = layer === 3;

  return (
    <div className="mt-7 flex flex-col gap-2.5">
      {/* Stay (accept bargain on L3) */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: PREMIUM_EASE, delay: 0.15 }}
        onClick={isFinal ? acceptRescueBargain : stayInMall}
        className="btn-magenta group inline-flex w-full items-center justify-center gap-2.5"
        data-testid="exit-friction-stay"
      >
        {isFinal ? "Accept & Stay" : "Keep Exploring"}
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/15 transition-transform duration-200 group-hover:translate-x-0.5">
          <ArrowRight size={14} weight="bold" />
        </span>
      </motion.button>

      {/* Leave anyway */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: PREMIUM_EASE, delay: 0.25 }}
        onClick={leaveAnyway}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-[#4b4b4b] ring-1 ring-[#141414]/10 transition-all duration-200 active:scale-[0.98] hover:bg-[#f4f4f5]"
        data-testid="exit-friction-leave"
      >
        <SignOut size={15} weight="bold" />
        Leave anyway
      </motion.button>
    </div>
  );
}

/* ============================================================================
   Shared sub-components
   ========================================================================== */

function Eyebrow({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium ring-1"
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
    >
      <Sparkle size={11} weight="fill" style={{ color }} />
      {children}
    </span>
  );
}

function MissRow({
  icon,
  title,
  sub,
  accent,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  accent: string;
  testId?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl bg-[#f4f4f5] px-4 py-3 ring-1 ring-[#141414]/8"
      data-testid={testId}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: `${accent}14` }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#141414]">{title}</p>
        <p className="truncate text-xs text-[#4b4b4b]">{sub}</p>
      </div>
    </div>
  );
}

function SunkStat({
  icon,
  label,
  value,
  color,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  testId?: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl bg-[#f4f4f5] px-3 py-2.5 ring-1 ring-[#141414]/8"
      data-testid={testId}
    >
      <span style={{ color }}>{icon}</span>
      <div className="min-w-0">
        <p className="font-mono text-base font-bold leading-none" style={{ color }}>
          {value}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#8a8a8a]">
          {label}
        </p>
      </div>
    </div>
  );
}

function BargainRow({
  icon,
  title,
  sub,
  color,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  color: string;
  testId?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3 ring-1"
      style={{
        background: `${color}10`,
        borderColor: `${color}40`,
      }}
      data-testid={testId}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ background: `${color}1f` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color }}>
          {title}
        </p>
        <p className="text-xs text-[#4b4b4b]">{sub}</p>
      </div>
    </div>
  );
}

/* ============================================================================
   Helpers
   ========================================================================== */

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "ending";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default ExitFriction;
