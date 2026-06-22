"use client";

import { motion } from "framer-motion";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { usePlayerStore } from "@/stores/playerStore";
import { OnboardingGuard } from "@/components/onboarding/OnboardingGuard";

/**
 * Mall route `/mall` — defensive stub.
 *
 * The full mall experience (SVG map, fog-of-war, status bar, bottom panel) is
 * built in a subsequent feature. This stub ensures the onboarding forward flow
 * (/ -> /survey -> /mall) works end-to-end and provides a defensive guard: if
 * a user navigates directly to /mall without completing onboarding (survey not
 * done), the OnboardingGuard redirects them back to /.
 */

export default function MallPage() {
  return (
    <OnboardingGuard requiredStep="mall">
      <MallStub />
    </OnboardingGuard>
  );
}

function MallStub() {
  const surveyAnswers = usePlayerStore((s) => s.surveyAnswers);

  return (
    <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 32, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium text-[#a1a1aa] ring-1 ring-white/10">
            <Sparkle size={12} weight="light" className="text-[#d4af37]" />
            Mall Experience · Loading
          </span>
        </div>

        <div className="bezel-card glow-gold">
          <div className="bezel-card-inner flex flex-col items-center text-center">
            <h1 className="text-gradient-gold text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome to the Mall
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-[#a1a1aa]">
              Your profile is set. The full mall experience is being prepared.
            </p>

            <div className="mt-6 flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs text-[#4fd1c5] ring-1 ring-white/10">
              <span className="h-2 w-2 rounded-full bg-[#4fd1c5] glow-teal" />
              Onboarding complete · {Object.keys(surveyAnswers).length} answers
              recorded
            </div>

            {/* NOTE: Bartle type is intentionally NOT shown to the user.
                This is a covert classification per Section 6A. */}
            <p className="sr-only" aria-hidden="true">
              Profile configured
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
