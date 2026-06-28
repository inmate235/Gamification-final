"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ArrowRight, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { useOnboardingStore } from "@/stores/onboardingStore";

/**
 * InviteScreen — the entry gate at `/`.
 *
 * Faithful to the Figma "Gamification" invite frame: white background,
 * black "Murky" pill logo, magenta star eyebrow, 3D mall illustration hero,
 * chunky black-outlined sticker headline, magenta-bordered code input and a
 * solid magenta "Enter Mall" button.
 *
 * Behaviour preserved from the original:
 *  - Invite code validation (empty + invalid format error states)
 *  - "You've been chosen" welcome phase with tap-to-continue
 *  - Single forward flow, idempotent submission, Enter-key support
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

const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
const EXIT_DELAY = isTest ? 0 : 550;

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
      setShakeTrigger((prev) => prev + 1);
      return;
    }

    setError(null);
    setSubmitting(true);
    setPhase("welcome");

    // Mark invite code validated so the /survey route guard allows entry.
    advanceToSurvey();

    // Auto-advance to survey after the welcome animation completes.
    if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
    welcomeTimerRef.current = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        router.push("/survey");
      }, EXIT_DELAY);
    }, isTest ? 0 : 6650); // In test, bypass delay. In app, 6650ms showing + 550ms exit fade
  }, [code, submitting, validateCode, router, advanceToSurvey]);

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

  const POP = [0.34, 1.56, 0.64, 1] as const;

  return (
    <main className="min-h-[100dvh] bg-white flex flex-col">
      <motion.div
        initial={{ opacity: 1 }}
        animate={isExiting ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
        className="flex flex-col flex-1 w-full max-w-sm mx-auto px-5 pt-5 pb-8"
      >
        {/* Top bar: right-aligned "Murky" pill logo */}
        <div className="flex justify-end mb-1">
          <Logo size={38} />
        </div>

        {/* Thin divider */}
        <div className="h-px bg-[#141414]/10 mb-4" />

        <AnimatePresence mode="wait">
          {phase === "input" ? (
            <motion.div
              key="input-phase"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col gap-4"
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
                className="relative w-full rounded-2xl overflow-hidden bg-[#f5f5f5]"
                style={{ aspectRatio: "16/10" }}
              >
                {!heroError ? (
                  <img
                    src="/assets/figma/invite-hero.png"
                    alt="MurkyCorps Mall"
                    className="w-full h-full object-cover"
                    onError={() => setHeroError(true)}
                  />
                ) : (
                  /* Gradient fallback until real asset is provided */
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

              {/* Sticker headline */}
              <h1
                className="sticker-heading text-[2.6rem] leading-none"
              >
                You&rsquo;ve been<br />chosen
              </h1>

              {/* Social proof pill */}
              <div className="flex">
                <span className="pill-outline text-[13px]">
                  <SealCheck size={14} weight="fill" className="text-[#e6009e]" />
                  Invited by {SOCIAL_PROOF.inviterName} · {SOCIAL_PROOF.inviterTier}
                </span>
              </div>

              {/* Body copy */}
              <p className="text-sm leading-relaxed text-[#4b4b4b] max-w-[38ch]">
                AN Exclusive Invitation to the MurkyCorps Mall. Enter your
                Invitation code below to unlock a world of rare finds and
                hidden rewards.
              </p>

              {/* Input + button group */}
              <div className="flex flex-col gap-3 mt-1">
                <div>
                  <label htmlFor="invite-code" className="sr-only">
                    Invite code
                  </label>
                  <motion.div
                    animate={
                      shakeTrigger > 0
                        ? { x: [0, -8, 7, -6, 5, -3, 2, 0] }
                        : { x: 0 }
                    }
                    transition={{ duration: 0.45, ease: "easeInOut" }}
                    onAnimationComplete={() => setShakeTrigger(0)}
                  >
                    <input
                      id="invite-code"
                      type="text"
                      value={code}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      placeholder="xxxx-xxxx-xxxx"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Invite code"
                      aria-invalid={error ? true : undefined}
                      className={cn(
                        "input-pill",
                        error && "border-[#ef4444] shadow-[0_0_0_4px_rgba(239,68,68,0.16)]"
                      )}
                    />
                  </motion.div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.3 }}
                        className="mt-2 text-center text-xs text-[#ef4444]"
                        role="alert"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Enter Mall button */}
                <motion.button
                  onClick={handleSubmit}
                  disabled={submitting}
                  whileTap={{ scale: 0.97 }}
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
            /* Welcome phase */
            <motion.div
              key="welcome-phase"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: POP }}
              className="flex flex-col items-center justify-center flex-1 text-center gap-6 cursor-pointer pt-8"
              onClick={skipAnimation}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.7, ease: POP }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e6009e]"
              >
                <SealCheck size={40} weight="bold" className="text-white" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25, ease: POP }}
              >
                <h1 className="sticker-heading text-[2.8rem]">
                  You&rsquo;re in!
                </h1>
                <p className="mt-3 text-sm text-[#4b4b4b]">
                  Invited by {SOCIAL_PROOF.inviterName} ·{" "}
                  <span className="font-semibold text-[#e6009e]">
                    {SOCIAL_PROOF.inviterTier}
                  </span>
                </p>
                <p className="mt-1 text-sm text-[#8a8a8a]">
                  Your private mall experience awaits
                </p>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 2, delay: 1.6, repeat: Infinity }}
                className="text-[11px] uppercase tracking-widest text-[#8a8a8a]"
              >
                Tap to continue
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

export default InviteScreen;
