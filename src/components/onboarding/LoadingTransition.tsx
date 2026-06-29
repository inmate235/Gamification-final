"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

/**
 * LoadingTransition — a full-screen loading overlay shown during the
 * survey → mall transition. Plays the shopper walking video as a cinematic
 * "entering the mall" moment, then navigates to /mall.
 *
 * Mounted by SurveyScreen after the last question is answered and all
 * onboarding state (answers, Bartle type, trial perks, advanceToMall) has
 * been committed. The component handles only the visual transition + navigation.
 */

const VIDEO_DURATION_MS = 2500;
const FADE_OUT_MS = 400;
const SMOOTH = [0.32, 0.72, 0, 1] as const;

const isTest =
  typeof process !== "undefined" && process.env.NODE_ENV === "test";

export function LoadingTransition() {
  const router = useRouter();
  const [isFadingOut, setIsFadingOut] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    const delay = isTest ? 0 : VIDEO_DURATION_MS;

    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, delay);

    const navTimer = setTimeout(
      () => {
        if (!navigatedRef.current) {
          navigatedRef.current = true;
          router.push("/mall");
        }
      },
      isTest ? 0 : delay + FADE_OUT_MS
    );

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
    };
  }, [router]);

  return (
    <AnimatePresence>
      {!isFadingOut && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: SMOOTH }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#141414] overflow-hidden"
          data-testid="loading-transition"
        >
          {/* Full-screen background video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          >
            <source src="/assets/onboarding/shopper-walking.mp4" type="video/mp4" />
          </video>

          {/* Dark vignette for text legibility */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(20,20,20,0.2) 0%, rgba(20,20,20,0.6) 70%, rgba(20,20,20,0.85) 100%)",
            }}
          />

          {/* Centered content */}
          <div className="relative z-10 flex flex-col items-center gap-6 px-6">
            {/* Animated walking dots */}
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-2.5 w-2.5 rounded-full bg-[#e6009e]"
                  animate={{
                    y: [0, -12, 0],
                    opacity: [0.4, 1, 0.4],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.15,
                  }}
                />
              ))}
            </div>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: SMOOTH, delay: 0.2 }}
              className="font-display text-center text-2xl font-bold text-white sm:text-3xl"
            >
              Entering MurkyCorps Mall
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: SMOOTH, delay: 0.5 }}
              className="text-center text-sm text-white/60"
            >
              Preparing your personalized experience
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
