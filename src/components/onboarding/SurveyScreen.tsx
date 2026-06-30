"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Check } from "@phosphor-icons/react";
import type { IconWeight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SURVEY_QUESTIONS, type SurveyOption } from "@/data/surveyData";
import { classifyBartleType } from "@/lib/bartle";
import { usePlayerStore } from "@/stores/playerStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { Logo } from "@/components/ui/Logo";
import { LoadingTransition } from "@/components/onboarding/LoadingTransition";
import { playSound, stopAllSounds, SURVEY_SOUNDS, SOUNDS } from "@/lib/sound";

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

const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
const AUTO_ADVANCE_DELAY = isTest ? 50 : 2500; // ms — let survey sounds play before advancing
const STEP_BACKGROUNDS = [
  "radial-gradient(120% 92% at 10% -14%, rgba(232,121,161,0.30) 0%, rgba(232,121,161,0.11) 36%, rgba(232,121,161,0) 70%), radial-gradient(108% 85% at 92% 0%, rgba(79,209,197,0.30) 0%, rgba(79,209,197,0.10) 38%, rgba(79,209,197,0) 72%), linear-gradient(180deg, #fff8fc 0%, #fff 54%, #f8fbff 100%)",
  "radial-gradient(120% 98% at 0% -10%, rgba(157,127,219,0.28) 0%, rgba(157,127,219,0.09) 40%, rgba(157,127,219,0) 74%), radial-gradient(115% 95% at 95% 5%, rgba(232,121,161,0.25) 0%, rgba(232,121,161,0.08) 36%, rgba(232,121,161,0) 70%), linear-gradient(180deg, #fbf8ff 0%, #fff 56%, #fff8fd 100%)",
  "radial-gradient(125% 98% at 6% -16%, rgba(212,175,55,0.26) 0%, rgba(212,175,55,0.09) 34%, rgba(212,175,55,0) 70%), radial-gradient(110% 90% at 100% 4%, rgba(79,209,197,0.27) 0%, rgba(79,209,197,0.09) 36%, rgba(79,209,197,0) 72%), linear-gradient(180deg, #fffdf7 0%, #fff 56%, #f7feff 100%)",
] as const;

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

const SMOOTH = [0.22, 0.61, 0.36, 1] as const;
const GENTLE_POP = [0.34, 1.16, 0.64, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0, x: 32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { staggerChildren: 0.06, delayChildren: 0 },
  },
  exit: {
    opacity: 0,
    x: -32,
    transition: { duration: 0.35, ease: SMOOTH },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: SMOOTH } },
};

/** Orchestrates staggered card entrance — no own animation, only controls children timing. */
const cardGridVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07 },
  },
  exit: {},
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.93 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: GENTLE_POP },
  },
};

/* ============================================================================
   Component
   ========================================================================== */

/** Figma subtitle shown at the top of the survey (text node 3:173). */
const SURVEY_SUBTITLE =
  "Answer three quick questions so MurkyCorps can personalize your mall experience.";

