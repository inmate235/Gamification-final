"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Check } from "@phosphor-icons/react";
import type { IconWeight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SURVEY_QUESTIONS, type SurveyOption } from "@/lib/bartle";
import { classifyBartleType } from "@/lib/bartle";
import { usePlayerStore } from "@/stores/playerStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { Logo } from "@/components/ui/Logo";

/**
 * SurveyScreen — the style profile survey at `/survey`.
 *
 * Playful Figma direction: white background, black "Murky" pill, sticker
 * heading question prompt, image-card option grid (white cards, magenta
 * border on select, colorful gradient icon tiles) and a magenta pill progress
 * bar at the bottom.
 *
 * Behaviour preserved from the original:
 *  - 3 questions, auto-advance on selection (no explicit "Next" button)
 *  - Answers stored in playerStore.surveyAnswers
 *  - Bartle type classified covertly on completion (never shown in UI)
 *  - Navigates to /mall after the final question
 *  - Single forward flow, idempotent selection (rapid clicks safe)
 *  - Progress dots retained for test compatibility (aria-label "Question N")
 */

const AUTO_ADVANCE_DELAY = 650; // ms — visual feedback before advancing

/* ============================================================================
   Phosphor icon map (static imports — no dynamic imports in ssr)
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

const ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; weight?: IconWeight; className?: string }>
> = {
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
   Motion
   ========================================================================== */

