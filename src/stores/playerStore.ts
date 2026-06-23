/**
 * playerStore - the player's persistent (session) state.
 *
 * Holds: tokens, tier, tierXP, streak, bartleType, surveyAnswers, perks,
 *         trialPerks.
 * Actions: addTokens, spendTokens, setTier, addTierXP, incrementStreak,
 *          breakStreak, activateRecovery, addPerk, removePerk,
 *          expireTrialPerks, setBartleType, setSurveyAnswers, reset.
 */

import { create } from "zustand";
import type {
  BartleType,
  Perk,
  PlayerState,
  StreakState,
  Tier,
} from "@/types";

/* ============================================================================
   Tier multiplier map (token earn rate by tier)
   ========================================================================== */

export const TIER_MULTIPLIERS: Record<Tier, number> = {
  bronze: 1,
  silver: 1.5,
  gold: 2,
  neodymium: 3,
};

/* ============================================================================
   Helpers
   ========================================================================== */

/** Round a tier-multiplied reward to the nearest non-negative integer. */
export function applyTierMultiplier(baseReward: number, tier: Tier): number {
  const multiplier = TIER_MULTIPLIERS[tier];
  return Math.max(0, Math.round(baseReward * multiplier));
}

/* ============================================================================
   Store
   ========================================================================== */

export interface PlayerStore extends PlayerState {
  /** Add raw tokens (no tier multiplier). Rounds + clamps to non-negative. */
  addTokens: (amount: number) => void;
  /**
   * Award a BASE reward, automatically applying the current tier's earn-rate
   * multiplier (Bronze 1x, Silver 1.5x, Gold 2x, Neodymium 3x). Returns the
   * exact integer amount credited so callers can show an accurate "+N" in the
   * celebration feedback. This is the canonical earning path for exploration,
   * tasks, the spinning wheel, and the secret token.
   */
  awardTokens: (baseReward: number) => number;
  spendTokens: (amount: number) => boolean;
  setTier: (tier: Tier) => void;
  addTierXP: (amount: number) => void;
  incrementStreak: () => void;
  breakStreak: () => void;
  activateRecovery: () => void;
  addPerk: (perk: Perk) => void;
  removePerk: (perkId: string) => void;
  expireTrialPerks: (now?: number) => void;
  setBartleType: (type: BartleType) => void;
  setSurveyAnswers: (answers: Record<string, string>) => void;
  reset: () => void;
}

const initialStreak: StreakState = {
  count: 1, // Day 1 first visit per Day 1 minute 20:00
  lastVisit: 0, // set on startSession
  broken: false,
  recoveryWindow: false,
};

const initialPlayerState: PlayerState = {
  tokens: 0,
  tier: "bronze",
  tierXP: 0,
  streak: { ...initialStreak },
  bartleType: null,
  surveyAnswers: {},
  perks: [],
  trialPerks: [],
};

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  ...initialPlayerState,

  addTokens: (amount) =>
    set((state) => ({
      tokens: Math.max(0, state.tokens + Math.round(amount)),
      tierXP: state.tierXP + Math.max(0, Math.round(amount)),
    })),

  awardTokens: (baseReward) => {
    const credited = applyTierMultiplier(baseReward, get().tier);
    set((state) => ({
      tokens: Math.max(0, state.tokens + credited),
      tierXP: state.tierXP + credited,
    }));
    return credited;
  },

  spendTokens: (amount) => {
    // Reject non-positive or non-integer amounts to prevent negative-spend
    // token-increase exploits. Only a positive integer may be deducted.
    if (!Number.isInteger(amount) || amount <= 0) return false;
    let success = false;
    set((state) => {
      if (state.tokens < amount) return state; // insufficient -> no-op
      success = true;
      return { tokens: Math.max(0, state.tokens - amount) };
    });
    return success;
  },

  setTier: (tier) => set({ tier }),

  addTierXP: (amount) =>
    set((state) => ({ tierXP: Math.max(0, state.tierXP + amount) })),

  incrementStreak: () =>
    set((state) => ({
      streak: {
        count: state.streak.count + 1,
        lastVisit: Date.now(),
        broken: false,
        recoveryWindow: false,
      },
    })),

  breakStreak: () =>
    set((state) => ({
      streak: { ...state.streak, broken: true },
    })),

  activateRecovery: () =>
    set((state) => ({
      streak: { ...state.streak, recoveryWindow: true, broken: false },
    })),

  addPerk: (perk) =>
    set((state) => {
      if (perk.type === "trial") {
        return state.trialPerks.some((p) => p.id === perk.id)
          ? state
          : { trialPerks: [...state.trialPerks, perk] };
      }
      return state.perks.some((p) => p.id === perk.id)
        ? state
        : { perks: [...state.perks, perk] };
    }),

  removePerk: (perkId) =>
    set((state) => ({
      perks: state.perks.filter((p) => p.id !== perkId),
    })),

  expireTrialPerks: (now = Date.now()) =>
    set((state) => ({
      trialPerks: state.trialPerks.filter((p) => {
        if (p.expiresAt === undefined) return true; // permanent
        return p.expiresAt > now;
      }),
    })),

  setBartleType: (type) => set({ bartleType: type }),

  setSurveyAnswers: (answers) => set({ surveyAnswers: answers }),

  reset: () => set({ ...initialPlayerState, streak: { ...initialStreak } }),
}));

export default usePlayerStore;
