/**
 * fountainStore - the sentient Wishing Fountain landmark state.
 *
 * The fountain, when tapped on the map, opens a cinematic welcome overlay
 * where it "comes alive" and grants a wish. The first meeting plays the full
 * welcome sequence; subsequent visits (after a short cooldown) grant another
 * wish to pull the player back to the atrium.
 *
 * Wishes are FREE (no token cost) but cooldown-gated, so the fountain is an
 * engagement hook that repeatedly draws the player back to the corridor
 * between the wings rather than a token sink. The reward table is
 * near-miss-biased: a rare jackpot creates a chase, while most outcomes are
 * small or zero so the EV is only mildly positive — enough to bait repeated
 * visits without being a farmable exploit.
 */

import { create } from "zustand";

/* ============================================================================
   Wish outcome table
   ========================================================================== */

export type WishKind =
  | "jackpot"
  | "lucky"
  | "small"
  | "phantom"
  | "dud";

export interface WishOutcome {
  kind: WishKind;
  /** Tokens awarded (already final — caller credits directly). */
  tokens: number;
  /** Short flavor line shown in the overlay. */
  message: string;
}

interface WeightedOutcome {
  kind: WishKind;
  weight: number;
  tokens: number;
  messages: string[];
}

const OUTCOMES: WeightedOutcome[] = [
  {
    kind: "jackpot",
    weight: 5,
    tokens: 5,
    messages: [
      "JACKPOT WISH! The fountain erupts in your honor.",
      "The waters boil with gold. JACKPOT!",
      "A sign! The fountain grants your wildest wish. JACKPOT!",
    ],
  },
  {
    kind: "lucky",
    weight: 20,
    tokens: 2,
    messages: [
      "The fountain smiles upon you.",
      "A lucky ripple. The fountain approves.",
      "Two coins surface. The fountain returns the favor.",
    ],
  },
  {
    kind: "small",
    weight: 30,
    tokens: 1,
    messages: [
      "A modest wish, granted.",
      "A single token bobs to the surface.",
      "The fountain murmurs its blessing.",
    ],
  },
  {
    kind: "phantom",
    weight: 15,
    tokens: 1,
    messages: [
      "A stranger made the very same wish. The fountain is moved.",
      "Someone nearby wished too. The fountain splits the blessing.",
      "Your wish rhymes with another's. Coincidence? The fountain thinks not.",
    ],
  },
  {
    kind: "dud",
    weight: 30,
    tokens: 0,
    messages: [
      "The fountain thanks you for your contribution.",
      "Your wish has been received and filed. Please allow 4-6 weeks.",
      "The fountain absorbs your offering. It is... satisfied.",
      "The waters go still. The fountain is contemplative. Try again soon.",
    ],
  },
];

const TOTAL_WEIGHT = OUTCOMES.reduce((s, o) => s + o.weight, 0);

/** Roll a weighted random wish outcome. Deterministic on the RNG call. */
export function rollWish(): WishOutcome {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const o of OUTCOMES) {
    roll -= o.weight;
    if (roll <= 0) {
      const message = o.messages[Math.floor(Math.random() * o.messages.length)];
      return { kind: o.kind, tokens: o.tokens, message };
    }
  }
  // Fallback (should never hit)
  return { kind: "dud", tokens: 0, message: OUTCOMES[4].messages[0] };
}

/* ============================================================================
   Store
   ========================================================================== */

/** Cooldown between wishes in ms. Short for demo visibility. */
export const WISH_COOLDOWN_MS = 30_000;

export interface FountainStore {
  /** True once the player has seen the full welcome cinematic. */
  hasMet: boolean;
  /** Total wishes granted by the fountain. */
  wishCount: number;
  /** Epoch ms of the last wish grant (for cooldown). 0 if never. */
  lastWishAt: number;
  /** Mark the fountain as met (welcome played). */
  markMet: () => void;
  /**
   * Roll + record a wish. Returns the outcome so the caller can credit
   * tokens and show feedback. Does NOT enforce cooldown — the caller should
   * call `canWish()` first.
   */
  grantWish: () => WishOutcome;
  /** Whether a wish is available right now (cooldown elapsed or first time). */
  canWish: () => boolean;
  /** Milliseconds remaining until the next wish is available. */
  cooldownRemaining: () => number;
  reset: () => void;
}

export const useFountainStore = create<FountainStore>((set, get) => ({
  hasMet: false,
  wishCount: 0,
  lastWishAt: 0,

  markMet: () => set({ hasMet: true }),

  grantWish: () => {
    const outcome = rollWish();
    set((state) => ({
      wishCount: state.wishCount + 1,
      lastWishAt: Date.now(),
      hasMet: true,
    }));
    return outcome;
  },

  canWish: () => {
    const { lastWishAt, wishCount } = get();
    if (wishCount === 0) return true;
    return Date.now() - lastWishAt >= WISH_COOLDOWN_MS;
  },

  cooldownRemaining: () => {
    const { lastWishAt, wishCount } = get();
    if (wishCount === 0) return 0;
    const remaining = WISH_COOLDOWN_MS - (Date.now() - lastWishAt);
    return Math.max(0, remaining);
  },

  reset: () => set({ hasMet: false, wishCount: 0, lastWishAt: 0 }),
}));

export default useFountainStore;