const POP = [0.34, 1.56, 0.64, 1] as const;
const SMOOTH = [0.32, 0.72, 0, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
  exit: {
    opacity: 0,
    x: -28,
    transition: { duration: 0.4, ease: SMOOTH },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: SMOOTH } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.94 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: POP },
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
  const grantOnboardingTrialPerks = usePlayerStore(
    (s) => s.grantOnboardingTrialPerks
  );
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

      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        if (isLastQuestion) {
          const bartleType = classifyBartleType(newAnswers);
          setSurveyAnswers(newAnswers);
          if (bartleType) setBartleType(bartleType);

          grantOnboardingTrialPerks();
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
    <main className="min-h-[100dvh] bg-white flex flex-col">
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={
          isExiting ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }
        }
        transition={{ duration: 0.45, ease: SMOOTH }}
        className="flex flex-col flex-1 w-full max-w-sm mx-auto px-5 pt-5 pb-8"
      >
        {/* Top bar: right-aligned "Murky" pill logo */}
        <div className="flex justify-end mb-1">
          <Logo size={38} />
        </div>

        {/* Thin divider */}
        <div className="h-px bg-[#141414]/10 mb-4" />

        {/* Page subtitle (text node 3:173) */}
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: SMOOTH }}
          className="mb-5 text-center text-[13px] leading-relaxed text-[#4b4b4b] max-w-[34ch] mx-auto"
        >
          {SURVEY_SUBTITLE}
        </motion.p>

        {/* Progress dots (retained for test compatibility) */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {SURVEY_QUESTIONS.map((q, i) => {
            const isActive = i === currentIndex;
            const isCompleted = i < currentIndex;
            return (
              <motion.div
                key={q.id}
                layout
                transition={{ duration: 0.5, ease: POP }}
                className={cn(
                  "h-2.5 rounded-full transition-colors",
                  isActive && "w-8 bg-[#e6009e]",
                  isCompleted && "w-2.5 bg-[#e6009e]/45",
                  !isActive && !isCompleted && "w-2.5 bg-[#141414]/12"
                )}
                aria-label={`Question ${i + 1}${
                  isCompleted ? " (answered)" : ""
                }`}
              />
            );
          })}
        </div>

        {/* Question content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col"
          >
            {/* Per-question eyebrow */}
            {currentQuestion.subtitle && (
              <motion.p
                variants={itemVariants}
                className="mb-2 text-center text-xs font-medium uppercase tracking-[0.14em] text-[#e6009e]"
              >
                {currentQuestion.subtitle}
              </motion.p>
            )}

            {/* Prompt — sticker heading */}
            <motion.h2
              variants={itemVariants}
              className="mb-7 text-center sticker-heading text-[2rem] leading-[1.05]"
            >
              {currentQuestion.prompt}
            </motion.h2>

            {/* Options — image card grid */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
              {currentQuestion.options.map((option, index) => (
                <SurveyOptionCard
                  key={option.id}
                  option={option}
                  index={index}
                  isSelected={selectedOption === option.id}
                  hasSelection={selectedOption !== null}
                  disabled={isAdvancing}
                  onSelect={handleSelect}
                />
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Spacer pushes progress to the bottom on tall screens */}
        <div className="flex-1" />

        {/* Magenta pill progress bar */}
        <div className="mt-8 flex items-center justify-center">
          <div className="relative h-3 w-full max-w-[280px] overflow-hidden rounded-full bg-[#141414]/8">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-[#e6009e]"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.55, ease: SMOOTH }}
            />
          </div>
        </div>

        {/* Question counter */}
        <p className="mt-3 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a8a8a]">
          Question {currentIndex + 1} of {totalQuestions}
        </p>
      </motion.div>
    </main>
  );
}

export default SurveyScreen;

/* ============================================================================
   SurveyOptionCard — single option card with image hero + icon fallback
   ========================================================================== */

interface SurveyOptionCardProps {
  option: SurveyOption;
  index: number;
  isSelected: boolean;
  hasSelection: boolean;
  disabled: boolean;
  onSelect: (option: SurveyOption) => void;
}

function SurveyOptionCard({
  option,
  index,
  isSelected,
  hasSelection,
  disabled,
  onSelect,
}: SurveyOptionCardProps) {
  const [imgError, setImgError] = useState(false);
  const IconComponent = option.icon ? ICON_MAP[option.icon] : null;
  const showImage = option.imageUrl && !imgError;

  return (
    <motion.button
      variants={cardVariants}
      onClick={() => onSelect(option)}
      whileTap={{ scale: 0.96 }}
      disabled={disabled}
      animate={
        !hasSelection
          ? { opacity: 1, scale: 1 }
          : isSelected
          ? { opacity: 1, scale: 1.02 }
          : { opacity: 0.4, scale: 0.98 }
      }
      transition={{ duration: 0.4, ease: SMOOTH }}
      className={cn(
        "group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl bg-white p-4 text-center cursor-pointer",
        "border-[3px] outline-none",
        "focus-visible:ring-4 focus-visible:ring-[#e6009e]/25",
        isSelected
          ? "border-[#e6009e] shadow-[0_6px_0_rgba(184,0,126,0.25)]"
          : "border-[#141414]/12 hover:border-[#e6009e]/40"
      )}
      style={{ transitionDelay: `${index * 50}ms` }}
      aria-pressed={isSelected}
    >
      {/* Image / gradient icon tile */}
      <div
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl"
        style={{
          background:
            option.imageGradient ??
            "linear-gradient(135deg,#ffeefa 0%,#ffe600 100%)",
        }}
      >
        {showImage ? (
          <img
            src={option.imageUrl}
            alt={option.label}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : null}

        {/* Icon fallback — only when no image or image failed */}
        {IconComponent && !showImage && (
          <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_3px_0_rgba(20,20,20,0.15)] ring-2 ring-[#141414]/8">
            <IconComponent size={24} weight="fill" className="text-[#e6009e]" />
          </span>
        )}
      </div>

      {/* Label */}
      <span className="font-display text-[15px] font-semibold leading-tight text-[#141414]">
        {option.label}
      </span>

      {/* Selected check badge */}
      <AnimatePresence>
        {isSelected && (
          <motion.span
            initial={{ scale: 0, rotate: -45, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: 45, opacity: 0 }}
            transition={{ type: "spring", stiffness: 450, damping: 18 }}
            className="absolute right-2.5 top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[#e6009e] ring-2 ring-white"
          >
            <Check size={15} weight="bold" className="text-white" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
