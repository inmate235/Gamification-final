"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
} from "@phosphor-icons/react";
import type { IconWeight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  SURVEY_QUESTIONS,
  type SurveyOption,
} from "@/lib/bartle";
import { classifyBartleType } from "@/lib/bartle";
import { usePlayerStore } from "@/stores/playerStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { ParticleField } from "./ParticleField";

/**
 * SurveyScreen — the style profile survey at `/survey`.
 *
 * Features:
 *  - 3 questions (style preference w/ image cards, social/solo, deals/discovery)
 *  - Auto-advance on selection (no explicit "Next" button)
 *  - Visual selection feedback (gold ring + check)
 *  - Progress dots
 *  - Answers stored in playerStore.surveyAnswers
 *  - Bartle type classified covertly (hidden from user) on completion
 *  - Navigates to /mall after final question
 *  - Single forward flow — no back navigation
 *  - Idempotent selection (rapid clicks safe)
 */

const AUTO_ADVANCE_DELAY = 650; // ms — visual feedback before advancing

/* ============================================================================
   Phosphor icon map (avoid dynamic imports in ssr)
   ========================================================================== */

import {
  Lightning,
  Diamond,
  Sparkle,
  Heart,
  Users,
  User,
  Tag,
  Compass,
} from "@phosphor-icons/react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; weight?: IconWeight; className?: string }>> = {
  Lightning,
  Diamond,
  Sparkle,
  Heart,
  Users,
  User,
  Tag,
  Compass,
};

/* ============================================================================
   Stagger variants
   ========================================================================== */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    x: -32,
    filter: "blur(8px)",
    transition: { duration: 0.45, ease: [0.32, 0.72, 0, 1] },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: [0.32, 0.72, 0, 1] },
  },
};

/* ============================================================================
   Component
   ========================================================================== */

const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
const EXIT_DELAY = isTest ? 0 : 550;

