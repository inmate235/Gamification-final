"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
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
import { Logo } from "@/components/ui/Logo";

/**
 * SurveyScreen — the style profile survey at `/survey`.
 *
 * Features:
 *  - Hero image cards for each option (Figma-inspired, with gradient fallback)
 *  - 3 questions (style preference w/ image cards, social/solo, deals/discovery)
 *  - Auto-advance on selection (no explicit "Next" button)
 *  - Visual selection feedback (gold ring + check + image zoom)
 *  - Progress dots (top) + progress bar (bottom)
 *  - Figma subtitle: "Answer three quick questions..."
 *  - Staggered image card reveal animations
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

const containerVariants: Variants = {
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

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: [0.32, 0.72, 0, 1] },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.95, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.32, 0.72, 0, 1] },
  },
};

/* ============================================================================
   Component
   ========================================================================== */

const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
const EXIT_DELAY = isTest ? 0 : 550;

/** Figma subtitle shown at the top of the survey (text node 3:173). */
const SURVEY_SUBTITLE =
  "Answer three quick questions so MurkyCorps can personalize your mall experience.";

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
  const progressPercent = ((currentIndex + 1) / totalQuestions) * 100;

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
    <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Logo — top right */}
      <div className="fixed right-5 top-5 z-30 sm:right-6 sm:top-6">
        <Logo size={36} />
      </div>

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
        {/* Figma subtitle — page-level description (text node 3:173) */}
        <motion.p
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          className="mb-6 text-center text-xs leading-relaxed text-[#71717a] max-w-[45ch] mx-auto"
        >
          {SURVEY_SUBTITLE}
        </motion.p>

        {/* Progress dots with layout transition (kept for test compatibility) */}
        <div className="mb-8 flex items-center justify-center gap-2.5">
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

        {/* Question content — no double bezel card, images are the focus */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Per-question subtitle */}
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

            {/* Options — image card grid */}
            <motion.div
              variants={itemVariants}
              className={cn(
                "grid gap-3",
                currentQuestion.options.length > 2
                  ? "grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2"
              )}
            >
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedOption === option.id;
                const IconComponent = option.icon
                  ? ICON_MAP[option.icon]
                  : null;
                return (
                  <motion.button
                    key={option.id}
                    variants={cardVariants}
                    onClick={() => handleSelect(option)}
                    whileTap={{ scale: 0.97 }}
                    disabled={isAdvancing}
                    animate={
                      selectedOption === null
                        ? { opacity: 1, scale: 1 }
                        : isSelected
                        ? { opacity: 1, scale: 1.03 }
                        : { opacity: 0.3, scale: 0.97 }
                    }
                    transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                    className={cn(
                      "image-card group relative flex flex-col items-center justify-end overflow-hidden p-0 text-left active:scale-[0.98] cursor-pointer",
                      isSelected && "image-card-selected"
                    )}
                    style={{
                      minHeight: currentQuestion.options.length > 2 ? 140 : 180,
                      transitionDelay: `${index * 60}ms`,
                    }}
                    aria-pressed={isSelected}
                  >
                    {/* Image background (from Figma asset or gradient fallback) */}
                    {option.imageUrl ? (
                      <img
                        src={option.imageUrl}
                        alt={option.label}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                        style={isSelected ? { transform: "scale(1.08)" } : undefined}
                        onError={(e) => {
                          // Fallback to gradient if image not yet downloaded
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : null}

                    {/* Gradient backdrop (always present as base or fallback) */}
                    {option.imageGradient && (
                      <div
                        className="absolute inset-0 transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                        style={{
                          background: option.imageGradient,
                          opacity: option.imageUrl ? 0.3 : 0.5,
                        }}
                      />
                    )}

                    {/* Dark scrim at bottom for label readability */}
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                    {/* Icon — top left */}
                    {IconComponent && (
                      <div
                        className={cn(
                          "absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full ring-1 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
                          isSelected
                            ? "bg-[#d4af37]/25 ring-[#d4af37]/60"
                            : "bg-black/30 ring-white/20 backdrop-blur-sm"
                        )}
                      >
                        <IconComponent
                          size={16}
                          weight="light"
                          className={
                            isSelected
                              ? "text-[#d4af37]"
                              : "text-white/80"
                          }
                        />
                      </div>
                    )}

                    {/* Label — bottom overlay */}
                    <span
                      className={cn(
                        "relative z-10 px-4 py-3 text-sm font-medium transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] w-full",
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

        {/* Progress bar — bottom (Figma Rectangle 3 + Rectangle 7) */}
        <div className="mt-8 flex items-center justify-center">
          <div className="progress-track w-full max-w-[280px]">
            <motion.div
              className="progress-fill"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            />
          </div>
        </div>

        {/* Question counter */}
        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.15em] text-[#71717a]">
          Question {currentIndex + 1} of {totalQuestions}
        </p>
      </motion.div>
    </main>
  );
}

export default SurveyScreen;
