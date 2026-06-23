"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CircleNotch, Sparkle, MapTrifold, Storefront, Coins } from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { useEconomyStore } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import {
  WHEEL_SEGMENTS,
  SEGMENT_ANGLE,
  BIG_PRIZE_INDEX,
  computeSpinResult,
  applySpinReward,
  computeTargetRotation,
  type SpinResult,
  type RewardOutcome,
} from "@/engine/nearMissAlgorithm";
import { cn } from "@/lib/utils";

/**
 * SpinningWheel — the variable-reward spinning wheel overlay with near-miss
 * bias (VAL-WHEEL-001..017).
 *
 * The wheel appears periodically (gated by economyStore.spinningWheel.available
 * + cooldown). When available, a floating entry button invites the user to
 * spin. The overlay shows 7 prize segments (1, 3, 5, 10 tokens, map reveal,
 * flash sale access, nothing). Tapping SPIN triggers a dramatic 3-second
 * deceleration animation (custom cubic-bezier). 40% of spins are near-misses
 * that land adjacent to the big prize — the wheel visibly slows at the big
 * prize then clicks past it. Token prizes are credited with the tier
 * multiplier. Neodymium tier gets a higher win rate.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;
const SPIN_DURATION_S = 3; // dramatic 3-second deceleration (VAL-WHEEL-004)

/* ============================================================================
   SVG geometry helpers
   ========================================================================== */

const CX = 160;
const CY = 160;
const R_OUTER = 150;
const R_INNER = 28;
const R_LABEL = 104;

/** SVG angle (deg) for the centre of segment i, with segment 0 at the top. */
function segmentCenterAngle(index: number): number {
  return -90 + index * SEGMENT_ANGLE;
}