export function SurveyScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatedRef = useRef(false);

  const setSurveyAnswers = usePlayerStore((s) => s.setSurveyAnswers);
  const setBartleType = usePlayerStore((s) => s.setBartleType);
  const grantOnboardingTrialPerks = usePlayerStore((s) => s.grantOnboardingTrialPerks);
  const advanceToMall = useOnboardingStore((s) => s.advanceToMall);

  const totalQuestions = SURVEY_QUESTIONS.length;
  const currentQuestion = SURVEY_QUESTIONS[currentIndex];
  const isLastQuestion = currentIndex === totalQuestions - 1;

  /* --- Clean up timers on unmount --- */
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  /* --- Handle option selection (idempotent) --- */
  const handleSelect = useCallback(
    (option: SurveyOption) => {
      if (isAdvancing) return; // guard against rapid double-click

      setSelectedOption(option.id);
      setIsAdvancing(true);

      const newAnswers = {
        ...answers,
        [currentQuestion.id]: option.id,
      };
      setAnswers(newAnswers);

      // Advance after a short visual-feedback delay.
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        if (isLastQuestion) {
          // Classify Bartle type (covert) + persist answers, then navigate.
          const bartleType = classifyBartleType(newAnswers);
          setSurveyAnswers(newAnswers);
          if (bartleType) setBartleType(bartleType);

          // Grant endowment-effect trial perks at the end of onboarding so the
          // user starts /mall with higher-tier perks that will later expire
          // (VAL-TIER-013, VAL-TIER-014). Idempotent on repeated calls.
          grantOnboardingTrialPerks();

          // Mark onboarding complete so the /mall route guard allows entry.
          advanceToMall();

          if (!navigatedRef.current) {
            navigatedRef.current = true;
            setIsExiting(true);
            setTimeout(() => {
              router.push("/mall");
            }, EXIT_DELAY);
          }
        } else {
          setCurrentIndex((prev) => prev + 1);
          setSelectedOption(null);
          setIsAdvancing(false);
        }
      }, AUTO_ADVANCE_DELAY);
    },
    [
      answers,
      currentQuestion,
      isAdvancing,
      isLastQuestion,
      router,
      setBartleType,
      setSurveyAnswers,
      grantOnboardingTrialPerks,
      advanceToMall,
    ]
  );

  /* ============================================================================
     Render
     ========================================================================== */

  return (
    <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16 overflow-hidden">
      {/* Background themed Particle Field */}
      <ParticleField
        count={24}
        color={["#d4af37", "#9d7fdb", "#4fd1c5"]}
        className="absolute inset-0 z-0"
      />

      <motion.div
        initial={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
        animate={isExiting ? { opacity: 0, filter: "blur(12px)", scale: 0.96 } : { opacity: 1, filter: "blur(0px)", scale: 1 }}
        transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-2xl z-10 flex flex-col justify-center"
      >
        {/* Eyebrow */}
        <div className="mb-8 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium text-[#a1a1aa] ring-1 ring-white/10">
            <Sparkle size={12} weight="light" className="text-[#d4af37]" />
            Style Profile
          </span>
        </div>

        {/* Progress dots with layout transition */}
        <div className="mb-10 flex items-center justify-center gap-2.5">
          {SURVEY_QUESTIONS.map((q, i) => {
            const isActive = i === currentIndex;
            const isCompleted = i < currentIndex;
            return (
              <motion.div
                key={q.id}
                layout
                transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  "h-2 rounded-full",
                  isActive && "w-8 bg-[#d4af37] glow-gold",
                  isCompleted && "w-2 bg-[#d4af37]",
                  !isActive && !isCompleted && "w-2 bg-white/15"
                )}
                aria-label={`Question ${i + 1}${
                  isCompleted ? " (answered)" : ""
                }`}
              />
            );
          })}
        </div>

        {/* Question card — double bezel */}
        <div className="bezel-card">
          <div className="bezel-card-inner">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* Subtitle */}
                {currentQuestion.subtitle && (
                  <motion.p
                    variants={itemVariants}
                    className="mb-2 text-center text-xs uppercase tracking-[0.15em] text-[#71717a]"
                  >
                    {currentQuestion.subtitle}
                  </motion.p>
                )}

                {/* Prompt */}
                <motion.h2
                  variants={itemVariants}
                  className="mb-8 text-center text-2xl font-bold tracking-tight text-[#f5f5f7] sm:text-3xl"
                >
                  {currentQuestion.prompt}
                </motion.h2>

                {/* Options grid */}
                <motion.div
                  variants={itemVariants}
                  className={cn(
                    "grid gap-3",
                    currentQuestion.options.length > 2
                      ? "grid-cols-2"
                      : "grid-cols-1 sm:grid-cols-2"
                  )}
                >
                  {currentQuestion.options.map((option) => {
                    const isSelected = selectedOption === option.id;
                    const IconComponent = option.icon
                      ? ICON_MAP[option.icon]
                      : null;
                    return (
                      <motion.button
                        key={option.id}
                        onClick={() => handleSelect(option)}
                        whileTap={{ scale: 0.97 }}
                        disabled={isAdvancing}
                        animate={
                          selectedOption === null
                            ? { opacity: 1, scale: 1 }
                            : isSelected
                            ? { opacity: 1, scale: 1.02 }
                            : { opacity: 0.35, scale: 0.97 }
                        }
                        transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                        className={cn(
                          "group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl p-5 text-center ring-1 active:scale-[0.98] cursor-pointer",
                          isSelected
                            ? "bg-[#d4af37]/10 ring-[#d4af37]/60 glow-gold"
                            : "bg-white/5 ring-white/10 hover:bg-white/8 hover:ring-white/20"
                        )}
                        aria-pressed={isSelected}
                      >
                        {/* Image gradient backdrop (for style question) */}
                        {option.imageGradient && (
                          <div
                            className="absolute inset-0 opacity-30 transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:opacity-40"
                            style={{
                              background: option.imageGradient,
                            }}
                          />
                        )}

                        {/* Icon */}
                        {IconComponent && (
                          <div
                            className={cn(
                              "relative z-10 flex h-12 w-12 items-center justify-center rounded-full ring-1 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
                              isSelected
                                ? "bg-[#d4af37]/20 ring-[#d4af37]/60"
                                : "bg-white/5 ring-white/10"
                            )}
                          >
                            <IconComponent
                              size={22}
                              weight="light"
                              className={
                                isSelected
                                  ? "text-[#d4af37]"
                                  : "text-[#a1a1aa]"
                              }
                            />
                          </div>
                        )}

                        {/* Label */}
                        <span
                          className={cn(
                            "relative z-10 text-sm font-medium transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
                            isSelected
                              ? "text-[#d4af37]"
                              : "text-[#f5f5f7]"
                          )}
                        >
                          {option.label}
                        </span>

                        {/* Selected check indicator */}
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0, rotate: -45, opacity: 0 }}
                              animate={{ scale: 1, rotate: 0, opacity: 1 }}
                              exit={{ scale: 0, rotate: 45, opacity: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 450,
                                damping: 18,
                              }}
                              className="absolute right-3 top-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-[#d4af37]"
                            >
                              <Check
                                size={14}
                                weight="bold"
                                className="text-black"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* No skip button — single forward flow */}
        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.15em] text-[#71717a]">
          Question {currentIndex + 1} of {totalQuestions}
        </p>
      </motion.div>
    </main>
  );
}

export default SurveyScreen;
