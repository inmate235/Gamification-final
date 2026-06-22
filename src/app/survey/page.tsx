import { SurveyScreen } from "@/components/onboarding/SurveyScreen";

/**
 * Survey route `/survey` — the style profile survey.
 *
 * 3 questions with auto-advance. Answers stored in playerStore and used for
 * covert Bartle type classification. Navigates forward to /mall on completion.
 * Single forward flow — no back navigation.
 */
export default function SurveyPage() {
  return <SurveyScreen />;
}
