import type { TokenPack } from "@/types";

/* ============================================================================
   Token pack pricing ladder — decoy pricing + currency obfuscation

   6 packs in a ladder. The $4.99 "Saver" is the deliberate decoy (worst
   value per dollar) making $9.99 "Popular" look like the obvious choice.
   The $49.99 "Whale" has the best per-token rate and is pre-selected by
   default. Prices are mirrored in "gems" at a deliberately non-round
   conversion (~137 gems per $1.99) so users cannot mentally compute the
   real cost.

   The `bonusPercent` is already baked into `tokenAmount` — the crossed-out
   "regular" amount is the pre-bonus size, shown only to amplify the deal.
   ========================================================================== */

export const GEMS_PER_DOLLAR = 69; // 137 gems ≈ $1.99 (non-round on purpose)

function usdToGems(usd: number): number {
  // Deliberately non-round conversion
  return Math.round(usd * GEMS_PER_DOLLAR + (usd % 1 === 0 ? 7 : 3));
}

export const TOKEN_PACKS: TokenPack[] = [
  {
    id: "pack-starter",
    name: "Starter Pack",
    description: "Dip your toes in. Perfect for a quick top-up.",
    tokenAmount: 60,
    price: 0.99,
    gemsPrice: usdToGems(0.99),
    fakeRetailPrice: 2.99,
    bonusPercent: 20,
    firstPurchaseBonus: true,
  },
  {
    id: "pack-mini",
    name: "Mini Pack",
    description: "A little boost when you're running low.",
    tokenAmount: 180,
    price: 2.99,
    gemsPrice: usdToGems(2.99),
    fakeRetailPrice: 5.99,
    bonusPercent: 25,
  },
  {
    id: "pack-saver",
    name: "Saver Pack",
    description: "More tokens, supposedly better value. (It's not.)",
    tokenAmount: 350,
    price: 4.99,
    gemsPrice: usdToGems(4.99),
    fakeRetailPrice: 9.99,
    bonusPercent: 30,
    // Deliberate decoy: worse value per dollar than Mini and Popular
  },
  {
    id: "pack-popular",
    name: "Popular Pack",
    description: "The community favorite. Best bang for your buck.",
    tokenAmount: 800,
    price: 9.99,
    gemsPrice: usdToGems(9.99),
    fakeRetailPrice: 19.99,
    bonusPercent: 50,
    badge: "Most Popular",
  },
  {
    id: "pack-mega",
    name: "Mega Pack",
    description: "Serious tokens for serious shoppers. Includes drip bonus.",
    tokenAmount: 1800,
    price: 19.99,
    gemsPrice: usdToGems(19.99),
    fakeRetailPrice: 39.99,
    bonusPercent: 75,
    badge: "Best Value",
    highlighted: true,
  },
  {
    id: "pack-whale",
    name: "Whale Pack",
    description: "The ultimate token haul. Dominate the leaderboard instantly.",
    tokenAmount: 5000,
    price: 49.99,
    gemsPrice: usdToGems(49.99),
    fakeRetailPrice: 99.99,
    bonusPercent: 100,
    badge: "Whale Tier",
    stockLeft: 3,
  },
];

/** Bonus event multipliers that cycle endlessly (fake "limited time"). */
export const BONUS_EVENT_CYCLE = [30, 50, 75, 100] as const;

/** Duration of each fake bonus event "cycle" in ms (15 minutes). */
export const BONUS_EVENT_DURATION_MS = 15 * 60 * 1000;
