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
   Component
   ========================================================================== */

export function SurveyScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatedRef = useRef(false);

  const setSurveyAnswers = usePlayerStore((s) => s.setSurveyAnswers);
  const setBartleType = usePlayerStore((s) => s.setBartleType);

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

          if (!navigatedRef.current) {
            navigatedRef.current = true;
            router.push("/mall");
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
    ]
  );

  /* ============================================================================
     Render
     ========================================================================== */

  return (
    <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl">
        {/* Eyebrow */}
        <div className="mb-8 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium text-[#a1a1aa] ring-1 ring-white/10">
            <Sparkle size={12} weight="light" className="text-[#d4af37]" />
            Style Profile
          </span>
        </div>

        {/* Progress dots */}
        <div className="mb-10 flex items-center justify-center gap-2.5">
          {SURVEY_QUESTIONS.map((q, i) => (
            <div
              key={q.id}
              className={cn(
                "h-2 rounded-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
                i < currentIndex && "w-2 bg-[#d4af37]",
                i === currentIndex && "w-8 bg-[#d4af37] glow-gold",
                i > currentIndex && "w-2 bg-white/15"
              )}
              aria-label={`Question ${i + 1}${
                i < currentIndex ? " (answered)" : ""
              }`}
            />
          ))}
        </div>

        {/* Question card — double bezel */}
        <div className="bezel-card">
          <div className="bezel-card-inner">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 48, filter: "blur(8px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -48, filter: "blur(8px)" }}
                transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
              >
                {/* Subtitle */}
                {currentQuestion.subtitle && (
                  <p className="mb-2 text-center text-xs uppercase tracking-[0.15em] text-[#71717a]">
                    {currentQuestion.subtitle}
                  </p>
                )}

                {/* Prompt */}
                <h2 className="mb-8 text-center text-2xl font-bold tracking-tight text-[#f5f5f7] sm:text-3xl">
                  {currentQuestion.prompt}
                </h2>

                {/* Options grid */}
                <div
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
                        className={cn(
                          "group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl p-5 text-center ring-1 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]",
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
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 20,
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
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* No skip button — single forward flow */}
        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.15em] text-[#71717a]">
          Question {currentIndex + 1} of {totalQuestions}
        </p>
      </div>
    </main>
  );
}

export default SurveyScreen;
