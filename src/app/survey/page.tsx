"use client";

import { SurveyScreen } from "@/components/onboarding/SurveyScreen";
import { OnboardingGuard } from "@/components/onboarding/OnboardingGuard";

/**
 * Survey route `/survey` — the style profile survey.
 *
 * Guarded: direct navigation to /survey without a validated invite code
 * redirects back to `/` (the invite entry screen).
 *
 * 3 questions with auto-advance. Answers stored in playerStore and used for
 * covert Bartle type classification. Navigates forward to /mall on completion.
 * Single forward flow — no back navigation.
 */
export default function SurveyPage() {
  return (
    <OnboardingGuard requiredStep="survey">
      <SurveyScreen />
    </OnboardingGuard>
  );
}
