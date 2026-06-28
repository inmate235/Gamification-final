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
 */

import type { BartleType } from "@/types";

/* ============================================================================
   Types
   ========================================================================== */

export interface SurveyQuestion {
  id: string;
  prompt: string;
  /** Optional helper/eyebrow text shown above the prompt. */
  subtitle?: string;
  options: SurveyOption[];
}

export interface SurveyOption {
  id: string;
  label: string;
  /** Optional image URL for image-card style questions (Figma assets). */
  imageUrl?: string;
  /** Optional image URL or gradient token for image-card style questions. */
  imageGradient?: string;
  /** Icon name from Phosphor light set, rendered by the survey component. */
  icon?: string;
  /** Points awarded to each Bartle type when this option is selected. */
  scores: Partial<Record<BartleType, number>>;
}

/* ============================================================================
   Survey Questions (3 core questions per spec)
   ========================================================================== */

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "style",
    prompt: "Which style speaks to you?",
    subtitle: "Pick the aesthetic that feels most you",
    options: [
      {
        id: "bold",
        label: "Bold & Avant-Garde",
        imageUrl: "/assets/figma/bold 1.png",
        imageGradient:
          "linear-gradient(135deg, #e879a1 0%, #9d7fdb 50%, #4fd1c5 100%)",
        icon: "Lightning",
        scores: { killer: 3, explorer: 1 },
      },
      {
        id: "classic",
        label: "Classic & Refined",
        imageUrl: "/assets/figma/lassic 1.png",
        imageGradient:
          "linear-gradient(135deg, #d4af37 0%, #b8941f 50%, #1a1a25 100%)",
        icon: "Diamond",
        scores: { achiever: 3, socializer: 1 },
      },
      {
        id: "trendy",
        label: "Trendy & Fresh",
        imageUrl: "/assets/figma/fresh 1.png",
        imageGradient:
          "linear-gradient(135deg, #4fd1c5 0%, #9d7fdb 50%, #e879a1 100%)",
        icon: "Sparkle",
        scores: { explorer: 3, socializer: 1 },
      },
      {
        id: "cozy",
        label: "Cozy & Casual",
        imageUrl: "/assets/figma/casual 1.png",
        imageGradient:
          "linear-gradient(135deg, #b87333 0%, #d4af37 50%, #1a1a25 100%)",
        icon: "Heart",
        scores: { socializer: 3, explorer: 1 },
      },
    ],
  },
  {
    id: "social",
    prompt: "How do you like to shop?",
    subtitle: "Solo mission or squad goals?",
    options: [
      {
        id: "friends",
        label: "With friends",
        imageUrl: "/assets/figma/friendss 1.png",
        imageGradient:
          "linear-gradient(135deg, #9d7fdb 0%, #e879a1 100%)",
        icon: "Users",
        scores: { socializer: 3, killer: 1 },
      },
      {
        id: "solo",
        label: "Solo adventure",
        imageUrl: "/assets/figma/solo 1.png",
        imageGradient:
          "linear-gradient(135deg, #4fd1c5 0%, #1a1a25 100%)",
        icon: "User",
        scores: { achiever: 2, explorer: 2 },
      },
    ],
  },
  {
    id: "motivation",
    prompt: "What pulls you in?",
    subtitle: "The thrill of the hunt or the joy of discovery?",
    options: [
      {
        id: "deals",
        label: "Hunting deals",
        imageUrl: "/assets/figma/boi 1.png",
        imageGradient:
          "linear-gradient(135deg, #d4af37 0%, #b87333 100%)",
        icon: "Tag",
        scores: { achiever: 3, killer: 1 },
      },
      {
        id: "discovery",
        label: "Discovering new things",
        imageUrl: "/assets/figma/box 1.png",
        imageGradient:
          "linear-gradient(135deg, #4fd1c5 0%, #9d7fdb 100%)",
        icon: "Compass",
        scores: { explorer: 3, socializer: 1 },
      },
    ],
  },
];

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
