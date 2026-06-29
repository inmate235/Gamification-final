/**
 * Tier definitions, thresholds, and perk configurations for the multi-tier
 * membership system.
 *
 * Four tiers: Bronze, Silver, Gold, Neodymium.
 *
 * Progression is driven by cumulative tokens earned (playerStore.tierXP).
 * Exploration percentage is excluded from the progression score so that a
 * fresh user with baseline exploration (~16% from the revealed entrance
 * zone) is not auto-promoted past Bronze before earning any tokens
 * (fix-tier-auto-promotion).
 *
 * Thresholds are non-linear (VAL-TIER-018..020):
 *   Bronze -> Silver : fast hook (smallest jump)
 *   Silver -> Gold   : 3x the Bronze->Silver cost
 *   Gold   -> Neodymium : 10x the Silver->Gold cost
 *
 * Perks per tier (VAL-TIER-009..012, VAL-TIER-026):
 *   - Flash sale frequency: Bronze 1/hr, Silver 2/hr, Gold 3/hr, Neodymium unlimited
 *   - Token multiplier: 1x / 1.5x / 2x / 3x
 *   - Map visibility / deal radar / exclusive perks scaling up
 */

import type { Tier } from "@/types";

/* ============================================================================
   Tier ordering
   ========================================================================== */

export const TIER_ORDER: Tier[] = ["bronze", "silver", "gold", "neodymium"];

/* ============================================================================
   Thresholds (combined tierProgressScore required to REACH each tier)
   ========================================================================== */

/**
 * Cumulative tierXP (tokens earned) required to reach each tier.
 *
 *   Bronze     : 0   (starting tier)
 *   Silver     : 12  (fast hook — reachable within the first ~18 min)
 *   Gold       : 48  (Silver->Gold delta = 36 = 3x the Bronze->Silver delta of 12)
 *   Neodymium  : 408 (Gold->Neodymium delta = 360 = 10x the Silver->Gold delta of 36)
 *
 * These satisfy:
 *   (Gold - Silver) >= 3 * (Silver - Bronze)  -> 36 >= 3 * 12 = 36 ✓
 *   (Neodymium - Gold) >= 10 * (Gold - Silver) -> 360 >= 10 * 36 = 360 ✓
 */
export const TIER_THRESHOLDS: Record<Tier, number> = {
  bronze: 0,
  silver: 12,
  gold: 48,
  neodymium: 408,
};

/* ============================================================================
   Tier visual identity (mirrors design-system.md tier colors)
   ========================================================================== */

export interface TierVisual {
  color: string;
  glow: string;
  label: string;
  /** Short tagline shown in celebrations / perks panel. */
  tagline: string;
  /** Hero image URL for the tier-upgrade celebration popup. */
  imageUrl: string;
}

export const TIER_VISUALS: Record<Tier, TierVisual> = {
  bronze: {
    color: "#b87333",
    glow: "0 0 12px rgba(184, 115, 51, 0.3)",
    label: "Bronze",
    tagline: "Where every member begins.",
    imageUrl: "/assets/tiers/bronze.png",
  },
  silver: {
    color: "#c0c0c0",
    glow: "0 0 12px rgba(192, 192, 192, 0.3)",
    label: "Silver",
    tagline: "Sharper perks, steadier rewards.",
    imageUrl: "/assets/tiers/silver.png",
  },
  gold: {
    color: "#d4af37",
    glow: "0 0 16px rgba(212, 175, 55, 0.4)",
    label: "Gold",
    tagline: "The preferred inner circle.",
    imageUrl: "/assets/tiers/gold.png",
  },
  neodymium: {
    color: "#9d7fdb",
    glow: "0 0 20px rgba(157, 127, 219, 0.5)",
    label: "Neodymium",
    tagline: "Rare earth. Rarer access.",
    imageUrl: "/assets/tiers/neodymium.png",
  },
};

/* ============================================================================
   Perks
   ========================================================================== */

/**
 * Flash sale frequency cap per hour per tier.
 * Neodymium is unlimited (represented as Infinity).
 */
export const TIER_FLASH_SALE_FREQ: Record<Tier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  neodymium: Infinity,
};