/** Build an SVG path string for a wedge (donut slice). */
function describeWedge(startAngle: number, endAngle: number): string {
  const sRad = (startAngle * Math.PI) / 180;
  const eRad = (endAngle * Math.PI) / 180;

  const x1o = CX + R_OUTER * Math.cos(sRad);
  const y1o = CY + R_OUTER * Math.sin(sRad);
  const x2o = CX + R_OUTER * Math.cos(eRad);
  const y2o = CY + R_OUTER * Math.sin(eRad);

  const x1i = CX + R_INNER * Math.cos(sRad);
  const y1i = CY + R_INNER * Math.sin(sRad);
  const x2i = CX + R_INNER * Math.cos(eRad);
  const y2i = CY + R_INNER * Math.sin(eRad);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${x1i} ${y1i}`,
    `L ${x1o} ${y1o}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 1 ${x2o} ${y2o}`,
    `L ${x2i} ${y2i}`,
    `A ${R_INNER} ${R_INNER} 0 ${largeArc} 0 ${x1i} ${y1i}`,
    "Z",
  ].join(" ");
}

/** Label position for a segment. */
function labelPos(index: number): { x: number; y: number; rotate: number } {
  const angle = segmentCenterAngle(index);
  const rad = (angle * Math.PI) / 180;
  return {
    x: CX + R_LABEL * Math.cos(rad),
    y: CY + R_LABEL * Math.sin(rad),
    rotate: angle + 90, // keep text upright relative to the wedge
  };
}

/* ============================================================================
   Entry button (floating, shown when wheel is available)
   ========================================================================== */

export function SpinningWheelEntryButton() {
  const showOverlay = useUIStore((s) => s.showOverlay);
  const wheelAvailable = useEconomyStore((s) => s.spinningWheel.available);
  const activeOverlay = useUIStore((s) => s.activeOverlay);

  const onOpen = useCallback(() => {
    showOverlay("spinning-wheel");
  }, [showOverlay]);

  if (!wheelAvailable) return null;
  if (activeOverlay !== "none" && activeOverlay !== "spinning-wheel") return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 24, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.85 }}
      transition={{ duration: 0.7, ease: PREMIUM_EASE }}
      onClick={onOpen}
      aria-label="Spin the wheel for a reward"
      className="fixed bottom-28 right-3 z-30 flex items-center gap-2 rounded-full bg-[#12121a]/90 px-4 py-2.5 ring-1 ring-[#d4af37]/40 backdrop-blur-2xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] sm:bottom-32 sm:right-4"
      style={{ boxShadow: "0 0 24px rgba(212,175,55,0.28)" }}
      data-testid="wheel-entry-button"
    >
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 8, ease: "linear", repeat: Infinity }}
      >
        <CircleNotch size={16} weight="light" className="text-[#d4af37]" />
      </motion.div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d4af37]">
        Spin&nbsp;Available
      </span>
      <motion.span
        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#d4af37]"
        animate={{ opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }}
        transition={{ duration: 1.5, ease: PREMIUM_EASE, repeat: Infinity }}
      />
    </motion.button>
  );
}

/* ============================================================================
   Overlay — outer wrapper (handles AnimatePresence + open/close)
   ========================================================================== */

export function SpinningWheel() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const isOpen = activeOverlay === "spinning-wheel";

  return (
    <AnimatePresence>
      {isOpen && <SpinningWheelContent key="spinning-wheel-content" />}
    </AnimatePresence>
  );
}

/* ============================================================================
   Overlay — inner content (mounted fresh each open → clean state)
   ========================================================================== */

type Phase = "idle" | "spinning" | "result";

function SpinningWheelContent() {
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  const wheelAvailable = useEconomyStore((s) => s.spinningWheel.available);
  const spinWheelStore = useEconomyStore((s) => s.spinWheel);
  const tier = usePlayerStore((s) => s.tier);

  // Fresh state on every mount (no useEffect reset needed).
  const [phase, setPhase] = useState<Phase>("idle");
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [outcome, setOutcome] = useState<RewardOutcome | null>(null);
  const [highlightBigPrize, setHighlightBigPrize] = useState(false);

  const rotationRef = useRef(0);

  /* --- Spin handler --- */
  const handleSpin = useCallback(() => {
    if (phase !== "idle" || !wheelAvailable) return;

    const spinResult = computeSpinResult(tier);
    setResult(spinResult);
    setPhase("spinning");
    setHighlightBigPrize(false);

    // Start cooldown (sets available=false, lastSpin=now, spinCount++).
    spinWheelStore();

    const target = computeTargetRotation(rotationRef.current, spinResult.segmentIndex);
    rotationRef.current = target;
    setRotation(target);
  }, [phase, wheelAvailable, tier, spinWheelStore]);

  /* --- Animation complete: apply reward + show result --- */
  const onAnimationComplete = useCallback(() => {
    if (phase !== "spinning" || !result) return;

    const rewardOutcome = applySpinReward(result);
    setOutcome(rewardOutcome);
    setPhase("result");

    // Near-miss: pulse the big prize to emphasise "so close!"
    if (result.nearMiss) {
      setHighlightBigPrize(true);
    }
  }, [phase, result]);

  /* --- Close handler --- */
  const handleClose = useCallback(() => {
    hideOverlay();
  }, [hideOverlay]);

  /* --- Pre-compute wedge paths --- */
  const wedges = useMemo(
    () =>
      WHEEL_SEGMENTS.map((seg) => {
        const center = segmentCenterAngle(seg.index);
        const start = center - SEGMENT_ANGLE / 2;
        const end = center + SEGMENT_ANGLE / 2;
        return {
          ...seg,
          path: describeWedge(start, end),
          labelTransform: labelPos(seg.index),
        };
      }),
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: PREMIUM_EASE }}
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      data-testid="spinning-wheel-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Spinning wheel"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-2xl bg-black/60"
        onClick={handleClose}
      />

      {/* Double-bezel glass card */}
      <motion.div
        initial={{ opacity: 0, y: 48, scale: 0.92, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: 24, scale: 0.95, filter: "blur(4px)" }}
        transition={{ duration: 0.7, ease: PREMIUM_EASE }}
        className="relative rounded-[2rem] bg-white/5 ring-1 ring-white/10 p-1.5"
        data-testid="wheel-card"
      >
        <div className="relative rounded-[calc(2rem-0.375rem)] bg-[#12121a] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] sm:p-8">
          {/* Close button */}
          <button
            onClick={handleClose}
            aria-label="Close spinning wheel"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 text-[#a1a1aa] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] hover:text-white"
            data-testid="wheel-close-button"
          >
            <X size={16} weight="light" />
          </button>

          {/* Title */}
          <div className="mb-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#71717a]">
              Mystic Wheel
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#f5f5f7] sm:text-2xl">
              Spin for Rewards
            </h2>
          </div>

          {/* Wheel */}
          <div
            className="relative mx-auto flex items-center justify-center"
            style={{ width: 340, height: 340 }}
          >
            {/* Pointer (fixed, at top) */}
            <div
              className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1"
              data-testid="wheel-pointer"
            >
              <div
                className="h-0 w-0"
                style={{
                  borderLeft: "12px solid transparent",
                  borderRight: "12px solid transparent",
                  borderTop: "20px solid #d4af37",
                  filter: "drop-shadow(0 0 6px rgba(212,175,55,0.6))",
                }}
              />
            </div>

            {/* Outer glow ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{ boxShadow: "0 0 32px rgba(212,175,55,0.12)" }}
            />

            {/* Rotating wheel SVG */}
            <motion.svg
              width={340}
              height={340}
              viewBox="0 0 320 320"
              animate={{ rotate: rotation }}
              transition={{
                duration: SPIN_DURATION_S,
                ease: PREMIUM_EASE,
              }}
              onAnimationComplete={onAnimationComplete}
              style={{ transformOrigin: "170px 170px" }}
              data-testid="wheel-svg"
            >
              {/* Segments */}
              {wedges.map((w) => {
                const isBigPrize = w.index === BIG_PRIZE_INDEX;
                return (
                  <g key={w.index}>
                    <path
                      d={w.path}
                      fill={w.color}
                      fillOpacity={isBigPrize ? 0.22 : 0.14}
                      stroke={w.color}
                      strokeOpacity={isBigPrize ? 0.6 : 0.35}
                      strokeWidth={1.5}
                      className={cn(
                        isBigPrize && highlightBigPrize && "animate-pulse"
                      )}
                      style={
                        isBigPrize && highlightBigPrize
                          ? { filter: `drop-shadow(0 0 8px ${w.color})` }
                          : undefined
                      }
                    />
                    {/* Segment label */}
                    <g
                      transform={`translate(${w.labelTransform.x} ${w.labelTransform.y}) rotate(${w.labelTransform.rotate})`}
                    >
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={w.color}
                        fontSize={isBigPrize ? 13 : 11}
                        fontWeight={isBigPrize ? 700 : 600}
                        style={{ userSelect: "none" }}
                      >
                        {w.label}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Center hub */}
              <circle
                cx={CX}
                cy={CY}
                r={R_INNER}
                fill="#12121a"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={1.5}
              />
              <circle cx={CX} cy={CY} r={R_INNER - 6} fill="#1a1a25" />
            </motion.svg>

            {/* Center icon */}
            <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <Coins size={24} weight="light" className="text-[#d4af37]" />
            </div>
          </div>

          {/* Spin button / Result */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <AnimatePresence mode="wait">
              {phase === "idle" && (
                <motion.button
                  key="spin"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.4, ease: PREMIUM_EASE }}
                  onClick={handleSpin}
                  disabled={!wheelAvailable}
                  className="flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#d4af37] to-[#b8941f] px-8 py-3.5 text-sm font-bold text-black transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:opacity-50"
                  style={{ boxShadow: "0 0 20px rgba(212,175,55,0.3)" }}
                  data-testid="wheel-spin-button"
                >
                  <Sparkle size={16} weight="fill" />
                  SPIN THE WHEEL
                </motion.button>
              )}

              {phase === "spinning" && (
                <motion.div
                  key="spinning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: PREMIUM_EASE }}
                  className="text-sm font-medium tracking-wide text-[#a1a1aa]"
                  data-testid="wheel-spinning-label"
                >
                  Spinning…
                </motion.div>
              )}

              {phase === "result" && outcome && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 16, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.6, ease: PREMIUM_EASE }}
                  className="flex flex-col items-center gap-3"
                  data-testid="wheel-result"
                >
                  <ResultBadge
                    outcome={outcome}
                    nearMiss={result?.nearMiss ?? false}
                  />
                  {result?.nearMiss && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.6, ease: PREMIUM_EASE }}
                      className="text-[11px] uppercase tracking-[0.16em] text-[#d4af37]/70"
                      data-testid="wheel-nearmiss-message"
                    >
                      So close to 10 tokens!
                    </motion.p>
                  )}
                  <button
                    onClick={handleClose}
                    className="rounded-full bg-white/5 ring-1 ring-white/10 px-6 py-2.5 text-sm font-medium text-[#f5f5f7] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
                    data-testid="wheel-dismiss-button"
                  >
                    {outcome.type === "nothing" ? "Maybe next time" : "Collect & Close"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cooldown hint */}
            {phase === "idle" && !wheelAvailable && (
              <p
                className="text-[11px] text-[#71717a]"
                data-testid="wheel-cooldown-hint"
              >
                Wheel on cooldown — check back shortly.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============================================================================
   Result badge
   ========================================================================== */

function ResultBadge({
  outcome,
  nearMiss,
}: {
  outcome: RewardOutcome;
  nearMiss: boolean;
}) {
  const accent =
    outcome.type === "tokens"
      ? "#d4af37"
      : outcome.type === "map-reveal"
        ? "#9d7fdb"
        : outcome.type === "flash-sale"
          ? "#e879a1"
          : "#71717a";

  const Icon =
    outcome.type === "map-reveal"
      ? MapTrifold
      : outcome.type === "flash-sale"
        ? Storefront
        : outcome.type === "tokens"
          ? Coins
          : X;

  return (
    <div
      className="flex items-center gap-3 rounded-full px-5 py-2.5 ring-1"
      style={{
        backgroundColor: `${accent}14`,
        ["--tw-ring-color" as string]: `${accent}40`,
        boxShadow: `0 0 16px ${accent}22`,
      }}
    >
      <Icon size={18} weight="light" style={{ color: accent }} />
      <span
        className="font-mono text-sm font-bold tracking-tight"
        style={{ color: accent }}
        data-testid="wheel-result-message"
      >
        {outcome.message}
      </span>
      {nearMiss && outcome.type === "nothing" && (
        <span className="sr-only" data-testid="wheel-result-nearmiss">
          near-miss
        </span>
      )}
    </div>
  );
}

export default SpinningWheel;
