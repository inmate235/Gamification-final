/**
 * Static mall data: 5 zones and 11 stores.
 * Layout per architecture.md:
 *
 *                 ZONE 5: FOOD COURT (top)
 *                       |
 *                 ZONE 4: CENTRAL PLAZA (center-upper)
 *                  /              \
 *   ZONE 3: WEST WING (left)   ZONE 2: EAST WING (right)
 *                  \              /
 *                 ZONE 1: ENTRANCE (bottom)
 *
 * Adjacency graph:
 *   Z1 <-> Z2, Z1 <-> Z3, Z2 <-> Z4, Z3 <-> Z4, Z4 <-> Z5
 *
 * Store distribution:
 *   Z1: Bloom, Pulse, Murky Playground (3)
 *   Z2: TechNova, Chrome, Prism (3)
 *   Z3: Lumiere, Maison (2)
 *   Z4: (no stores - spinning wheel + leaderboard station)
 *   Z5: Cafe Nuit, Sushi Yuki, Burger Hex (3)
 *
 * SVG coordinate system is 0-1000 wide x 0-1200 tall.
 */

import type { Zone, Store } from "@/types";
import { reviewsForStore } from "@/data/reviewData";

/* ============================================================================
   Zones
   ========================================================================== */

export const ZONE_ENTRANCE = "zone-entrance";
export const ZONE_EAST_WING = "zone-east-wing";
export const ZONE_WEST_WING = "zone-west-wing";
export const ZONE_CENTRAL_PLAZA = "zone-central-plaza";
export const ZONE_FOOD_COURT = "zone-food-court";

export const zones: Zone[] = [
  {
    id: ZONE_ENTRANCE,
    name: "Entrance",
    description: "The grand entry. Always lit, always welcoming.",
    // Bottom band spanning most of the width
    polygonPoints:
      "150,1000 850,1000 850,1180 150,1180",
    center: { x: 500, y: 1090 },
    adjacentZoneIds: [ZONE_EAST_WING, ZONE_WEST_WING],
    revealed: true, // Entrance is always revealed on first visit
  },
  {
    id: ZONE_EAST_WING,
    name: "East Wing",
    description: "Glowing tech boutiques and accessory alcoves.",
    // Right column above entrance
    polygonPoints:
      "560,640 850,640 850,980 560,980",
    center: { x: 705, y: 810 },
    adjacentZoneIds: [ZONE_ENTRANCE, ZONE_CENTRAL_PLAZA],
    revealed: false,
  },
  {
    id: ZONE_WEST_WING,
    name: "West Wing",
    description: "Lifestyle ateliers and curated living spaces.",
    // Left column above entrance
    polygonPoints:
      "150,640 440,640 440,980 150,980",
    center: { x: 295, y: 810 },
    adjacentZoneIds: [ZONE_ENTRANCE, ZONE_CENTRAL_PLAZA],
    revealed: false,
  },
  {
    id: ZONE_CENTRAL_PLAZA,
    name: "Central Plaza",
    description:
      "The crossroads. Spinning wheel station and the leaderboard throne.",
    // Middle band connecting wings to food court
    polygonPoints:
      "300,360 700,360 700,620 300,620",
    center: { x: 500, y: 490 },
    adjacentZoneIds: [ZONE_EAST_WING, ZONE_WEST_WING, ZONE_FOOD_COURT],
    revealed: false,
  },
  {
    id: ZONE_FOOD_COURT,
    name: "Food Court",
    description:
      "The furthest hall. Rumored to hold a secret token among the steam.",
    // Top band
    polygonPoints:
      "300,60 700,60 700,340 300,340",
    center: { x: 500, y: 200 },
    adjacentZoneIds: [ZONE_CENTRAL_PLAZA],
    revealed: false,
  },
];

/* ============================================================================
   Stores
   ========================================================================== */

export const STORE_BLOOM = "store-bloom";
export const STORE_PULSE = "store-pulse";
export const STORE_TECHNOVA = "store-technova";
export const STORE_CHROME = "store-chrome";
export const STORE_PRISM = "store-prism";
export const STORE_LUMIERE = "store-lumiere";
export const STORE_MAISON = "store-maison";
export const STORE_CAFE_NUIT = "store-cafe-nuit";
export const STORE_SUSHI_YUKI = "store-sushi-yuki";
export const STORE_BURGER_HEX = "store-burger-hex";
export const STORE_MURKY_PLAYGROUND = "store-murky-playground";

