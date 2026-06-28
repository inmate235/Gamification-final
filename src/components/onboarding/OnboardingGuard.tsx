"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboardingStore } from "@/stores/onboardingStore";
import type { OnboardingStep } from "@/types";

/**
 * OnboardingGuard — a client-side route guard for the forward-only
 * onboarding flow.
 *
 * Wraps a route's content and enforces that the player has progressed to (or
 * past) `requiredStep` before rendering the children. If the player has not
 * reached the required step (e.g. they navigated directly to the URL),
 * `router.replace("/")` redirects them back to the invite entry screen and a
 * brief "Redirecting…" placeholder is shown instead of the guarded content.
 *
 * Step ladder: 'invite' -> 'survey' -> 'mall'.
 *
 *   requiredStep="survey"  → blocks /survey until invite code validated.
 *   requiredStep="mall"    → blocks /mall until survey completed.
 */

interface OnboardingGuardProps {
  /** The minimum onboarding step required to view the wrapped content. */
  requiredStep: Exclude<OnboardingStep, "invite">;
  children: ReactNode;
}

const STEP_INDEX: Record<OnboardingStep, number> = {
  invite: 0,
  survey: 1,
  mall: 2,
};

export function OnboardingGuard({
  requiredStep,
  children,
}: OnboardingGuardProps) {
  const router = useRouter();
  const onboardingStep = useOnboardingStore((s) => s.onboardingStep);
  const hasAccess = STEP_INDEX[onboardingStep] >= STEP_INDEX[requiredStep];

  // External-system sync (navigation), not a state-derive pattern, so this
  // side effect is intentionally placed in useEffect.
  useEffect(() => {
    if (!hasAccess) {
      router.replace("/");
    }
  }, [hasAccess, router]);

  if (!hasAccess) {
    return (
      <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          className="text-sm text-[#8a8a8a]"
        >
          Redirecting to invite entry…
        </motion.div>
      </main>
    );
  }

  return <>{children}</>;
}

export default OnboardingGuard;
