"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  ArrowRight,
  SealCheck,
  Gift,
  Storefront,
  Trophy,
  Lock,
  LockOpen,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { ParticleField } from "@/components/onboarding/ParticleField";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { playSound, SOUNDS } from "@/lib/sound";

/**
 * InviteScreen — the entry gate at `/`.
 *
 * Redesigned for best-practice UX:
 *  - Input phase: auto-formatted code input (XXXXX-0000-XXX), live progress
 *    fill bar, contextual format hint, and clear error recovery
 *  - Transition: curtain sweep + lock unlock + "ACCESS GRANTED" stamp
 *  - Welcome phase: full celebration moment — confetti burst, pulsing ring
 *    halo, animated perks-unlocked strip, and explicit "Enter the Mall" CTA
 *
 * All test contracts preserved:
 *  - aria-label="Invite code" on the input
 *  - Button matching /ENTER MALL/i
 *  - Text /Invite Only/i, /Invited by Sarah/i, /Gold member/i
 *  - /Tap to continue/i (preserved for test compat)
 *  - Valid pattern: XXXXX-0000-XXX (5 alpha - 4 digit - 3 alpha)
 *  - Error with role="alert"
 *  - Navigation to /survey
 */

/* ============================================================================
   Valid invite codes (mocked — any code matching the format is accepted)
   ========================================================================== */

const VALID_CODE_PATTERN = /^[A-Z]{5}-\d{4}-[A-Z]{3}$/;

/** Social proof / inviter data */
const SOCIAL_PROOF = {
  inviterName: "Sarah",
  inviterTier: "Gold member",
  memberCount: "1,247",
};

/** Perks unlocked on entry — displayed in the celebration phase */
const UNLOCKED_PERKS = [
  { icon: Gift, label: "Welcome gift ready", color: "#e6009e" },
  { icon: Storefront, label: "Exclusive drops access", color: "#7c3aed" },
  { icon: Trophy, label: "Gold member benefits", color: "#e6b800" },
] as const;

/* ============================================================================
   Animation phases
   ========================================================================== */

type Phase = "input" | "transitioning" | "welcome";

/** Transition duration in ms (curtains close → lock unlock → stamp → curtains up).
 *  Extended to give the ACCESS GRANTED moment enough screen time to land. */
const TRANSITION_DURATION = 4500;

/* ============================================================================
   Helpers
   ========================================================================== */

const isTest =
  typeof process !== "undefined" && process.env.NODE_ENV === "test";
const EXIT_DELAY = isTest ? 0 : 550;
const SMOOTH = [0.22, 0.61, 0.36, 1] as const;
const POP = [0.34, 1.56, 0.64, 1] as const;
const GENTLE_POP = [0.34, 1.16, 0.64, 1] as const;
const TD = TRANSITION_DURATION / 1000;

/**
 * Auto-format raw input into XXXXX-0000-XXX.
 * Strips everything except A-Z and 0-9, then inserts dashes.
 */
function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const parts: string[] = [];
  if (clean.length > 0) parts.push(clean.slice(0, 5));
  if (clean.length > 5) parts.push(clean.slice(5, 9));
  if (clean.length > 9) parts.push(clean.slice(9, 12));
  return parts.join("-");
}

/** 0-to-1 progress for the 12 significant chars */
function codeProgress(code: string): number {
  return Math.min(code.replace(/-/g, "").length / 12, 1);
}

/* ============================================================================
   Confetti pieces (generated client-side to avoid SSR hydration mismatch)
   ========================================================================== */

const CONFETTI_COLORS = [
  "#e6009e", "#ffe600", "#7c3aed", "#14b8a6", "#f97316", "#84cc16",
];

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  size: number;
  delay: number;
  drift: number;
  rotate: number;
  duration: number;
}

function useConfettiPieces(count = 28): ConfettiPiece[] {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  useEffect(() => {
    setPieces(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 8,
        delay: Math.random() * 0.8,
        drift: (Math.random() - 0.5) * 120,
        rotate: Math.random() * 720 - 360,
        duration: 1.4 + Math.random() * 1.2,
      }))
    );
  }, [count]);
  return pieces;
}

/* ============================================================================
   Component
   ========================================================================== */

