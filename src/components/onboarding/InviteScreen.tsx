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
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { ParticleField } from "@/components/onboarding/ParticleField";
import { useOnboardingStore } from "@/stores/onboardingStore";

/**
 * InviteScreen — the entry gate at `/`.
 *
 * Redesigned for best-practice UX:
 *  - Input phase: auto-formatted code input (XXXXX-0000-XXX), live progress
 *    fill bar, contextual format hint, and clear error recovery
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

type Phase = "input" | "welcome";

/* ============================================================================
   Helpers
   ========================================================================== */

const isTest =
  typeof process !== "undefined" && process.env.NODE_ENV === "test";
const EXIT_DELAY = isTest ? 0 : 550;
const SMOOTH = [0.22, 0.61, 0.36, 1] as const;
const POP = [0.34, 1.56, 0.64, 1] as const;
const GENTLE_POP = [0.34, 1.16, 0.64, 1] as const;

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
    setPhase("welcome");
    advanceToSurvey();

    if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
    welcomeTimerRef.current = setTimeout(
      () => {
        setIsExiting(true);
        setTimeout(() => {
          router.push("/survey");
        }, EXIT_DELAY);
      },
      isTest ? 0 : 6650
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
    setIsExiting(true);
    setTimeout(() => {
      router.push("/survey");
    }, EXIT_DELAY);
  }, [isExiting, router]);

  /* ============================================================================
     Render
     ========================================================================== */

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-white flex flex-col">
      {/* Atmospheric background */}
      <motion.div
        initial={{ opacity: 0.72, scale: 1.03 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: SMOOTH }}
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(115% 88% at 8% -12%, rgba(230,0,158,0.15) 0%, rgba(230,0,158,0.05) 36%, rgba(230,0,158,0) 72%), radial-gradient(98% 80% at 95% 4%, rgba(79,209,197,0.14) 0%, rgba(79,209,197,0.04) 42%, rgba(79,209,197,0) 74%), linear-gradient(180deg,#fffaff 0%,#ffffff 62%,#f9fcff 100%)",
        }}
      />

      {/* Page exit fade */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={isExiting ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: SMOOTH }}
        className="relative z-10 flex flex-col flex-1 w-full max-w-sm sm:max-w-md md:max-w-lg mx-auto px-4 sm:px-5 md:px-6 pt-4 sm:pt-5 pb-6 sm:pb-8"
      >
        {/* Top bar */}
        <div className="flex justify-end mb-2 sm:mb-1">
          <Logo size={36} />
        </div>
        <div className="h-px bg-[#141414]/10 mb-4" />

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
              className="rounded-[1.65rem] border border-[#141414]/10 bg-white/84 backdrop-blur-[2px] p-4 sm:p-5 md:p-6 shadow-[0_12px_30px_rgba(20,20,20,0.08)] flex flex-col gap-4 sm:gap-5"
            >
              {/* Eyebrow */}
              <div className="flex items-center gap-1.5">
                <Star size={14} weight="fill" className="text-[#e6009e]" />
                <span className="text-sm font-medium text-[#141414]">
                  Invite Only · Members Exclusive
                </span>
              </div>

              {/* Hero illustration */}
              <div
                className="relative w-full rounded-2xl overflow-hidden border border-[#141414]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                style={{
                  aspectRatio: "16/10",
                  background:
                    "radial-gradient(112% 100% at 8% -8%, rgba(230,0,158,0.18) 0%, rgba(230,0,158,0.06) 42%, rgba(230,0,158,0) 74%), radial-gradient(100% 86% at 96% 6%, rgba(79,209,197,0.16) 0%, rgba(79,209,197,0.06) 42%, rgba(79,209,197,0) 76%), linear-gradient(180deg,#fff9fe 0%,#fff 68%,#f6fbff 100%)",
                }}
              >
                {!heroError ? (
                  <img
                    src="/assets/figma/Start/MurkeyMall.png"
                    alt="MurkyCorps Mall"
                    className="w-full h-full object-contain p-2 sm:p-3"
                    style={{ objectPosition: "center center" }}
                    onError={() => setHeroError(true)}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg,#ffeefa 0%,#ffe600 50%,#d0f0c0 100%)",
                    }}
                  >
                    <span
                      className="font-display font-bold text-[#141414] opacity-30"
                      style={{ fontSize: 32 }}
                    >
                      Murky Mall
                    </span>
                  </div>
                )}
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
                            src="/assets/figma/Invatation/Not_found/Sad.png"
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
          ) : (
            /* ================================================================
               WELCOME / CELEBRATION PHASE
               ================================================================ */
            <motion.div
              key="welcome-phase"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: SMOOTH }}
              className="rounded-[1.8rem] border border-[#141414]/10 bg-white/86 backdrop-blur-[2px] shadow-[0_14px_34px_rgba(20,20,20,0.08)] flex flex-col items-center justify-between flex-1 text-center overflow-hidden relative"
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
                      src="/assets/figma/Invatation verefied/happy.character.png"
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
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

export default InviteScreen;