export const stores: Store[] = [
  // Zone 1: Entrance
  {
    id: STORE_BLOOM,
    name: "Bloom",
    category: "fashion",
    zoneId: ZONE_ENTRANCE,
    position: { x: 320, y: 1060 },
    icon: "Hanger",
    reviews: reviewsForStore(STORE_BLOOM),
    visitorCount: 41, // amplified from a real ~3
    dealInfo: {
      title: "Spring Capsule",
      discount: "30% off",
      tokenCost: 0, // deficit-priced at runtime
      countdownSeconds: 0,
      personalized: false,
    },
  },
  {
    id: STORE_PULSE,
    name: "Pulse",
    category: "tech",
    zoneId: ZONE_ENTRANCE,
    position: { x: 680, y: 1060 },
    icon: "DeviceMobileCamera",
    reviews: reviewsForStore(STORE_PULSE),
    visitorCount: 38,
    dealInfo: {
      title: "Glow Earbuds",
      discount: "25% off",
      tokenCost: 0,
      countdownSeconds: 0,
      personalized: false,
    },
  },
  // Zone 1: Entrance — Murky Playground (child drop-off service)
  {
    id: STORE_MURKY_PLAYGROUND,
    name: "Murky Playground",
    category: "lifestyle",
    zoneId: ZONE_ENTRANCE,
    position: { x: 500, y: 1140 },
    icon: "PuzzlePiece",
    reviews: reviewsForStore(STORE_MURKY_PLAYGROUND),
    visitorCount: 15,
    dealInfo: {
      title: "Drop & Shop — 2 Hrs Free Childcare",
      discount: "Free drop-off",
      tokenCost: 0,
      countdownSeconds: 0,
      personalized: false,
    },
  },
  // Zone 2: East Wing
  {
    id: STORE_TECHNOVA,
    name: "TechNova",
    category: "tech",
    zoneId: ZONE_EAST_WING,
    position: { x: 640, y: 760 },
    icon: "Cpu",
    reviews: reviewsForStore(STORE_TECHNOVA),
    visitorCount: 52,
    dealInfo: {
      title: "Neon Keyboard",
      discount: "40% off",
      tokenCost: 0,
      countdownSeconds: 0,
      personalized: false,
    },
  },
  {
    id: STORE_CHROME,
    name: "Chrome",
    category: "accessories",
    zoneId: ZONE_EAST_WING,
    position: { x: 760, y: 800 },
    icon: "Watch",
    reviews: reviewsForStore(STORE_CHROME),
    visitorCount: 27,
    dealInfo: {
      title: "Mesh Band",
      discount: "20% off",
      tokenCost: 0,
      countdownSeconds: 0,
      personalized: false,
    },
  },
  {
    id: STORE_PRISM,
    name: "Prism",
    category: "accessories",
    zoneId: ZONE_EAST_WING,
    position: { x: 700, y: 870 },
    icon: "Sunglasses",
    reviews: reviewsForStore(STORE_PRISM),
    visitorCount: 33,
    dealInfo: {
      title: "Iris Lenses",
      discount: "35% off",
      tokenCost: 0,
      countdownSeconds: 0,
      personalized: false,
    },
  },
  // Zone 3: West Wing
  {
    id: STORE_LUMIERE,
    name: "Lumiere",
    category: "lifestyle",
    zoneId: ZONE_WEST_WING,
    position: { x: 240, y: 760 },
    icon: "Lamp",
    reviews: reviewsForStore(STORE_LUMIERE),
    visitorCount: 44,
    dealInfo: {
      title: "Amber Candle",
      discount: "30% off",
      tokenCost: 0,
      countdownSeconds: 0,
      personalized: false,
    },
  },
  {
    id: STORE_MAISON,
    name: "Maison",
    category: "lifestyle",
    zoneId: ZONE_WEST_WING,
    position: { x: 350, y: 850 },
    icon: "House",
    reviews: reviewsForStore(STORE_MAISON),
    visitorCount: 29,
    dealInfo: {
      title: "Linen Throw",
      discount: "25% off",
      tokenCost: 0,
      countdownSeconds: 0,
      personalized: false,
    },
  },
  // Zone 5: Food Court
  {
    id: STORE_CAFE_NUIT,
    name: "Cafe Nuit",
    category: "food",
    zoneId: ZONE_FOOD_COURT,
    position: { x: 380, y: 180 },
    icon: "Coffee",
    reviews: reviewsForStore(STORE_CAFE_NUIT),
    visitorCount: 61,
    dealInfo: {
      title: "Midnight Latte",
      discount: "Buy 1 Get 1",
      tokenCost: 0,
      countdownSeconds: 0,
      personalized: false,
    },
  },
  {
    id: STORE_SUSHI_YUKI,
    name: "Sushi Yuki",
    category: "food",
    zoneId: ZONE_FOOD_COURT,
    position: { x: 500, y: 160 },
    icon: "Fish",
    reviews: reviewsForStore(STORE_SUSHI_YUKI),
    visitorCount: 73,
    dealInfo: {
      title: "Omakase Box",
      discount: "30% off",
      tokenCost: 0,
      countdownSeconds: 0,
      personalized: false,
    },
  },
  {
    id: STORE_BURGER_HEX,
    name: "Burger Hex",
    category: "food",
    zoneId: ZONE_FOOD_COURT,
    position: { x: 620, y: 200 },
    icon: "Hamburger",
    reviews: reviewsForStore(STORE_BURGER_HEX),
    visitorCount: 58,
    dealInfo: {
      title: "Hex Combo",
      discount: "35% off",
      tokenCost: 0,
      countdownSeconds: 0,
      personalized: false,
    },
  },
];

