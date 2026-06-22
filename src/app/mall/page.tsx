"use client";

import { OnboardingGuard } from "@/components/onboarding/OnboardingGuard";
import { MallExperience } from "@/components/mall/MallExperience";

/**
 * Mall route `/mall` — the main mall experience.
 *
 * Guarded: direct navigation to /mall without completing onboarding redirects
 * back to `/` (the invite entry screen). Once onboarding is complete the full
 * mall experience renders: SVG fog-of-war map, status bar, bottom task panel,
 * and the overlay system (store detail, celebrations).
 */
export default function MallPage() {
  return (
    <OnboardingGuard requiredStep="mall">
      <MallExperience />
    </OnboardingGuard>
  );
}