/** Token earn-rate multiplier per tier (mirrors TIER_MULTIPLIERS). */
export const TIER_TOKEN_MULTIPLIER: Record<Tier, number> = {
  bronze: 1,
  silver: 1.5,
  gold: 2,
  neodymium: 3,
};

export interface TierPerkLine {
  /** Stable id for the perk line. */
  id: string;
  /** Phosphor-style icon key (consumed by the perks panel). */
  icon: string;
  /** Human-readable label. */
  label: string;
  /** Value string shown to the user. */
  value: string;
  /** True when this perk is exclusive to Neodymium (VAL-TIER-026). */
  neodymiumExclusive?: boolean;
}

export interface TierPerkSet {
  flashSaleFrequency: string;
  tokenMultiplier: string;
  mapVisibility: string;
  dealRadar: string;
  /** Additional exclusive perks (Neodymium only). */
  exclusives: TierPerkLine[];
}

export const TIER_PERKS: Record<Tier, TierPerkSet> = {
  bronze: {
    flashSaleFrequency: "1 flash sale / hour",
    tokenMultiplier: "1x tokens",
    mapVisibility: "Basic map access",
    dealRadar: "Not included",
    exclusives: [],
  },
  silver: {
    flashSaleFrequency: "2 flash sales / hour",
    tokenMultiplier: "1.5x tokens",
    mapVisibility: "Deal radar — nearby deals highlighted",
    dealRadar: "Deal radar active",
    exclusives: [],
  },
  gold: {
    flashSaleFrequency: "3 flash sales / hour",
    tokenMultiplier: "2x tokens",
    mapVisibility: "Early access to map events",
    dealRadar: "Deal radar + priority alerts",
    exclusives: [],
  },
  neodymium: {
    flashSaleFrequency: "Unlimited flash sales",
    tokenMultiplier: "3x tokens",
    mapVisibility: "Exclusive hidden zones revealed",
    dealRadar: "Deal radar + priority alerts",
    exclusives: [
      {
        id: "neo-infinite-sugar",
        icon: "Lightning",
        label: "Infinite Sugar Rush",
        value: "Unlimited refills at the Sugar Station",
        neodymiumExclusive: true,
      },
      {
        id: "neo-priority-wheel",
        icon: "CircleNotch",
        label: "Priority spinning wheel",
        value: "Elevated win rate on every spin",
        neodymiumExclusive: true,
      },
      {
        id: "neo-concierge",
        icon: "Sparkle",
        label: "Concierge reviews",
        value: "Hand-curated picks for your taste",
        neodymiumExclusive: true,
      },
      {
        id: "neo-hidden-zones",
        icon: "MapTrifold",
        label: "Hidden zones",
        value: "Members-only areas of the mall",
        neodymiumExclusive: true,
      },
    ],
  },
};

/* ============================================================================
   Trial perks (endowment effect) — granted at onboarding, expire
   ========================================================================== */

import type { Perk } from "@/types";

/**
 * Trial perks granted at the end of onboarding so the user experiences the
 * higher-tier perks (endowment effect). They expire after
 * `TRIAL_PERK_DURATION_MS`, after which the user is downgraded to their
 * real (Bronze) perks and feels the loss.
 */
export const TRIAL_PERK_DURATION_MS = 3 * 60 * 1000; // 3 minutes
/** When this much time remains, the expiry warning is shown (VAL-TIER-016). */
export const TRIAL_PERK_WARNING_MS = 60 * 1000; // 1 minute

/**
 * Build the set of trial perks granted at onboarding. Each perk has an expiry
 * timestamp computed from `now`.
 */
export function buildTrialPerks(now: number = Date.now()): Perk[] {
  const expiresAt = now + TRIAL_PERK_DURATION_MS;
  return [
    {
      id: "trial-deal-radar",
      name: "Deal Radar (Trial)",
      description: "See nearby deals highlighted on the map.",
      type: "trial",
      expiresAt,
    },
    {
      id: "trial-double-tokens",
      name: "Double Tokens (Trial)",
      description: "Earn 2x tokens on every action.",
      type: "trial",
      expiresAt,
    },
    {
      id: "trial-free-sugar",
      name: "Free Sugar Rush (Trial)",
      description: "One free hyper-consumable from the Sugar Station.",
      type: "trial",
      expiresAt,
    },
  ];
}
