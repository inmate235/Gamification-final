/**
 * Bartle Type Classification (covert).
 *
 * The survey answers are used to classify the player into one of four Bartle
 * player types: achiever, explorer, socializer, killer. This classification is
 * NEVER shown to the user (Section 6A — "covertly classifies users").
 *
 * Scoring approach:
 *  Each survey answer contributes points to one or more Bartle types. After all
 *  answers are collected, the type with the highest score wins. Ties are broken
 *  by a deterministic priority order: achiever > explorer > socializer > killer.
 *
 * The survey question/option data and types live in data/surveyData.ts.
 */

import type { BartleType } from "@/types";
import { SURVEY_QUESTIONS } from "@/data/surveyData";

/* ============================================================================
   Classification
   ========================================================================== */

/** Deterministic tie-break priority (highest first). */
const TIE_BREAK_PRIORITY: BartleType[] = [
  "achiever",
  "explorer",
  "socializer",
  "killer",
];

/**
 * Classify a player's Bartle type from their survey answers.
 *
 * @param answers A record keyed by question id, valued by option id.
 * @returns One of the four Bartle types, or null if answers are incomplete.
 */
export function classifyBartleType(
  answers: Record<string, string>
): BartleType | null {
  if (Object.keys(answers).length < SURVEY_QUESTIONS.length) return null;

  const tally: Record<BartleType, number> = {
    achiever: 0,
    explorer: 0,
    socializer: 0,
    killer: 0,
  };

  for (const question of SURVEY_QUESTIONS) {
    const selectedOptionId = answers[question.id];
    if (!selectedOptionId) continue;
    const option = question.options.find((o) => o.id === selectedOptionId);
    if (!option) continue;
    for (const [type, points] of Object.entries(option.scores) as [
      BartleType,
      number,
    ][]) {
      tally[type] += points;
    }
  }

  // Find max score; break ties by deterministic priority order.
  let bestType: BartleType = TIE_BREAK_PRIORITY[0];
  let bestScore = tally[bestType];
  for (const type of TIE_BREAK_PRIORITY) {
    if (tally[type] > bestScore) {
      bestScore = tally[type];
      bestType = type;
    }
  }

  return bestType;
}

/**
 * Convenience: classify and validate the result is a known Bartle type.
 * Returns null if classification fails or produces an unexpected value.
 */
export function classifyBartleTypeSafe(
  answers: Record<string, string>
): BartleType | null {
  const result = classifyBartleType(answers);
  if (
    result &&
    (TIE_BREAK_PRIORITY as string[]).includes(result)
  ) {
    return result;
  }
  return null;
}