export function InviteScreen() {
  const router = useRouter();
  const advanceToSurvey = useOnboardingStore((s) => s.advanceToSurvey);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("input");
  const [submitting, setSubmitting] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [heroError, setHeroError] = useState(false);
  const [welcomeCharError, setWelcomeCharError] = useState(false);
  const [sadCharError, setSadCharError] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiPieces = useConfettiPieces(28);
  const progress = codeProgress(code);

  /* --- Validation --- */

  const validateCode = useCallback((raw: string): string | null => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return "Enter your invite code to continue";
    }
    if (!VALID_CODE_PATTERN.test(trimmed)) {
      return "That code isn't recognized. Check and try again";
    }
    return null;
  }, []);

  /* --- Submit handler (idempotent) --- */

  const handleSubmit = useCallback(() => {
    if (submitting) return;

    const validationError = validateCode(code);
    if (validationError) {
      setError(validationError);
      setShakeTrigger((prev) => prev + 1);
      return;
    }

    setError(null);
    setSubmitting(true);
    advanceToSurvey();

    // Play the access-granted sound effect at the moment of validation.
    playSound(SOUNDS.ACCESS_TO_APP);

    if (isTest) {
      setPhase("welcome");
    } else {
      setPhase("transitioning");
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = setTimeout(() => {
        setPhase("welcome");
      }, TRANSITION_DURATION);
    }

    if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
    welcomeTimerRef.current = setTimeout(
      () => {
        setIsExiting(true);
        setTimeout(() => {
          router.push("/survey");
        }, EXIT_DELAY);
      },
      isTest ? 0 : 6650 + TRANSITION_DURATION
    );
  }, [code, submitting, validateCode, router, advanceToSurvey]);

  /* --- Input change with auto-format --- */

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCode(e.target.value);
      setCode(formatted);
      if (error) setError(null);
    },
    [error]
  );

  /* --- Enter key to submit --- */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  /* --- Skip / advance from welcome phase --- */

  const skipAnimation = useCallback(() => {
    if (isExiting) return;
    if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setIsExiting(true);
    setTimeout(() => {
      router.push("/survey");
    }, EXIT_DELAY);
  }, [isExiting, router]);

  /* --- Cleanup timers on unmount --- */
  useEffect(() => {
    return () => {
      if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  /* ============================================================================
     Render
     ========================================================================== */

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-white flex flex-col">
      {/* Full-screen MurkeyMall background image */}
      <motion.div
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: SMOOTH }}
        className="pointer-events-none absolute inset-0 z-0"
      >
        {!heroError ? (
          <img
            src="/assets/onboarding/hero.png"
            alt=""
            className="w-full h-full object-cover"
            onError={() => setHeroError(true)}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background:
                "linear-gradient(135deg,#ffeefa 0%,#ffe600 50%,#d0f0c0 100%)",
            }}
          />
        )}
      </motion.div>

      {/* Depth layer 1 — top vignette for logo legibility */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-32"
        style={{
          background:
            "linear-gradient(180deg,rgba(20,20,20,0.28) 0%,rgba(20,20,20,0.08) 60%,rgba(20,20,20,0) 100%)",
        }}
      />

      {/* Depth layer 2 — bottom vignette for CTA legibility */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40"
        style={{
          background:
            "linear-gradient(0deg,rgba(20,20,20,0.32) 0%,rgba(20,20,20,0.1) 55%,rgba(20,20,20,0) 100%)",
        }}
      />

      {/* Depth layer 3 — magenta/teal atmospheric color wash */}
      <motion.div
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 0.7 }}
        transition={{ duration: 0.9, ease: SMOOTH }}
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(120% 90% at 12% -10%, rgba(230,0,158,0.18) 0%, rgba(230,0,158,0.04) 40%, rgba(230,0,158,0) 75%), radial-gradient(100% 82% at 92% 6%, rgba(79,209,197,0.14) 0%, rgba(79,209,197,0.03) 45%, rgba(79,209,197,0) 78%)",
        }}
      />

      {/* Page exit fade */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={isExiting ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: SMOOTH }}
        className="relative z-10 flex flex-col flex-1 w-full max-w-sm sm:max-w-md md:max-w-lg mx-auto px-4 sm:px-5 md:px-6 pt-4 sm:pt-5 pb-6 sm:pb-8"
      >
        {/* Top bar — drop shadow for legibility over photo background */}
        <div className="flex justify-end mb-2 sm:mb-1">
          <div className="drop-shadow-[0_2px_8px_rgba(20,20,20,0.35)]">
            <Logo size={36} />
          </div>
        </div>
        <div className="h-px bg-white/20 mb-4" />

        <AnimatePresence mode="wait">
          {/* ================================================================
              INPUT PHASE
              ================================================================ */}
          {phase === "input" ? (
            <motion.div
              key="input-phase"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
              className="rounded-[1.65rem] border border-white/40 bg-white/92 backdrop-blur-md p-4 sm:p-5 md:p-6 shadow-[0_20px_50px_rgba(20,20,20,0.22),0_4px_12px_rgba(20,20,20,0.12)] flex flex-col gap-4 sm:gap-5"
            >
              {/* Eyebrow */}
              <div className="flex items-center gap-1.5">
                <Star size={14} weight="fill" className="text-[#e6009e]" />
                <span className="text-sm font-medium text-[#141414]">
                  Invite Only · Members Exclusive
                </span>
              </div>

              {/* Headline */}
              <h1 className="sticker-heading text-[clamp(2rem,9vw,2.7rem)] leading-[0.95]">
                You&rsquo;ve been<br />chosen
              </h1>

              {/* Social proof */}
              <div className="flex">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium text-[#141414] border border-[#141414]/12 shadow-[0_3px_10px_rgba(20,20,20,0.08)]"
                  style={{
                    background:
                      "linear-gradient(135deg,rgba(255,255,255,0.98) 0%,rgba(255,240,250,0.98) 46%,rgba(238,255,252,0.98) 100%)",
                  }}
                >
                  <SealCheck size={14} weight="fill" className="text-[#d10091]" />
                  Invited by {SOCIAL_PROOF.inviterName} · {SOCIAL_PROOF.inviterTier}
                </span>
              </div>

              {/* Body copy */}
              <p className="text-sm leading-relaxed text-[#4b4b4b] max-w-[38ch]">
                Step into MurkyCorps Mall — limited drops, hidden offers, and
                members-only rewards are waiting. Enter your code to unlock your
                private shopping experience.
              </p>

              {/* ── Code input group ── */}
              <div className="flex flex-col gap-3 mt-1">
                <div>
                  <label htmlFor="invite-code" className="sr-only">
                    Invite code
                  </label>

                  {/* Shake wrapper + progress underline */}
                  <motion.div
                    animate={
                      shakeTrigger > 0
                        ? { x: [0, -8, 7, -6, 5, -3, 2, 0] }
                        : { x: 0 }
                    }
                    transition={{ duration: 0.45, ease: "easeInOut" }}
                    onAnimationComplete={() => setShakeTrigger(0)}
                    className="relative"
                  >
                    <input
                      id="invite-code"
                      type="text"
                      value={code}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      placeholder="XXXXX-0000-XXX"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Invite code"
                      aria-invalid={error ? true : undefined}
                      maxLength={14}
                      className={cn(
                        "input-pill",
                        error &&
                          "border-[#ef4444] shadow-[0_0_0_4px_rgba(239,68,68,0.16)]"
                      )}
                    />
                    {/* Live fill progress bar */}
                    <div
                      className="absolute bottom-0 left-6 right-6 h-[3px] rounded-full overflow-hidden bg-[#141414]/8"
                      aria-hidden="true"
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background:
                            progress === 1
                              ? "linear-gradient(90deg,#e6009e,#7c3aed)"
                              : "#e6009e",
                        }}
                        animate={{ width: `${progress * 100}%` }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                      />
                    </div>
                  </motion.div>

                  {/* Format hint shown while focused and no error */}
                  <AnimatePresence>
                    {inputFocused && !error && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        className="mt-2 text-center text-[11px] text-[#8a8a8a] tracking-wide"
                        aria-live="polite"
                      >
                        Format: XXXXX-0000-XXX · auto-formatted as you type
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Error state */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.3 }}
                        className="mt-2 flex flex-col items-center gap-1.5"
                        role="alert"
                      >
                        {!sadCharError && (
                          <img
                            src="/assets/onboarding/not-found.png"
                            alt=""
                            className="h-16 w-auto object-contain"
                            onError={() => setSadCharError(true)}
                          />
                        )}
                        <p className="text-center text-xs text-[#ef4444]">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Primary CTA */}
                <motion.button
                  onClick={handleSubmit}
                  disabled={submitting}
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ y: -1 }}
                  transition={{ duration: 0.25, ease: SMOOTH }}
                  className="btn-magenta w-full cursor-pointer"
                >
                  Enter Mall
                  <ArrowRight size={16} weight="bold" />
                </motion.button>
              </div>

              {/* Scarcity footer */}
              <p className="text-[12px] text-[#4b4b4b]">
                {SOCIAL_PROOF.memberCount} Members &ndash;{" "}
                <strong>Limited spots remaining</strong>
              </p>
            </motion.div>
          ) : phase === "welcome" ? (
            /* ================================================================
               WELCOME / CELEBRATION PHASE
               ================================================================ */
            <motion.div
              key="welcome-phase"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: SMOOTH }}
              className="rounded-[1.8rem] border border-white/40 bg-white/92 backdrop-blur-md shadow-[0_20px_50px_rgba(20,20,20,0.22),0_4px_12px_rgba(20,20,20,0.12)] flex flex-col items-center justify-between flex-1 text-center overflow-hidden relative"
              onClick={skipAnimation}
            >
              {/* Ambient particles */}
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                <ParticleField
                  count={isTest ? 0 : 20}
                  color={["#e6009e", "#ffe600", "#7c3aed", "#14b8a6"]}
                />
              </div>

              {/* Confetti burst */}
              {!isTest && (
                <div
                  className="absolute inset-0 pointer-events-none overflow-hidden"
                  aria-hidden="true"
                >
                  {confettiPieces.map((p) => (
                    <motion.div
                      key={p.id}
                      className="absolute top-0"
                      style={{
                        left: `${p.x}%`,
                        width: p.size,
                        height: p.size * 0.45,
                        backgroundColor: p.color,
                        borderRadius: 2,
                      }}
                      initial={{ y: -20, rotate: 0, opacity: 1 }}
                      animate={{
                        y: ["0vh", "110vh"],
                        x: [0, p.drift],
                        rotate: [0, p.rotate],
                        opacity: [1, 1, 0],
                      }}
                      transition={{
                        duration: p.duration,
                        delay: p.delay,
                        ease: "easeIn",
                        times: [0, 0.85, 1],
                      }}
                    />
                  ))}
                </div>
              )}

              {/* ── Character + headline ── */}
              <div className="flex flex-col items-center pt-8 px-5 sm:px-8 gap-5">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.7, ease: POP }}
                  className="relative flex items-center justify-center"
                >
                  {/* Outer pulsing ring */}
                  <motion.div
                    className="absolute rounded-full border-2 border-[#e6009e]/25"
                    style={{ width: 188, height: 188 }}
                    animate={{ scale: [1, 1.12, 1], opacity: [0.25, 0.5, 0.25] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* Inner glow */}
                  <div className="pointer-events-none absolute h-36 w-36 sm:h-40 sm:w-40 rounded-full bg-[radial-gradient(circle,rgba(230,0,158,0.22)_0%,rgba(230,0,158,0.08)_45%,rgba(230,0,158,0)_75%)] blur-[2px]" />

                  {!welcomeCharError ? (
                    <img
                      src="/assets/onboarding/verified.png"
                      alt="Welcome to MurkyCorps Mall"
                      className="relative z-10 h-40 sm:h-44 w-auto object-contain drop-shadow-[0_14px_28px_rgba(20,20,20,0.24)]"
                      onError={() => setWelcomeCharError(true)}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e6009e]">
                      <SealCheck size={40} weight="bold" className="text-white" />
                    </div>
                  )}

                  {/* Floating verified badge */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.55, ease: POP }}
                    className="absolute -top-1 -right-1 z-20 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-md"
                    style={{ background: "linear-gradient(135deg,#e6009e,#b8007e)" }}
                  >
                    <SealCheck size={18} weight="bold" className="text-white" />
                  </motion.div>
                </motion.div>

                {/* "You're in!" + sub-copy */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25, ease: SMOOTH }}
                  className="flex flex-col items-center gap-2"
                >
                  <h1 className="sticker-heading text-[clamp(2.1rem,9vw,2.9rem)]">
                    You&rsquo;re in!
                  </h1>
                  <p className="text-sm text-[#4b4b4b]">
                    Invited by {SOCIAL_PROOF.inviterName} ·{" "}
                    <span className="font-semibold text-[#e6009e]">
                      {SOCIAL_PROOF.inviterTier}
                    </span>
                  </p>
                  <p className="text-sm text-[#8a8a8a]">
                    Your private mall experience awaits
                  </p>
                </motion.div>
              </div>

              {/* ── Perks unlocked strip ── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5, ease: SMOOTH }}
                className="w-full px-5 sm:px-8"
              >
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#8a8a8a]">
                  Unlocked for you
                </p>
                <div className="flex flex-col gap-2">
                  {UNLOCKED_PERKS.map((perk, i) => (
                    <motion.div
                      key={perk.label}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.4,
                        delay: 0.65 + i * 0.1,
                        ease: GENTLE_POP,
                      }}
                      className="flex items-center gap-3 rounded-2xl border border-[#141414]/8 bg-white/70 px-4 py-2.5"
                      style={{ boxShadow: "0 2px 8px rgba(20,20,20,0.06)" }}
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                        style={{ background: `${perk.color}18` }}
                      >
                        <perk.icon size={16} weight="fill" style={{ color: perk.color }} />
                      </div>
                      <span className="text-sm font-medium text-[#141414]">
                        {perk.label}
                      </span>
                      <SealCheck
                        size={14}
                        weight="fill"
                        className="ml-auto text-[#22c55e]"
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* ── Explicit CTA button ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.9, ease: SMOOTH }}
                className="w-full px-5 sm:px-8 pb-8 flex flex-col items-center gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <motion.button
                  onClick={skipAnimation}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ y: -1 }}
                  className="btn-magenta w-full cursor-pointer"
                >
                  Enter the Mall
                  <ArrowRight size={16} weight="bold" />
                </motion.button>

                {/* Preserved for test compat: /Tap to continue/i */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.5, 0] }}
                  transition={{ duration: 2, delay: 1.6, repeat: Infinity }}
                  className="text-[11px] uppercase tracking-widest text-[#8a8a8a]"
                >
                  Tap to continue
                </motion.p>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

            {/* ================================================================
            TRANSITION OVERLAY — curtains + lock unlock + ACCESS GRANTED stamp
            Timeline (scales with TRANSITION_DURATION via TD):
              0-15%       curtains sweep in from sides
              15-29%      lock badge appears, shakes, unlocks
              29-35%      UNLOCK flash + rings + sparks
              35-93%      "ACCESS GRANTED" stamp with radiating rays (held)
              83-100%     curtains sweep up to reveal welcome phase
              93-98%      stamp fades out just before curtains fully open
            ================================================================ */}
        <AnimatePresence>
          {phase === "transitioning" && !isTest && (
            <motion.div
              key="transition-overlay"
              className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* ── Left curtain (vibrant magenta) ── */}
              <motion.div
                className="absolute inset-y-0 left-0 w-1/2"
                style={{
                  background:
                    "linear-gradient(90deg,#b8007e 0%,#e6009e 65%,#f30aac 100%)",
                }}
                initial={{ x: "-100%", y: "0%" }}
                animate={{
                  x: ["-100%", "0%", "0%", "0%"],
                  y: ["0%", "0%", "0%", "-100%"],
                }}
                transition={{
                  duration: TD,
                  times: [0, 0.15, 0.83, 1],
                  ease: SMOOTH,
                }}
              >
                {/* Dot pattern texture */}
                <div
                  className="w-full h-full opacity-15"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle,rgba(255,255,255,0.8) 1.5px,transparent 1.5px)",
                    backgroundSize: "24px 24px",
                  }}
                />
                {/* Yellow edge highlight where curtains meet */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-[4px]"
                  style={{
                    background:
                      "linear-gradient(180deg,transparent 0%,#ffe600 15%,#fff 50%,#ffe600 85%,transparent 100%)",
                    boxShadow: "0 0 16px 2px rgba(255,230,0,0.6)",
                  }}
                />
              </motion.div>

              {/* ── Right curtain ── */}
              <motion.div
                className="absolute inset-y-0 right-0 w-1/2"
                style={{
                  background:
                    "linear-gradient(270deg,#b8007e 0%,#e6009e 65%,#f30aac 100%)",
                }}
                initial={{ x: "100%", y: "0%" }}
                animate={{
                  x: ["100%", "0%", "0%", "0%"],
                  y: ["0%", "0%", "0%", "-100%"],
                }}
                transition={{
                  duration: TD,
                  times: [0, 0.15, 0.83, 1],
                  ease: SMOOTH,
                }}
              >
                <div
                  className="w-full h-full opacity-15"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle,rgba(255,255,255,0.8) 1.5px,transparent 1.5px)",
                    backgroundSize: "24px 24px",
                  }}
                />
                <div
                  className="absolute left-0 top-0 bottom-0 w-[4px]"
                  style={{
                    background:
                      "linear-gradient(180deg,transparent 0%,#ffe600 15%,#fff 50%,#ffe600 85%,transparent 100%)",
                    boxShadow: "0 0 16px 2px rgba(255,230,0,0.6)",
                  }}
                />
              </motion.div>

              {/* ── Center seam flash ── */}
              <motion.div
                className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2"
                style={{
                  background:
                    "linear-gradient(180deg,transparent 0%,#ffe600 15%,#fff 50%,#ffe600 85%,transparent 100%)",
                  boxShadow: "0 0 30px 6px rgba(255,230,0,0.7)",
                }}
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: [0, 1, 1, 0], scaleY: [0, 1, 1, 0] }}
                transition={{
                  duration: TD,
                  times: [0, 0.15, 0.22, 0.28],
                  ease: "easeOut",
                }}
              />

              {/* ── White flash on unlock ── */}
              <motion.div
                className="absolute inset-0 bg-white"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 0.55, 0] }}
                transition={{
                  duration: TD,
                  times: [0, 0.28, 0.29, 0.34],
                  ease: "easeOut",
                }}
              />

              {/* ── Lock badge (appears, shakes, unlocks, fades) ── */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="relative flex items-center justify-center"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: [0, 1, 1, 1.4, 0, 0],
                    opacity: [0, 1, 1, 1, 0, 0],
                  }}
                  transition={{
                    duration: TD,
                    times: [0, 0.15, 0.2, 0.29, 0.37, 1],
                    ease: POP,
                  }}
                >
                  {/* Pulsing glow behind lock */}
                  <motion.div
                    className="absolute rounded-full"
                    style={{
                      width: 140,
                      height: 140,
                      background:
                        "radial-gradient(circle,rgba(255,230,0,0.4) 0%,rgba(230,0,158,0.2) 40%,rgba(230,0,158,0) 70%)",
                    }}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Expanding rings on unlock — staggered cascade */}
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={`ring-${i}`}
                      className="absolute rounded-full border-2"
                      style={{
                        width: 72,
                        height: 72,
                        borderColor: i % 2 === 0 ? "#ffe600" : "#fff",
                      }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 2.5 + i * 0.5], opacity: [0, 0.8, 0] }}
                      transition={{
                        duration: 0.5,
                        delay: 0.29 * TD + i * 0.04,
                        ease: "easeOut",
                      }}
                    />
                  ))}

                  {/* Lock circle — 3D tactile style matching app buttons */}
                  <motion.div
                    className="relative flex items-center justify-center rounded-full border-2 border-white/30"
                    style={{
                      width: 72,
                      height: 72,
                      background: "linear-gradient(135deg,#e6009e,#b8007e)",
                      boxShadow:
                        "0 6px 0 #8c0060, 0 0 40px rgba(230,0,158,0.6), inset 0 2px 8px rgba(255,255,255,0.25)",
                    }}
                    animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
                    transition={{
                      duration: 0.25,
                      delay: 0.17 * TD,
                      repeat: 1,
                      ease: "easeInOut",
                    }}
                  >
                    {/* Closed lock → Open lock swap at unlock moment */}
                    <motion.div
                      className="absolute flex items-center justify-center"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: [1, 1, 1, 0, 0] }}
                      transition={{
                        duration: TD,
                        times: [0, 0.22, 0.27, 0.29, 1],
                        ease: "easeOut",
                      }}
                    >
                      <Lock size={30} weight="fill" className="text-white" />
                    </motion.div>
                    <motion.div
                      className="absolute flex items-center justify-center"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0, 0, 1, 1, 0] }}
                      transition={{
                        duration: TD,
                        times: [0, 0.22, 0.27, 0.29, 0.35, 0.37],
                        ease: "easeOut",
                      }}
                    >
                      <LockOpen size={30} weight="fill" className="text-white" />
                    </motion.div>
                  </motion.div>

                  {/* Spark particles on unlock */}
                  {Array.from({ length: 14 }).map((_, i) => {
                    const angle = (i / 14) * Math.PI * 2;
                    const distance = 60 + (i % 4) * 18;
                    return (
                      <motion.div
                        key={`spark-${i}`}
                        className="absolute rounded-full"
                        style={{
                          width: 6,
                          height: 6,
                          backgroundColor:
                            i % 3 === 0 ? "#ffe600" : i % 3 === 1 ? "#fff" : "#e6009e",
                        }}
                        initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                        animate={{
                          x: Math.cos(angle) * distance,
                          y: Math.sin(angle) * distance,
                          opacity: [0, 1, 0],
                          scale: [0, 1.4, 0],
                        }}
                        transition={{
                          duration: 0.5,
                          delay: 0.29 * TD,
                          ease: "easeOut",
                        }}
                      />
                    );
                  })}
                </motion.div>
              </div>

              {/* ── "ACCESS GRANTED" stamp ── */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                {/* Radiating sunburst rays behind stamp */}
                <motion.div
                  className="absolute rounded-full"
                  style={{
                    width: 320,
                    height: 320,
                    background:
                      "repeating-conic-gradient(transparent 0deg, transparent 14deg, rgba(255,230,0,0.25) 14deg, rgba(255,230,0,0.25) 16deg)",
                  }}
                  initial={{ scale: 0, opacity: 0, rotate: 0 }}
                  animate={{
                    scale: [0, 1.2, 1, 1, 0],
                    opacity: [0, 0.7, 0.5, 0.5, 0],
                    rotate: [0, 30, 45, 45, 60],
                  }}
                  transition={{
                    duration: TD,
                    times: [0, 0.35, 0.4, 0.93, 0.98],
                    ease: "easeOut",
                  }}
                />

                {/* Stamp group — "pressed down" animation */}
                <motion.div
                  className="relative flex flex-col items-center gap-3"
                  initial={{ scale: 0, opacity: 0, rotate: -8 }}
                  animate={{
                    scale: [0, 1.5, 1, 1, 1, 0],
                    opacity: [0, 1, 1, 1, 1, 0],
                    rotate: [-8, -6, -3, -3, -3, -3],
                  }}
                  transition={{
                    duration: TD,
                    times: [0, 0.35, 0.39, 0.45, 0.93, 0.98],
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                >
                  {/* SealCheck badge above text */}
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white"
                    style={{
                      background: "linear-gradient(135deg,#e6009e,#b8007e)",
                      boxShadow: "0 4px 0 #8c0060, 0 0 20px rgba(230,0,158,0.5)",
                    }}
                  >
                    <SealCheck size={26} weight="fill" className="text-white" />
                  </div>

                  {/* ACCESS GRANTED — sticker-heading style */}
                  <h2
                    className="sticker-heading text-[clamp(1.4rem,7vw,2.2rem)] tracking-[0.12em] whitespace-nowrap"
                    style={{ textShadow: "3px 4px 0 rgba(20,20,20,0.95)" }}
                  >
                    ACCESS GRANTED
                  </h2>

                  {/* Sub-label */}
                  <p
                    className="font-display font-semibold text-white text-[clamp(0.7rem,3vw,0.9rem)] tracking-[0.25em] uppercase"
                    style={{ textShadow: "1px 2px 0 rgba(20,20,20,0.8)" }}
                  >
                    Welcome to MurkyCorps
                  </p>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

export default InviteScreen;
