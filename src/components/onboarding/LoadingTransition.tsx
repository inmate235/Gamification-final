"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

/**
 * LoadingTransition — a full-screen loading overlay shown during the
 * survey → mall transition. Plays the shopper walking video as a cinematic
 * "entering the mall" moment, then navigates to /mall.
 *
 * Mounted by SurveyScreen after the last question is answered and all
 * onboarding state (answers, Bartle type, trial perks, advanceToMall) has
 * been committed. The component handles only the visual transition + navigation.
 */

/**
 * Video play duration before navigating. The overlay stays fully opaque
 * until navigation fires, then MallExperience's own entrance animation
 * (fade-in from opacity 0) handles the visual handoff. This avoids a
 * brief flash of the survey card underneath during route transition.
 */
const VIDEO_DURATION_MS = 5500;
const SMOOTH = [0.32, 0.72, 0, 1] as const;

const isTest =
  typeof process !== "undefined" && process.env.NODE_ENV === "test";

export function LoadingTransition() {
  const router = useRouter();
  const navigatedRef = useRef(false);

  useEffect(() => {
    const navTimer = setTimeout(
      () => {
        if (!navigatedRef.current) {
          navigatedRef.current = true;
          router.push("/mall");
        }
      },
      isTest ? 0 : VIDEO_DURATION_MS
    );

    return () => {
      clearTimeout(navTimer);
    };
  }, [router]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: SMOOTH }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#2C1142] overflow-hidden"
      data-testid="loading-transition"
    >
          {/* Full-screen background video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-luminosity"
          >
            <source src="/assets/onboarding/shopper-walking.mp4" type="video/mp4" />
          </video>

          {/* Dark purple vignette for text legibility and matching theme */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(44,17,66,0.4) 0%, rgba(44,17,66,0.85) 70%, rgba(30,10,45,0.95) 100%)",
            }}
          />

          {/* Centered content */}
          <div className="relative z-10 flex flex-col items-center gap-8 px-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, ease: SMOOTH, delay: 0.1 }}
              className="w-72 sm:w-96 md:w-[28rem] drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)]"
            >
              <img 
                src="/assets/survey/murkmall-logo.png" 
                alt="Entering MurkMall..." 
                className="w-full h-auto drop-shadow-2xl"
              />
            </motion.div>

            {/* Animated loading dots with logo colors */}
            <div className="flex items-center gap-3">
              {["#FF69B4", "#A870E8", "#FFD300"].map((color, i) => (
                <motion.div
                  key={i}
                  className="h-3.5 w-3.5 rounded-full shadow-lg"
                  style={{ backgroundColor: color }}
                  animate={{
                    y: [0, -14, 0],
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: SMOOTH, delay: 0.6 }}
              className="text-center text-sm sm:text-base font-medium max-w-sm px-4 text-[#E1C49C] drop-shadow-md"
            >
              Sprinkling candy-coated reward loops onto your screen to make spending money feel just like unwrapping a sweet treat!
            </motion.p>
          </div>
    </motion.div>
  );
}
