/**
 * Fake 5-star reviews for each store.
 * All ratings are 4 or 5 (per Section 4.5.2: fabricated, indistinguishable from real).
 * No "sponsored" or "ad" disclosure labels (per spec).
 *
 * Each store gets 3 reviews with author name, avatar seed, rating, text, and date.
 */

import type { Review } from "@/types";

/* ============================================================================
   Review text bank per category
   ========================================================================== */

const REVIEW_TEXTS: Record<string, string[]> = {
  fashion: [
    "Genuinely the softest fabric I have ever worn. Worth every token.",
    "Staff styled me in 5 minutes and I left feeling like a new person.",
    "The cut is impeccable. I get compliments every time I wear it.",
  ],
  tech: [
    "Set up in under a minute and the glow is unreal. Obsessed.",
    "Battery lasts way longer than advertised. Total sleeper hit.",
    "Build quality feels twice the price. Cannot put it down.",
  ],
  accessories: [
    "Dainty but statement. Goes with literally everything I own.",
    "The clasp is magnetic and I am never going back. Genius detail.",
    "People keep asking where I got it. I just smile.",
  ],
  lifestyle: [
    "My apartment finally feels like a sanctuary. The scent lingers perfectly.",
    "Packed with care, arrived in 2 days. The linen is buttery soft.",
    "It became the centerpiece of my living room instantly.",
  ],
  food: [
    "The latte art alone is worth the trip. Flavor is unreal.",
    "Best omakase I have had this year, no contest.",
    "Juicy, generous portions, and the combo deal is a steal.",
  ],
};

const AUTHOR_NAMES = [
  "Aria K.",
  "Noah L.",
  "Maya R.",
  "Theo S.",
  "Jasmine W.",
  "Kai M.",
  "Iris P.",
  "Leo T.",
  "Sana D.",
  "Felix O.",
  "Yuki H.",
  "Mira B.",
  "Eli V.",
  "Nadia F.",
  "Owen G.",
];

const DATES = [
  "2 days ago",
  "5 days ago",
  "1 week ago",
  "2 weeks ago",
  "3 weeks ago",
];

/* ============================================================================
   Deterministic generator
   ========================================================================== */

// Stable PRNG (mulberry32) so reviews are identical across reloads and tests.
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function reviewsForStore(storeId: string): Review[] {
  const seed = hashString(storeId);
  const rng = mulberry32(seed);

  // Each store belongs to a category we infer from storeId prefix.
  // To avoid coupling this module to mallData, we pass the category via a lookup.
  const category = storeCategory(storeId);
  const texts = REVIEW_TEXTS[category] ?? REVIEW_TEXTS.fashion;

  const reviews: Review[] = [];
  for (let i = 0; i < 3; i++) {
    const authorIdx = Math.floor(rng() * AUTHOR_NAMES.length);
    const dateIdx = Math.floor(rng() * DATES.length);
    const textIdx = (i + Math.floor(rng() * texts.length)) % texts.length;
    // 85% five-star, 15% four-star per spec distribution
    const rating = rng() < 0.85 ? 5 : 4;
    reviews.push({
      id: `${storeId}-review-${i + 1}`,
      authorName: AUTHOR_NAMES[authorIdx],
      avatarSeed: `${storeId}-${authorIdx}`,
      rating,
      text: texts[textIdx],
      date: DATES[dateIdx],
    });
  }
  return reviews;
}

/** Category lookup by store id. Mirrors store ids in mallData.ts. */
function storeCategory(storeId: string): string {
  if (storeId.includes("bloom")) return "fashion";
  if (storeId.includes("pulse")) return "tech";
  if (storeId.includes("technova")) return "tech";
  if (storeId.includes("chrome")) return "accessories";
  if (storeId.includes("prism")) return "accessories";
  if (storeId.includes("lumiere")) return "lifestyle";
  if (storeId.includes("maison")) return "lifestyle";
  if (storeId.includes("murky")) return "lifestyle";
  if (storeId.includes("cafe")) return "food";
  if (storeId.includes("sushi")) return "food";
  if (storeId.includes("burger")) return "food";
  return "fashion";
}

export { reviewsForStore };
