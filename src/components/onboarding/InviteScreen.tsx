"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkle,
  ArrowRight,
  Key,
  WarningCircle,
  SealCheck,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { ParticleField } from "./ParticleField";

/**
 * InviteScreen — the entry gate at `/`.
 *
 * Features:
 *  - Invite code input with validation (empty + invalid code error states)
 *  - "You've been chosen" welcome animation with particle effects + social proof
 *  - ENTER MALL button (triggers welcome animation then navigates to /survey)
 *  - Exclusivity / scarcity messaging
 *  - Mystic premium aesthetic (glassmorphism, double-bezel, gold accents)
 *  - Single forward flow — no back navigation
 *  - Idempotent submission (rapid double-click safe)
 */

/* ============================================================================
   Valid invite codes (mocked — any code matching the format is accepted)
   ========================================================================== */

const VALID_CODE_PATTERN = /^[A-Z]{5}-\d{4}-[A-Z]{3}$/;

/** Social proof data for the welcome animation. */
const SOCIAL_PROOF = {
  inviterName: "Sarah",
  inviterTier: "Gold member",
  memberCount: "1,247",
};

/* ============================================================================
   Animation phases
   ========================================================================== */

type Phase = "input" | "welcome";

/* ============================================================================
   Component
   ========================================================================== */

