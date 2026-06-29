"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkle, MapTrifold, Storefront, Coins } from "@phosphor-icons/react/dist/ssr";
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
import { BrainRotCelebration } from "@/components/overlays/BrainRotCelebration";
import { buySpins } from "@/engine/tokenEconomy";

/**
 * SpinningWheel — the variable-reward spinning wheel overlay with near-miss
 * bias (VAL-WHEEL-001..017).
 *
 * Playful Figma direction: white card with a bright colored wheel, magenta
 * pointer, magenta "SPIN!" button, light "Buy More Spins" panel, and
 * celebratory result badges. Segment colors come from the engine data.
 *
 * Behaviour preserved from the original:
 *  - Gated by economyStore.spinningWheel.available + cooldown
 *  - 7 prize segments, 3-second deceleration, 40% near-miss bias
 *  - Token prizes credited with tier multiplier
 *  - Mid-spin close prevention (reward preserved)
 *  - Buy-spins panel with near-miss discounted offer
 */

const SMOOTH = [0.32, 0.72, 0, 1] as const;
const POP = [0.34, 1.56, 0.64, 1] as const;
const SPIN_DURATION_S = 3; // dramatic 3-second deceleration (VAL-WHEEL-004)

/* ============================================================================
   SVG geometry helpers
   ========================================================================== */

const CX = 160;
const CY = 160;
const R_OUTER = 150;
const R_INNER = 28;
const R_LABEL = 104;

function segmentCenterAngle(index: number): number {
  return -90 + index * SEGMENT_ANGLE;
}

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

function labelPos(index: number): { x: number; y: number; rotate: number } {
  const angle = segmentCenterAngle(index);
  const rad = (angle * Math.PI) / 180;
  return {
    x: CX + R_LABEL * Math.cos(rad),
    y: CY + R_LABEL * Math.sin(rad),
    rotate: angle + 90,
  };
}

/* ============================================================================
   Entry button (floating, shown when wheel is available)
   ========================================================================== */