export function SurveyScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isExiting] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
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
  const showStyleMascot = currentQuestion.id === "style";
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

      // Play the survey-specific sound for this option immediately on tap.
      const surveySound = SURVEY_SOUNDS[option.id];
      if (surveySound) playSound(surveySound);

      setSelectedOption(option.id);
      setIsAdvancing(true);

      const newAnswers = {
        ...answers,
        [currentQuestion.id]: option.id,
      };
      setAnswers(newAnswers);

      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        // Stop the survey sound before transitioning so long sounds
        // (e.g. survey-deals at 10.6s) don't bleed into the next question.
        stopAllSounds();

        if (isLastQuestion) {
          const bartleType = classifyBartleType(newAnswers);
          setSurveyAnswers(newAnswers);
          if (bartleType) setBartleType(bartleType);

          grantOnboardingTrialPerks();
          advanceToMall();

          if (!navigatedRef.current) {
            navigatedRef.current = true;
            setShowLoading(true);
          }
        } else {
          // Play swoosh for the slide transition to the next question.
          playSound(SOUNDS.SWOOSH);
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
    <main className="relative min-h-[100dvh] overflow-hidden bg-white flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={`survey-step-bg-${currentQuestion.id}`}
          initial={{ opacity: 0.45, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.55, ease: SMOOTH }}
          className="pointer-events-none absolute inset-0"
          style={{
            background: STEP_BACKGROUNDS[currentIndex] ?? STEP_BACKGROUNDS[0],
          }}
        />
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={
          isExiting ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }
        }
        transition={{ duration: 0.45, ease: SMOOTH }}
        className="relative z-10 flex flex-col flex-1 w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl mx-auto px-4 sm:px-5 md:px-6 pt-4 sm:pt-5 pb-6 sm:pb-8"
      >
        {/* Top bar: right-aligned "Murky" pill logo */}
        <div className="flex justify-end mb-1">
          <Logo size={38} />
        </div>

        {/* Thin divider */}
        <div className="h-px bg-[#141414]/10 mb-4" />

        {/* Page subtitle (text node 3:173) */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: SMOOTH }}
          className="mb-4 sm:mb-5 rounded-2xl border border-[#141414]/10 bg-white/72 backdrop-blur-[2px] px-3.5 sm:px-4 py-3 shadow-[0_8px_24px_rgba(20,20,20,0.06)]"
        >
          <p className="text-center text-[12px] sm:text-[13px] leading-relaxed text-[#4b4b4b] max-w-[52ch] mx-auto">
            {SURVEY_SUBTITLE}
          </p>
        </motion.div>

        {/* Progress dots (retained for test compatibility) */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {SURVEY_QUESTIONS.map((q, i) => {
            const isActive = i === currentIndex;
            const isCompleted = i < currentIndex;
            return (
              <motion.div
                key={q.id}
                layout
                transition={{ duration: 0.5, ease: SMOOTH }}
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
            className="rounded-[1.65rem] border border-[#141414]/10 bg-white/84 backdrop-blur-[2px] shadow-[0_12px_30px_rgba(20,20,20,0.08)] p-4 sm:p-5 md:p-6 flex flex-col"
          >
            {/* Prompt — sticker heading */}
            <div className={cn("mb-2", showStyleMascot && "relative")}>
              <motion.h2
                variants={itemVariants}
                className={cn(
                  "sticker-heading text-[clamp(1.6rem,6vw,2.15rem)] leading-[1.02]",
                  showStyleMascot
                    ? "text-left pr-[7.4rem] sm:pr-[9.2rem]"
                    : "text-center"
                )}
              >
                {currentQuestion.prompt}
              </motion.h2>

              {showStyleMascot && (
                <img
                  src="/assets/unused/boi.png"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 top-1 w-[114px] sm:w-[139px] h-auto select-none"
                  draggable={false}
                />
              )}
            </div>
            {/* Per-question description */}
            {currentQuestion.subtitle && (
              <motion.p
                variants={itemVariants}
                className={cn(
                  "mb-6 sm:mb-7 text-[11px] sm:text-xs font-medium uppercase tracking-[0.14em] text-[#e6009e]",
                  showStyleMascot
                    ? "text-left pr-[7.4rem] sm:pr-[9.2rem]"
                    : "text-center"
                )}
              >
                {currentQuestion.subtitle}
              </motion.p>
            )}

            {/* Options — image card grid (cardGridVariants propagates stagger to cards) */}
            <motion.div variants={cardGridVariants} className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 sm:gap-3.5">
              {currentQuestion.options.map((option) => (
                <SurveyOptionCard
                  key={option.id}
                  option={option}
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

      {/* Loading transition overlay (shown after last question) */}
      {showLoading && <LoadingTransition />}
    </main>
  );
}

export default SurveyScreen;

/* ============================================================================
   SurveyOptionCard — single option card with image hero + icon fallback
   ========================================================================== */

interface SurveyOptionCardProps {
  option: SurveyOption;
  isSelected: boolean;
  hasSelection: boolean;
  disabled: boolean;
  onSelect: (option: SurveyOption) => void;
}

function SurveyOptionCard({
  option,
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
          ? { opacity: 1, scale: 1, y: 0 }
          : isSelected
          ? { opacity: 1, scale: 1.02, y: 0 }
          : { opacity: 0.4, scale: 0.98, y: 0 }
      }
      transition={{ duration: 0.4, ease: SMOOTH }}
      className={cn(
        "group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl bg-white p-3.5 sm:p-4 text-center cursor-pointer",
        "border-[3px] outline-none",
        "focus-visible:ring-4 focus-visible:ring-[#e6009e]/25",
        isSelected
          ? "border-[#e6009e] shadow-[0_6px_0_rgba(184,0,126,0.22)]"
          : "border-[#141414]/12 hover:border-[#e6009e]/40"
      )}
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
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] scale-[0.84] group-hover:scale-[0.89]"
            style={{ objectPosition: "center 22%" }}
            onError={() => setImgError(true)}
          />
        ) : null}
        {showImage && (
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(20,20,20,0)_52%,rgba(20,20,20,0.22)_100%)]" />
        )}

        {/* Icon fallback — only when no image or image failed */}
        {IconComponent && !showImage && (
          <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_3px_0_rgba(20,20,20,0.15)] ring-2 ring-[#141414]/8">
            <IconComponent size={24} weight="fill" className="text-[#e6009e]" />
          </span>
        )}
      </div>

      {/* Label */}
      <span className="font-display text-[14px] sm:text-[15px] font-semibold leading-tight text-[#141414]">
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