export function InviteScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("input");
  const [submitting, setSubmitting] = useState(false);
  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* --- Validation --- */

  const validateCode = useCallback((raw: string): string | null => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return "Enter your invite code to continue";
    }
    const normalized = trimmed.toUpperCase();
    if (!VALID_CODE_PATTERN.test(normalized)) {
      return "That code isn't recognized. Check and try again";
    }
    return null;
  }, []);

  /* --- Submit handler (idempotent) --- */

  const handleSubmit = useCallback(() => {
    if (submitting) return; // guard against rapid double-submission

    const validationError = validateCode(code);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);
    setPhase("welcome");

    // Auto-advance to survey after the welcome animation completes.
    if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
    welcomeTimerRef.current = setTimeout(() => {
      router.push("/survey");
    }, 3200);
  }, [code, submitting, validateCode, router]);

  /* --- Input change handler --- */

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const upper = e.target.value.toUpperCase();
      setCode(upper);
      if (error) setError(null); // clear error on retype
    },
    [error]
  );

  /* --- Allow Enter key to submit --- */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  /* --- Skip animation on tap (during welcome phase) --- */

  const skipAnimation = useCallback(() => {
    if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
    router.push("/survey");
  }, [router]);

  /* ============================================================================
     Render
     ========================================================================== */

  return (
    <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16">
      <AnimatePresence mode="wait">
        {phase === "input" ? (
          <motion.div
            key="input-phase"
            initial={{ opacity: 0, y: 48, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -32, filter: "blur(8px)" }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            className="w-full max-w-md"
          >
            {/* Eyebrow — exclusivity tag */}
            <div className="mb-8 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium text-[#a1a1aa] ring-1 ring-white/10">
                <Sparkle size={12} weight="light" className="text-[#d4af37]" />
                Invite Only · Members Exclusive
              </span>
            </div>

            {/* Double-bezel card */}
            <div className="bezel-card glow-gold">
              <div className="bezel-card-inner flex flex-col items-center text-center">
                <h1 className="text-gradient-gold text-4xl font-bold tracking-tight sm:text-5xl">
                  You&rsquo;ve Been Chosen
                </h1>
                <p className="mt-4 text-sm leading-relaxed text-[#a1a1aa]">
                  An exclusive invitation to the MurkyCorps Mall. Enter your
                  invite code below to unlock a world of rare finds and hidden
                  rewards.
                </p>

                {/* Social proof teaser */}
                <div className="mt-6 flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs text-[#a1a1aa] ring-1 ring-white/10">
                  <SealCheck
                    size={14}
                    weight="light"
                    className="text-[#d4af37]"
                  />
                  Invited by {SOCIAL_PROOF.inviterName},{" "}
                  {SOCIAL_PROOF.inviterTier}
                </div>

                {/* Input + button group */}
                <div className="mt-8 w-full">
                  <label
                    htmlFor="invite-code"
                    className="mb-2 block text-left text-[10px] uppercase tracking-[0.2em] font-medium text-[#71717a]"
                  >
                    Invite Code
                  </label>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3.5 ring-1 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
                      error
                        ? "ring-[#ef4444]/60"
                        : "ring-white/10 focus-within:ring-[#d4af37]/40"
                    )}
                  >
                    <Key
                      size={20}
                      weight="light"
                      className="shrink-0 text-[#d4af37]"
                    />
                    <input
                      id="invite-code"
                      type="text"
                      value={code}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      placeholder="XXXX-XXXX-XXX"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Invite code"
                      aria-invalid={error ? true : undefined}
                      className="w-full bg-transparent text-sm font-mono tracking-wider text-[#f5f5f7] placeholder:text-[#71717a] focus:outline-none"
                    />
                  </div>

                  {/* Error message */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{
                          duration: 0.4,
                          ease: [0.32, 0.72, 0, 1],
                        }}
                        className="mt-3 flex items-center gap-2 text-left text-xs text-[#ef4444]"
                        role="alert"
                      >
                        <WarningCircle size={14} weight="light" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ENTER MALL button */}
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="group mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#d4af37] to-[#b8941f] px-6 py-3.5 text-sm font-semibold text-black shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_0_28px_rgba(212,175,55,0.25)] active:scale-[0.98] disabled:pointer-events-none"
                  >
                    <span>ENTER MALL</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1">
                      <ArrowRight size={14} weight="light" />
                    </span>
                  </button>
                </div>

                {/* Scarcity footer */}
                <p className="mt-6 text-[10px] uppercase tracking-[0.15em] text-[#71717a]">
                  {SOCIAL_PROOF.memberCount} members · Limited spots remaining
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          /* --- Welcome animation phase --- */
          <motion.div
            key="welcome-phase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            className="relative flex min-h-[60dvh] w-full max-w-lg flex-col items-center justify-center text-center"
            onClick={skipAnimation}
          >
            {/* Particle effects */}
            <ParticleField count={32} />

            {/* Pulsing glow ring */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 1.2,
                ease: [0.32, 0.72, 0, 1],
              }}
              className="relative mb-8 flex h-24 w-24 items-center justify-center"
            >
              <div className="absolute inset-0 rounded-full bg-[#d4af37]/20 blur-2xl" />
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: [0.8, 1.1, 1] }}
                transition={{
                  duration: 1.5,
                  ease: [0.32, 0.72, 0, 1],
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8941f] shadow-[0_0_24px_rgba(212,175,55,0.4)]"
              >
                <Sparkle size={32} weight="light" className="text-black" />
              </motion.div>
            </motion.div>

            {/* Headline — staggered reveal */}
            <motion.h1
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.9,
                delay: 0.3,
                ease: [0.32, 0.72, 0, 1],
              }}
              className="text-gradient-gold text-4xl font-bold tracking-tight sm:text-5xl"
            >
              You&rsquo;ve Been Chosen
            </motion.h1>

            {/* Social proof — staggered */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.7,
                ease: [0.32, 0.72, 0, 1],
              }}
              className="mt-4 text-base text-[#f5f5f7]"
            >
              Invited by {SOCIAL_PROOF.inviterName},{" "}
              <span className="text-[#d4af37]">
                {SOCIAL_PROOF.inviterTier}
              </span>
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 1.0,
                ease: [0.32, 0.72, 0, 1],
              }}
              className="mt-2 text-sm text-[#a1a1aa]"
            >
              Your private mall experience awaits
            </motion.p>

            {/* Tap to continue hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0] }}
              transition={{
                duration: 2,
                delay: 1.8,
                repeat: Infinity,
                ease: [0.32, 0.72, 0, 1],
              }}
              className="mt-10 text-[10px] uppercase tracking-[0.2em] text-[#71717a]"
            >
              Tap to continue
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default InviteScreen;