export function SpinningWheelEntryButton() {
  const showOverlay = useUIStore((s) => s.showOverlay);
  const spinningWheel = useEconomyStore((s) => s.spinningWheel);
  const wheelAvailable = spinningWheel.available;
  const extraSpins = spinningWheel.extraSpins ?? 0;
  const spinCount = spinningWheel.spinCount;
  const activeOverlay = useUIStore((s) => s.activeOverlay);

  const onOpen = useCallback(() => {
    showOverlay("spinning-wheel");
  }, [showOverlay]);

  if (!wheelAvailable && spinCount === 0) return null;
  if (activeOverlay !== "none" && activeOverlay !== "spinning-wheel") return null;

  const labelText = wheelAvailable
    ? "Free Spin"
    : extraSpins > 0
      ? `Spins (${extraSpins})`
      : "Spin";

  const showPulsingDot = wheelAvailable || extraSpins > 0;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.5, rotate: 10 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
      onClick={onOpen}
      aria-label="Spin the wheel for a reward"
      className="relative flex items-center gap-2.5 rounded-full bg-[#e6009e] px-5 py-3 text-white shadow-[0_6px_0_#b8007e] ring-2 ring-white transition-all duration-200 hover:scale-105 active:translate-y-[3px] active:shadow-[0_3px_0_#b8007e] overflow-hidden origin-top-right"
      data-testid="wheel-entry-button"
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg]"
        animate={{ x: ["-150%", "250%"] }}
        transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.5 }}
      />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
        className="relative z-10 shrink-0"
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background:
              "conic-gradient(#e6009e 0deg 60deg, #ffe600 60deg 120deg, #14b8a6 120deg 180deg, #7c3aed 180deg 240deg, #84cc16 240deg 300deg, #f59e0b 300deg 360deg)",
            border: "2px solid rgba(255,255,255,0.9)",
          }}
        />
      </motion.div>
      <span className="relative z-10 font-display text-[12px] font-bold uppercase tracking-[0.1em] text-white">
        {labelText}
      </span>
      {showPulsingDot && (
        <motion.span
          className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-[#ffe600] ring-2 ring-white"
          animate={{ opacity: [1, 0.4, 1], scale: [1, 1.4, 1] }}
          transition={{ duration: 0.8, ease: "easeInOut", repeat: Infinity }}
        />
      )}
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
  const spinningWheel = useEconomyStore((s) => s.spinningWheel);
  const wheelAvailable = spinningWheel.available;
  const extraSpins = spinningWheel.extraSpins ?? 0;
  const lastSpinNearMiss = spinningWheel.lastSpinNearMiss ?? false;
  const spinWheelStore = useEconomyStore((s) => s.spinWheel);
  const setLastSpinNearMiss = useEconomyStore((s) => s.setLastSpinNearMiss);
  const tier = usePlayerStore((s) => s.tier);
  const playerTokens = usePlayerStore((s) => s.tokens);

  const [phase, setPhase] = useState<Phase>("idle");
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [outcome, setOutcome] = useState<RewardOutcome | null>(null);
  const [highlightBigPrize, setHighlightBigPrize] = useState(false);

  const rotationRef = useRef(0);

  const handleSpin = useCallback(() => {
    if (phase !== "idle" || (!wheelAvailable && extraSpins <= 0)) return;

    const spinResult = computeSpinResult(tier);
    setResult(spinResult);
    setPhase("spinning");
    setHighlightBigPrize(false);

    spinWheelStore();

    const target = computeTargetRotation(
      rotationRef.current,
      spinResult.segmentIndex
    );
    rotationRef.current = target;
    setRotation(target);
  }, [phase, wheelAvailable, extraSpins, tier, spinWheelStore]);

  const onAnimationComplete = useCallback(() => {
    if (phase !== "spinning" || !result) return;

    const rewardOutcome = applySpinReward(result);
    setOutcome(rewardOutcome);
    setPhase("result");

    setLastSpinNearMiss(result.nearMiss);

    if (result.nearMiss) {
      setHighlightBigPrize(true);
    }
  }, [phase, result, setLastSpinNearMiss]);

  const handleBuySpins = useCallback((amount: number, cost: number) => {
    buySpins(amount, cost);
  }, []);

  const handleClose = useCallback(() => {
    if (phase === "spinning") return;
    hideOverlay();
  }, [hideOverlay, phase]);

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
      transition={{ duration: 0.35, ease: SMOOTH }}
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      data-testid="spinning-wheel-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Spinning wheel"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-md bg-[#141414]/40"
        onClick={handleClose}
        data-testid="wheel-backdrop"
      />

      {phase === "result" && result && (
        <BrainRotCelebration result={result} onClose={() => setPhase("idle")} />
      )}

      {/* White playful card */}
      <motion.div
        initial={{ opacity: 0, y: 48, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.95 }}
        transition={{ duration: 0.6, ease: POP }}
        className="relative w-full max-w-sm rounded-3xl bg-white shadow-[0_24px_64px_rgba(20,20,20,0.22)] ring-2 ring-[#141414]/8"
        data-testid="wheel-card"
      >
        <div className="relative p-6 sm:p-8">
          {/* Close button */}
          <button
            onClick={handleClose}
            disabled={phase === "spinning"}
            aria-label="Close spinning wheel"
            aria-disabled={phase === "spinning"}
            className={cn(
              "absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#141414]/5 text-[#141414] ring-1 ring-[#141414]/10 transition-all duration-200 active:scale-95 hover:bg-[#141414]/10",
              phase === "spinning" && "cursor-not-allowed opacity-40"
            )}
            data-testid="wheel-close-button"
          >
            <X size={16} weight="bold" />
          </button>

          {/* Title */}
          <div className="mb-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e6009e]">
              Mystic Wheel
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-[#141414] sm:text-2xl">
              Spin for Rewards
            </h2>
          </div>

          {/* Wheel */}
          <div
            className="relative mx-auto flex items-center justify-center"
            style={{ width: 340, height: 340 }}
          >
            {/* Pointer (fixed, at top) — glossy candy pink drop/bean style */}
            <div
              className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-2 pointer-events-none"
              data-testid="wheel-pointer"
            >
              <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 4px 6px rgba(184,0,126,0.45))" }}>
                <path
                  d="M16 42C16 42 32 24 32 12C32 5.37258 26.6274 0 20 0H12C5.37258 0 0 5.37258 0 12C0 24 16 42 16 42Z"
                  fill="url(#candyPointerGrad)"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <path
                  d="M8 4C5.79086 4 4 5.79086 4 8C4 9.5 4.5 11 5 12"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                <defs>
                  <linearGradient id="candyPointerGrad" x1="16" y1="0" x2="16" y2="42" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ff8cdb" />
                    <stop offset="0.5" stopColor="#e6009e" />
                    <stop offset="1" stopColor="#b8007e" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Outer ring — glossy 3D candy pink border (Candy-Crush premium pop) */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              {/* Ambient glow halo (subtle pulse) */}
              <motion.div
                className="absolute -inset-3 rounded-full bg-[#e6009e]/35 blur-2xl"
                animate={{ opacity: [0.45, 0.75, 0.45], scale: [1, 1.04, 1] }}
                transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
              />
              {/* Main candy ring — radial gradient + ring mask */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 32% 24%, #ffc2eb 0%, #ff6ccb 26%, #e6009e 58%, #a80071 100%)",
                  WebkitMask:
                    "radial-gradient(circle, transparent calc(100% - 12px), #000 calc(100% - 12px))",
                  mask: "radial-gradient(circle, transparent calc(100% - 12px), #000 calc(100% - 12px))",
                  boxShadow:
                    "inset 0 3px 7px rgba(255,255,255,0.9), inset 0 -5px 9px rgba(110,0,72,0.65), 0 14px 38px rgba(230,0,158,0.6), 0 0 0 1px rgba(255,255,255,0.55)",
                }}
              />
              {/* Specular top-left shine (screen blend for glossy pop) */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 30% 18%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 32%)",
                  WebkitMask:
                    "radial-gradient(circle, transparent calc(100% - 12px), #000 calc(100% - 12px))",
                  mask: "radial-gradient(circle, transparent calc(100% - 12px), #000 calc(100% - 12px))",
                  mixBlendMode: "screen",
                }}
              />
              {/* Inner bright rim — crisp candy edge against segments */}
              <div className="absolute inset-[10px] rounded-full ring-1 ring-white/75 shadow-[inset_0_2px_5px_rgba(255,255,255,0.65)]" />
            </div>

            {/* Rotating wheel SVG */}
            <motion.svg
              width={340}
              height={340}
              viewBox="0 0 320 320"
              animate={{ rotate: rotation }}
              transition={{
                duration: SPIN_DURATION_S,
                ease: SMOOTH,
              }}
              onAnimationComplete={onAnimationComplete}
              style={{ transformOrigin: "170px 170px" }}
              data-testid="wheel-svg"
            >
              <defs>
                <linearGradient id="candyHubGrad" x1={CX} y1={CY - R_INNER} x2={CX} y2={CY + R_INNER} gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ff8cdb" />
                  <stop offset="0.6" stopColor="#e6009e" />
                  <stop offset="1" stopColor="#b8007e" />
                </linearGradient>
                <radialGradient id="glossyShine" cx="35%" cy="35%" r="65%" fx="35%" fy="35%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                  <stop offset="50%" stopColor="#ffffff" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
                </radialGradient>
              </defs>

              {/* Segments */}
              {wedges.map((w) => {
                const isBigPrize = w.index === BIG_PRIZE_INDEX;
                return (
                  <g key={w.index}>
                    <path
                      d={w.path}
                      fill={w.color}
                      fillOpacity={isBigPrize ? 0.95 : 0.85}
                      stroke="#ffffff"
                      strokeOpacity={0.9}
                      strokeWidth={2}
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
                        fill="#ffffff"
                        fontSize={isBigPrize ? 13 : 11}
                        fontWeight={isBigPrize ? 700 : 600}
                        style={{ 
                          userSelect: "none",
                          filter: "drop-shadow(0 1.5px 2px rgba(20,20,20,0.65))"
                        }}
                      >
                        {w.label}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Radial glossy shine layer overlaying the segments */}
              <circle
                cx={CX}
                cy={CY}
                r={R_OUTER}
                fill="url(#glossyShine)"
                pointerEvents="none"
              />

              {/* Outer decorative candy dots / light sprinkles */}
              <circle
                cx={CX}
                cy={CY}
                r={R_OUTER - 14}
                fill="none"
                stroke="#ffffff"
                strokeWidth="4"
                strokeDasharray="6, 16"
                strokeLinecap="round"
                opacity="0.85"
                pointerEvents="none"
              />

              {/* Center hub — Glossy 3D Candy Pink */}
              <circle
                cx={CX}
                cy={CY}
                r={R_INNER}
                fill="url(#candyHubGrad)"
                stroke="#ffffff"
                strokeWidth={2.5}
                style={{ filter: "drop-shadow(0 3px 6px rgba(184,0,126,0.6))" }}
              />
              <path
                d={`M ${CX - 16} ${CY - 16} A 22 22 0 0 1 ${CX + 16} ${CY - 16}`}
                fill="none"
                stroke="#ffffff"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.65}
              />
            </motion.svg>
            {/* Center icon */}
            <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <Coins size={24} weight="fill" className="text-white drop-shadow-[0_2px_4px_rgba(184,0,126,0.6)]" />
            </div>
          </div>

          {/* Spin button / Result */}
          <div className="mt-6 flex flex-col items-center gap-3 w-full">
            <AnimatePresence mode="wait">
              {phase === "idle" && (
                <div className="flex flex-col items-center gap-4 w-full">
                  {(wheelAvailable || extraSpins > 0) ? (
                    <motion.button
                      key="spin"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.4, ease: SMOOTH }}
                      onClick={handleSpin}
                      whileTap={{ scale: 0.97 }}
                      className="btn-magenta w-full max-w-xs"
                      data-testid="wheel-spin-button"
                    >
                      <Sparkle size={16} weight="fill" />
                      {wheelAvailable
                        ? "SPIN THE WHEEL (FREE)"
                        : `SPIN WHEEL (${extraSpins} SPINS LEFT)`}
                    </motion.button>
                  ) : (
                    <button
                      disabled
                      className="hidden"
                      data-testid="wheel-spin-button"
                    />
                  )}

                  {!wheelAvailable && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm rounded-2xl bg-[#f4f4f5] ring-1 ring-[#141414]/8 p-4 flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-center border-b border-[#141414]/10 pb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#141414] flex items-center gap-1.5">
                          <Coins size={14} weight="fill" className="text-[#e6009e]" />{" "}
                          Buy More Spins
                        </span>
                        <span className="text-[10px] text-[#8a8a8a] font-mono">
                          Balance: {playerTokens} tokens
                        </span>
                      </div>

                      {lastSpinNearMiss && (
                        <motion.button
                          onClick={() => handleBuySpins(1, 2)}
                          disabled={playerTokens < 2}
                          className="relative flex items-center justify-between rounded-xl bg-[#e6009e]/8 ring-1.5 ring-[#e6009e]/45 px-4 py-3 text-left transition-all duration-200 hover:bg-[#e6009e]/15 active:scale-[0.98] disabled:opacity-50 overflow-hidden"
                          animate={{
                            boxShadow: [
                              "0 0 0px rgba(230,0,158,0)",
                              "0 0 8px rgba(230,0,158,0.25)",
                              "0 0 0px rgba(230,0,158,0)",
                            ],
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <div className="absolute right-0 top-0 bg-[#e6009e] text-white text-[8px] font-bold px-2 py-0.5 uppercase rounded-bl-lg tracking-wider">
                            Near-Miss Offer
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#e6009e] uppercase tracking-wider">
                              1 Discounted Spin
                            </div>
                            <div className="text-[10px] text-[#4b4b4b] mt-0.5">
                              So close! Get right back in!
                            </div>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-sm font-bold text-[#e6009e]">
                            <Coins size={14} weight="fill" /> 2
                          </div>
                        </motion.button>
                      )}

                      <div className="grid grid-cols-1 gap-2">
                        <button
                          onClick={() => handleBuySpins(1, 3)}
                          disabled={playerTokens < 3}
                          className="flex items-center justify-between rounded-xl bg-white ring-1 ring-[#141414]/10 px-4 py-2.5 text-left transition-all duration-200 hover:ring-[#141414]/25 active:scale-[0.98] disabled:opacity-50"
                        >
                          <div>
                            <div className="text-xs font-bold text-[#141414]">
                              1 Spin
                            </div>
                            <div className="text-[10px] text-[#8a8a8a]">
                              Instant action
                            </div>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-xs font-semibold text-[#141414]">
                            <Coins size={12} weight="fill" /> 3
                          </div>
                        </button>

                        <button
                          onClick={() => handleBuySpins(3, 7)}
                          disabled={playerTokens < 7}
                          className="flex items-center justify-between rounded-xl bg-white ring-1 ring-[#141414]/10 px-4 py-2.5 text-left transition-all duration-200 hover:ring-[#141414]/25 active:scale-[0.98] disabled:opacity-50"
                        >
                          <div>
                            <div className="text-xs font-bold text-[#141414]">
                              Duo Pack (3 Spins)
                            </div>
                            <div className="text-[10px] text-[#14b8a6] font-semibold">
                              Save 2 tokens!
                            </div>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-xs font-semibold text-[#141414]">
                            <Coins size={12} weight="fill" /> 7
                          </div>
                        </button>

                        <button
                          onClick={() => handleBuySpins(5, 10)}
                          disabled={playerTokens < 10}
                          className="flex items-center justify-between rounded-xl bg-[#ffe600] ring-1 ring-[#141414]/10 px-4 py-2.5 text-left transition-all duration-200 hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
                        >
                          <div>
                            <div className="text-xs font-bold text-[#141414]">
                              Jackpot Bundle (5 Spins)
                            </div>
                            <div className="text-[10px] text-[#141414]/70 font-bold uppercase tracking-wide">
                              Best Value! Save 5
                            </div>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-xs font-bold text-[#141414]">
                            <Coins size={12} weight="fill" /> 10
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {phase === "spinning" && (
                <motion.div
                  key="spinning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: SMOOTH }}
                  className="text-sm font-medium tracking-wide text-[#8a8a8a]"
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
                  transition={{ duration: 0.6, ease: POP }}
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
                      transition={{ delay: 0.4, duration: 0.6, ease: SMOOTH }}
                      className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e6009e]/70"
                      data-testid="wheel-nearmiss-message"
                    >
                      So close to 10 tokens!
                    </motion.p>
                  )}
                  <button
                    onClick={handleClose}
                    className="rounded-full bg-[#141414]/5 ring-1 ring-[#141414]/10 px-6 py-2.5 text-sm font-medium text-[#141414] transition-all duration-200 hover:bg-[#141414]/10 active:scale-95"
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
                className="text-[11px] text-[#8a8a8a]"
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
      ? "#e6009e"
      : outcome.type === "map-reveal"
        ? "#7c3aed"
        : outcome.type === "flash-sale"
          ? "#f59e0b"
          : "#8a8a8a";

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
      className="flex items-center gap-3 rounded-full px-5 py-2.5 ring-1.5"
      style={{
        backgroundColor: `${accent}14`,
        ["--tw-ring-color" as string]: `${accent}40`,
      }}
    >
      <Icon size={18} weight="fill" style={{ color: accent }} />
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