/* ============================================================================
   Helpers
   ========================================================================== */

/** Map of zoneId -> stores in that zone. */
export const storesByZone: Record<string, Store[]> = stores.reduce(
  (acc, store) => {
    (acc[store.zoneId] ??= []).push(store);
    return acc;
  },
  {} as Record<string, Store[]>
);

/** Lookup a zone by id. Returns undefined if not found. */
export function getZoneById(zoneId: string): Zone | undefined {
  return zones.find((z) => z.id === zoneId);
}

/** Lookup a store by id. Returns undefined if not found. */
export function getStoreById(storeId: string): Store | undefined {
  return stores.find((s) => s.id === storeId);
}

/** Returns true if the two zone ids are adjacent per the static graph. */
export function areZonesAdjacent(zoneA: string, zoneB: string): boolean {
  const a = getZoneById(zoneA);
  if (!a) return false;
  return a.adjacentZoneIds.includes(zoneB);
}

/**
 * Returns the corridor path (as SVG coordinate points) the player avatar
 * should trace when moving from `fromZoneId` to `toZoneId`.
 *
 * The path is: [fromCenter, corridorMidpoint, toCenter]. The midpoint sits
 * on the corridor between the two zone centers so the avatar visibly follows
 * the corridor rather than cutting a straight diagonal through walls.
 */
export function getCorridorPath(
  fromZoneId: string,
  toZoneId: string
): { x: number; y: number }[] {
  const from = getZoneById(fromZoneId);
  const to = getZoneById(toZoneId);
  if (!from || !to) {
    return [from?.center ?? { x: 500, y: 1090 }, to?.center ?? { x: 500, y: 1090 }];
  }
  const mid = {
    x: Math.round((from.center.x + to.center.x) / 2),
    y: Math.round((from.center.y + to.center.y) / 2),
  };
  return [from.center, mid, to.center];
}

/* ============================================================================
   Reward constants
   ========================================================================== */

/** Base token reward granted when a zone is first revealed (exploration). */
export const EXPLORE_REWARD = 3;
/** Bonus token granted on the player's very first move from the entrance. */
export const FIRST_TOKEN_BONUS = 1;
/** Large reward for reaching the furthest zone (Food Court secret token). */
export const FOOD_COURT_SECRET_REWARD = 10;
