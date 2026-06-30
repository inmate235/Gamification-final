/**
 * Survey questions and types for the Bartle Type Classification survey.
 *
 * The survey answers are used to covertly classify the player into one of
 * four Bartle player types (see lib/bartle.ts). This file holds the static
 * question/option data; the classification logic lives in lib/bartle.ts.
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
    subtitle: "Pick the vibe that fits you",
    options: [
      {
        id: "bold",
        label: "Bold & Avant-Garde",
        imageUrl: "/assets/survey/bold.png",
        imageGradient:
          "linear-gradient(135deg, #e879a1 0%, #9d7fdb 50%, #4fd1c5 100%)",
        icon: "Lightning",
        scores: { killer: 3, explorer: 1 },
      },
      {
        id: "classic",
        label: "Classic & Refined",
        imageUrl: "/assets/survey/classic.png",
        imageGradient:
          "linear-gradient(135deg, #d4af37 0%, #b8941f 50%, #1a1a25 100%)",
        icon: "Diamond",
        scores: { achiever: 3, socializer: 1 },
      },
      {
        id: "trendy",
        label: "Trendy & Fresh",
        imageUrl: "/assets/survey/trendy.png",
        imageGradient:
          "linear-gradient(135deg, #4fd1c5 0%, #9d7fdb 50%, #e879a1 100%)",
        icon: "Sparkle",
        scores: { explorer: 3, socializer: 1 },
      },
      {
        id: "cozy",
        label: "Cozy & Casual",
        imageUrl: "/assets/survey/cozy.png",
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
        imageUrl: "/assets/survey/friends.png",
        imageGradient:
          "linear-gradient(135deg, #9d7fdb 0%, #e879a1 100%)",
        icon: "Users",
        scores: { socializer: 3, killer: 1 },
      },
      {
        id: "solo",
        label: "Solo adventure",
        imageUrl: "/assets/survey/solo.png",
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
        imageUrl: "/assets/survey/deals.png",
        imageGradient:
          "linear-gradient(135deg, #d4af37 0%, #b87333 100%)",
        icon: "Tag",
        scores: { achiever: 3, killer: 1 },
      },
      {
        id: "discovery",
        label: "Discovering new things",
        imageUrl: "/assets/survey/discovery.png",
        imageGradient:
          "linear-gradient(135deg, #4fd1c5 0%, #9d7fdb 100%)",
        icon: "Compass",
        scores: { explorer: 3, socializer: 1 },
      },
    ],
  },
];
