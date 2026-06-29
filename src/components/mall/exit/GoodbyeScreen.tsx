"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkle, Heart } from "@phosphor-icons/react/dist/ssr";
import { useSessionStore } from "@/stores/sessionStore";
import { usePlayerStore } from "@/stores/playerStore";

/**
 * GoodbyeScreen — the post-exit state shown when the user has successfully
 * left the mall (final "Leave anyway" on Layer 3, VAL-EXIT-017, VAL-EXIT-032).
 *
 * Renders in place of the mall experience while `sessionStore.exited` is true.
 * A "Return to Mall" control clears the exited flag so the user can jump back
 * in (the exit-friction state has already been reset on leave).
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

export function GoodbyeScreen() {
  const returnToMall = useSessionStore((s) => s.returnToMall);
  const streakCount = usePlayerStore((s) => s.streak.count);

  return (
    <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 48, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: PREMIUM_EASE }}
        className="w-full max-w-md"
        data-testid="goodbye-screen"
      >
        <div className="bezel-card">
          <div className="bezel-card-inner flex flex-col items-center text-center">
            {/* Eyebrow */}
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: PREMIUM_EASE, delay: 0.15 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium ring-1 text-[#7c3aed]"
              style={{
                borderColor: "#7c3aed55",
                background: "#7c3aed14",
              }}
            >
              <Sparkle size={12} weight="light" style={{ color: "#7c3aed" }} />
              You left the mall
            </motion.span>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: PREMIUM_EASE, delay: 0.3 }}
              className="sticker-heading text-3xl sm:text-4xl"
            >
              Come back soon
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: PREMIUM_EASE, delay: 0.45 }}
              className="mt-4 text-sm text-[#4b4b4b] max-w-[34ch]"
            >
              Your {streakCount}-day streak and progress are waiting for you.
              The mall is open whenever you are.
            </motion.p>

            {/* Return CTA */}
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: PREMIUM_EASE, delay: 0.6 }}
              onClick={returnToMall}
              className="btn-magenta group mt-8"
              data-testid="return-to-mall"
            >
              <Heart size={15} weight="fill" />
              Return to Mall
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/15 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
                <ArrowRight size={14} weight="bold" />
              </span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

export default GoodbyeScreen;
