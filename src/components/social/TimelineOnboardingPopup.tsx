"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, PlayCircle, Sparkle, Star, ArrowRight } from "@phosphor-icons/react";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import { showTokenFeedback } from "@/engine/tokenEconomy";

/**
 * TimelineOnboardingPopup — the "Trending feed unlock" feature reveal.
 *
 * Playful Figma direction (node 25:143): white backdrop, yellow (#ffe600)
 * card with a sticker "Trending feed unlock" heading, left-aligned body copy,
 * a magenta outline token-reward pill, a solid magenta "Start Watching" CTA,
 * and a 3D phone illustration (feed-phone.png) with sparkle decorations below.
 *
 * Behaviour preserved from the original:
 *  - Shows once (guarded by uiStore.hasSeenTimelineOnboarding)
 *  - Dismiss awards 50 tokens via playerStore.awardTokens + tokenEconomy feedback
 *  - markTimelineOnboardingSeen called on dismiss
 */

const SMOOTH = [0.32, 0.72, 0, 1] as const;
const POP = [0.34, 1.56, 0.64, 1] as const;

export function TimelineOnboardingPopup() {
  const hasSeenTimelineOnboarding = useUIStore(
    (s) => s.hasSeenTimelineOnboarding
  );
  const markTimelineOnboardingSeen = useUIStore(
    (s) => s.markTimelineOnboardingSeen
  );
  const awardTokens = usePlayerStore((s) => s.awardTokens);

  const [isVisible, setIsVisible] = useState(false);
  const [phoneError, setPhoneError] = useState(false);

  useEffect(() => {
    if (!hasSeenTimelineOnboarding) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTimelineOnboarding]);

  const handleDismiss = () => {
    setIsVisible(false);
    markTimelineOnboardingSeen();

    const tokensAwarded = awardTokens(50);
    showTokenFeedback("earn", tokensAwarded, "Discovered Timeline!");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: SMOOTH }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#141414]/40 backdrop-blur-sm pointer-events-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ duration: 0.55, ease: POP }}
            className="relative w-full max-w-sm flex flex-col items-center gap-4"
          >
            {/* Close button */}
            <button
              onClick={handleDismiss}
              aria-label="Close"
              className="absolute -top-2 right-0 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#141414] ring-2 ring-[#141414]/10 transition-all duration-200 hover:ring-[#141414]/25 active:scale-95"
            >
              <X size={16} weight="bold" />
            </button>

            {/* Yellow card — main content */}
            <div className="relative w-full overflow-hidden rounded-3xl bg-[#ffe600] p-6 shadow-[0_16px_48px_rgba(20,20,20,0.22)] ring-[3px] ring-[#141414]/10">
              {/* Sparkle decorations */}
              <motion.div
                animate={{ y: [0, -5, 0], opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute right-4 top-4"
              >
                <Sparkle size={18} weight="fill" className="text-[#e6009e]" />
              </motion.div>
              <motion.div
                animate={{ y: [0, 4, 0], opacity: [0.4, 0.8, 0.4] }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
                className="absolute left-5 bottom-20"
              >
                <Sparkle size={14} weight="fill" className="text-[#7c3aed]" />
              </motion.div>

              <div className="flex flex-col items-start text-left gap-3">
                {/* Sticker heading — white fill + black outline on yellow bg */}
                <h2 className="sticker-heading text-[2rem] leading-[1.05]">
                  Trending feed unlock
                </h2>

                {/* Body copy */}
                <p className="text-sm leading-relaxed text-[#141414] max-w-[34ch]">
                  Swipe through our new AI-generated, highly curated video feed
                  to discover exclusive products and flash sales.
                </p>

                {/* Reward pill — magenta outline, white bg */}
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#e6009e] ring-2 ring-[#e6009e]">
                  <Star size={15} weight="fill" className="text-[#e6009e]" />
                  +50 Tokens for exploring
                </span>

                {/* Start Watching button */}
                <motion.button
                  onClick={handleDismiss}
                  whileTap={{ scale: 0.97 }}
                  className="btn-magenta mt-2 w-full"
                >
                  <PlayCircle size={18} weight="fill" />
                  Start Watching
                  <ArrowRight size={16} weight="bold" />
                </motion.button>
              </div>
            </div>

            {/* 3D phone illustration below the yellow card */}
            <div className="relative h-28 w-full flex items-center justify-center">
              {!phoneError ? (
                <img
                  src="/assets/figma/feed-phone.png"
                  alt="MurkyCorps trending feed phone"
                  className="h-full w-auto object-contain drop-shadow-[0_12px_24px_rgba(20,20,20,0.18)]"
                  onError={() => setPhoneError(true)}
                />
              ) : (
                <div
                  className="flex h-full w-32 items-center justify-center rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg,#ffeefa 0%,#ffe600 50%,#d0f0c0 100%)",
                  }}
                >
                  <PlayCircle
                    size={40}
                    weight="fill"
                    className="text-[#e6009e]"
                  />
                </div>
              )}
              <motion.div
                animate={{ y: [0, -6, 0], rotate: [0, 8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -right-1 top-0"
              >
                <Sparkle size={20} weight="fill" className="text-[#e6009e]" />
              </motion.div>
              <motion.div
                animate={{ y: [0, 5, 0], rotate: [0, -6, 0] }}
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.4,
                }}
                className="absolute left-2 bottom-0"
              >
                <Star size={16} weight="fill" className="text-[#14b8a6]" />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default TimelineOnboardingPopup;
