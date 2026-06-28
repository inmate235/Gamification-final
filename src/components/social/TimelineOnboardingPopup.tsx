import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, PlayCircle, Sparkle, Star } from "@phosphor-icons/react";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import { showTokenFeedback } from "@/engine/tokenEconomy";

/**
 * TimelineOnboardingPopup — the "Trending feed unlock" feature reveal.
 *
 * Shows a premium onboarding popup when the user first discovers the social
 * timeline feed. Uses the project's design system (gold/teal accents, double-
 * bezel card, glassmorphism) — no generic AI-purple or emoji.
 *
 * Figma reference: node 25:143 "Trending feed unlock"
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

export function TimelineOnboardingPopup() {
  const hasSeenTimelineOnboarding = useUIStore((s) => s.hasSeenTimelineOnboarding);
  const markTimelineOnboardingSeen = useUIStore((s) => s.markTimelineOnboardingSeen);
  const awardTokens = usePlayerStore((s) => s.awardTokens);
  
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show if they haven't seen it, with a tiny delay for better UX
    if (!hasSeenTimelineOnboarding) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTimelineOnboarding]);

  const handleDismiss = () => {
    setIsVisible(false);
    markTimelineOnboardingSeen();
    
    // Reward the user for discovering the feed!
    const tokensAwarded = awardTokens(50); // 50 base tokens
    showTokenFeedback("earn", tokensAwarded, "Discovered Timeline!");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(16px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          transition={{ duration: 0.5, ease: PREMIUM_EASE }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 pointer-events-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.92, y: 24, filter: "blur(8px)" }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="relative w-full max-w-sm"
          >
            {/* Double-bezel card — matching project design system */}
            <div className="bezel-card glow-gold">
              <div className="bezel-card-inner relative overflow-hidden p-0">
                {/* Close button */}
                <button
                  onClick={handleDismiss}
                  aria-label="Close"
                  className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/10 active:scale-[0.96]"
                >
                  <X size={16} weight="light" className="text-[#a1a1aa]" />
                </button>

                {/* Visual hero — gradient atmosphere with play icon (Figma image placeholder) */}
                <div
                  className="relative flex h-32 items-center justify-center overflow-hidden"
                  style={{
                    background:
                      "linear-gradient(135deg, #1a1a2e 0%, #2a1a3e 40%, #1a1a25 70%, #0a0a0f 100%)",
                  }}
                >
                  {/* Radial gold glow */}
                  <div
                    className="absolute inset-0 opacity-50"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 50%, rgba(212,175,55,0.2) 0%, transparent 60%)",
                    }}
                  />
                  {/* Play icon with glow */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, ease: PREMIUM_EASE, delay: 0.2 }}
                    className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[#d4af37]/10 ring-1 ring-[#d4af37]/30 backdrop-blur-sm"
                  >
                    <PlayCircle size={36} weight="light" className="text-[#d4af37]" />
                  </motion.div>
                  {/* Ambient floating sparkle */}
                  <motion.div
                    animate={{ y: [0, -6, 0], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute right-8 top-4"
                  >
                    <Sparkle size={14} weight="light" className="text-[#d4af37]/60" />
                  </motion.div>
                </div>

                {/* Content */}
                <div className="flex flex-col items-start text-left gap-3 p-6">
                  {/* Heading — Figma: "Trending feed unlock" */}
                  <h2 className="text-xl font-bold tracking-tight text-[#f5f5f7]">
                    Trending Feed Unlock
                  </h2>

                  {/* Description — Figma: "Swipe Through our new AI generated" */}
                  <p className="text-sm leading-relaxed text-[#a1a1aa] max-w-[40ch]">
                    Swipe through our new AI-generated, highly curated video feed
                    to discover exclusive products and flash sales.
                  </p>

                  {/* Reward badge — gold star + token count (Figma: "+10 Tokens for exploring") */}
                  <div className="flex w-full items-center gap-2 rounded-2xl bg-[#d4af37]/8 px-4 py-3 ring-1 ring-[#d4af37]/20">
                    <Star size={16} weight="fill" className="shrink-0 text-[#d4af37]" />
                    <span className="text-sm font-medium text-[#d4af37]">
                      +50 Tokens for exploring
                    </span>
                  </div>

                  {/* Start Watching button — Figma: "Start Watching" */}
                  <motion.button
                    onClick={handleDismiss}
                    whileTap={{ scale: 0.98 }}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#d4af37] to-[#b8941f] px-6 py-3.5 text-sm font-semibold text-black shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] cursor-pointer"
                  >
                    <span>Start Watching</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default TimelineOnboardingPopup;
