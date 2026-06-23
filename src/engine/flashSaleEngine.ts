/**
 * flashSaleEngine - orchestrates the flash sale system.
 *
 * Implements the dark-pattern flash sale mechanic per DECISIONS 4.2.2 and the
 * architecture economyStore.triggerFlashSale path:
 *
 *   - Proximity triggering: sales appear when the player is near a store
 *     (in the player's current zone or an adjacent revealed zone).
 *   - Personalization: the sale's store category matches the user's survey
 *     preference (fashion / tech / food / lifestyle / accessories) derived
 *     from the survey answers.
 *   - Synthetic timers: the countdown ticks slower than real time
 *     (VAL-SALE-006) and may not reflect the true underlying duration.
 *   - Deficit-engineered token cost: balance + 2..3 (VAL-SALE-008) via the
 *     shared `calculateDeficitPrice`.
 *   - Social proof: an amplified "N people viewing this deal" number.
 *   - Refractory period: a dismissed (or claimed) sale's store will not
 *     re-trigger for a cooldown window (VAL-SALE-019).
 *   - Probability increases with time-in-mall (VAL-SALE-014).
 *   - Multiple sales can appear over a session (VAL-SALE-013).
 *   - Expiry never charges tokens (VAL-SALE-020); only "Grab Deal" does.
 *
 * The engine is a thin orchestrator over economyStore.triggerFlashSale /
 * removeFlashSale and playerStore.spendTokens (via tokenEconomy.claimFlashSale),
 * keeping the spending path in the canonical economy store.
 */

import { useEconomyStore, calculateDeficitPrice } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import {
  storesByZone,
  getZoneById,
} from "@/data/mallData";
import type { FlashSale, Store, StoreCategory } from "@/types";

/* ============================================================================
   Constants
   ========================================================================== */

/** Synthetic countdown tick: ~1.4s per displayed "second" (slower than real). */
export const SYNTHETIC_TICK_MS = 1400;

/** Refractory cooldown applied to a store after a sale is dismissed/claimed. */
export const REFRACTORY_MS = 45 * 1000;

/** Minimum scheduler ticks between proximity trigger attempts. */
export const PROXIMITY_CHECK_EVERY_N_TICKS = 2;

/**
 * Base per-check trigger probability at session minute 0. The probability
 * rises with time-in-mall so sales become more frequent later in the session
 * (VAL-SALE-014).
 */
const BASE_PROBABILITY = 0.06;
/** Per-minute probability growth (linear), capped at MAX_PROBABILITY. */
const PROBABILITY_GROWTH_PER_MIN = 0.012;
/** Ceiling for the per-check trigger probability. */
const MAX_PROBABILITY = 0.22;

/** Default synthetic countdown length (displayed seconds). */
const DEFAULT_COUNTDOWN_SECONDS = 90;

/* ============================================================================
   Refractory registry (session-only, module-level)
   ========================================================================== */

/** storeId -> epoch ms until which the store is in refractory. */
let refractoryMap: Record<string, number> = {};

/** Returns the current refractory map (primarily for tests/inspection). */
export function getRefractoryMap(): Record<string, number> {
  return { ...refractoryMap };
}

/** True if `storeId` is currently within its refractory window. */
export function isRefractory(storeId: string, now: number = Date.now()): boolean {
  const until = refractoryMap[storeId];
  return typeof until === "number" && until > now;
}

/** Mark a store refractory for `durationMs` from `now`. */
export function markRefractory(
  storeId: string,
  durationMs: number = REFRACTORY_MS,
  now: number = Date.now()
): void {
  refractoryMap[storeId] = now + durationMs;
}

/** Clear all refractory entries (used on reset / between tests). */
export function clearRefractory(): void {
  refractoryMap = {};
}

/* ============================================================================
   Personalization: survey answers -> preferred store category
   ========================================================================== */

/**
 * Derive the player's preferred store category from their survey answers.
 *
 * The survey's first question (`style`) asks "Which style speaks to you?" with
 * four aesthetic options. We map each aesthetic to a store category so flash
 * sales can be personalized (VAL-SALE-009): a user who picked the tech-leaning
 * aesthetic receives tech-store sales preferentially, etc.
 *
 *   bold    -> tech        (avant-garde, neon, gadgets)
 *   classic -> fashion     (refined apparel)
 *   trendy  -> accessories (fresh, statement pieces)
 *   cozy    -> food        (comfort, cafe indulgence)
 *
 * Returns null when no preference can be derived (e.g. survey unanswered).
 */
export function getPreferredCategory(
  surveyAnswers: Record<string, string>
): StoreCategory | null {
  const style = surveyAnswers.style;
  switch (style) {
    case "bold":
      return "tech";
    case "classic":
      return "fashion";
    case "trendy":
      return "accessories";
    case "cozy":
      return "food";
    default:
      return null;
  }
}

/* ============================================================================
   Probability curve (increases with time-in-mall)
   ========================================================================== */

/**
 * Per-check trigger probability for a proximity flash sale, given the current
 * session minute. Probability rises linearly from BASE_PROBABILITY at minute 0
 * up to MAX_PROBABILITY, so sale frequency is higher later in the session
 * (VAL-SALE-014).
 */
export function saleProbabilityForSession(sessionMinutes: number): number {
  const prob =
    BASE_PROBABILITY + PROBABILITY_GROWTH_PER_MIN * Math.max(0, sessionMinutes);
  return Math.min(MAX_PROBABILITY, prob);
}

/* ============================================================================
   Store selection (proximity + personalization + refractory)
   ========================================================================== */

/**
 * Candidate stores "near" the player: stores in the player's current zone plus
 * stores in adjacent revealed zones. Only revealed zones contribute (a store
 * hidden under fog cannot host a sale the player would understand).
 */
export function proximityCandidateStores(
  playerZoneId: string,
  fogState: Record<string, boolean>
): Store[] {
  const zone = getZoneById(playerZoneId);
  if (!zone) return [];
  const zoneIds = new Set<string>([playerZoneId, ...zone.adjacentZoneIds]);
  const candidates: Store[] = [];
  for (const zid of zoneIds) {
    if (fogState[zid] !== true) continue; // only revealed zones
    const list = storesByZone[zid];
    if (list) candidates.push(...list);
  }
  return candidates;
}

/**
 * Select a store for a proximity flash sale.
 *
 * Preference order:
 *   1. Stores matching the user's preferred survey category (personalization,
 *      VAL-SALE-009) that are not in refractory.
 *   2. Any other non-refractory candidate store.
 *
 * If every candidate is in refractory, returns null (no sale this check).
 * Returns null when there are no proximity candidates at all.
 */
export function selectProximityStore(
  playerZoneId: string,
  fogState: Record<string, boolean>,
  preferredCategory: StoreCategory | null,
  now: number = Date.now()
): Store | null {
  const candidates = proximityCandidateStores(playerZoneId, fogState);
  const available = candidates.filter((s) => !isRefractory(s.id, now));
  if (available.length === 0) return null;

  if (preferredCategory) {
    const preferred = available.filter(
      (s) => s.category === preferredCategory
    );
    if (preferred.length > 0) {
      return pickRandom(preferred);
    }
  }
  return pickRandom(available);
}

/* ============================================================================
   Deal content pool
   ========================================================================== */

interface DealTemplate {
  discount: string;
  percent: number;
  item: string;
}

const DEAL_TEMPLATES: DealTemplate[] = [
  {
    discount: "40% off",
    percent: 40,
    item: "Limited-edition capsule, tonight only.",
  },
  {
    discount: "30% off",
    percent: 30,
    item: "A statement piece at a steal.",
  },
  {
    discount: "Buy 1 Get 1",
    percent: 50,
    item: "Double the indulgence, half the price.",
  },
  {
    discount: "35% off",
    percent: 35,
    item: "Members-only clearance flash.",
  },
  {
    discount: "25% off",
    percent: 25,
    item: "An everyday luxury, briefly within reach.",
  },
  {
    discount: "50% off",
    percent: 50,
    item: "Last unit at this price, claim it now.",
  },
];

/** Category-flavored item descriptions layered on top of the deal template. */
const CATEGORY_ITEMS: Partial<Record<StoreCategory, string[]>> = {
  fashion: ["Silk midi dress", "Tailored overcoat", "Cashmere knit"],
  tech: ["Neon mechanical keyboard", "Wireless earbuds", "Smart ring"],
  food: ["Midnight latte flight", "Omakase box", "Hex combo meal"],
  accessories: ["Iris sunglass lenses", "Mesh watch band", "Leather cardholder"],
  lifestyle: ["Amber candle set", "Linen throw blanket", "Brass desk lamp"],
};

/** Build a personalized item description for a store's category. */
function itemDescriptionFor(store: Store, template: DealTemplate): string {
  const pool = CATEGORY_ITEMS[store.category];
  if (pool && pool.length > 0) {
    const item = pickRandom(pool);
    return `${item} — ${template.item}`;
  }
  return template.item;
}

/* ============================================================================
   Helpers
   ========================================================================== */

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/* ============================================================================
   Public: proximity trigger
   ========================================================================== */

/**
 * Attempt to trigger a proximity flash sale.
 *
 * Rolling a `saleProbabilityForSession(sessionMinutes)` chance, selects a
 * nearby store (personalized + refractory-aware), builds a deficit-priced
 * sale with a synthetic timer and social proof, and pushes it into
 * economyStore.flashSales. Returns the created sale, or null if no sale was
 * triggered this call.
 *
 * Does NOT open the overlay — the caller (EventScheduler / entry button)
 * decides whether to surface it immediately. This keeps the engine pure-ish
 * and reusable.
 */
export function triggerProximityFlashSale(now: number = Date.now()): FlashSale | null {
  const sessionMinutes = useSessionStore.getState().sessionMinutes;
  const roll = Math.random();
  if (roll > saleProbabilityForSession(sessionMinutes)) {
    return null;
  }

  const map = useMapStore.getState();
  const player = map.playerPosition;
  const preferred = getPreferredCategory(
    usePlayerStore.getState().surveyAnswers
  );
  const store = selectProximityStore(
    player.zoneId,
    map.fogState,
    preferred,
    now
  );
  if (!store) return null;

  return buildAndPushSale(store, preferred);
}

/**
 * Build and push a flash sale for a specific store (used by the proximity
 * trigger and the manual "Deal Radar" entry point). The token cost is frozen
 * at the deficit price (balance + 2..3) so the deal is always just out of
 * reach until the user earns a couple more tokens (VAL-SALE-008).
 */
export function buildAndPushSale(
  store: Store,
  preferredCategory: StoreCategory | null
): FlashSale {
  const balance = usePlayerStore.getState().tokens;
  const tokenCost = calculateDeficitPrice(balance);
  const template = pickRandom(DEAL_TEMPLATES);
  const personalized =
    preferredCategory !== null && store.category === preferredCategory;

  const sale = useEconomyStore.getState().triggerFlashSale({
    storeId: store.id,
    discount: template.discount,
    tokenCost,
    countdownSeconds: DEFAULT_COUNTDOWN_SECONDS,
    personalized,
    itemDescription: itemDescriptionFor(store, template),
    discountPercent: template.percent,
    socialProof: 12 + Math.floor(Math.random() * 60), // 12..71 "viewing"
    syntheticTickMs: SYNTHETIC_TICK_MS,
    createdAt: Date.now(),
  });
  return sale;
}

/* ============================================================================
   Public: dismiss (Maybe Later) -> refractory
   ========================================================================== */

/**
 * Dismiss a flash sale without charging tokens. Removes the sale from the
 * economy store, hides the overlay, and marks the sale's store refractory so
 * an identical sale for that store cannot instantly re-trigger
 * (VAL-SALE-012, VAL-SALE-019).
 */
export function dismissFlashSale(saleId: string): void {
  const sale = useEconomyStore.getState().flashSales.find((s) => s.id === saleId);
  if (sale) {
    markRefractory(sale.storeId);
  }
  useEconomyStore.getState().removeFlashSale(saleId);
  useUIStore.getState().hideOverlay();
}

/* ============================================================================
   Public: expiry (timer reached zero) -> no charge
   ========================================================================== */

/**
 * Expire a flash sale when its synthetic countdown reaches zero. Removes the
 * sale and closes the overlay WITHOUT deducting tokens (VAL-SALE-020). No
 * refractory is applied on natural expiry (only dismissal/claim refractories).
 */
export function expireFlashSale(saleId: string): void {
  useEconomyStore.getState().removeFlashSale(saleId);
  useUIStore.getState().hideOverlay();
}

/* ============================================================================
   Reset (session teardown / tests)
   ========================================================================== */

/** Reset all flash-sale engine session state (refractory registry). */
export function resetFlashSaleEngine(): void {
  clearRefractory();
}

/**
 * Convenience: the list of currently active (non-claimed) flash sales, used by
 * the FlashSale entry button to decide whether to surface a pending deal.
 */
export function activeFlashSales(): FlashSale[] {
  return useEconomyStore.getState().flashSales;
}

const flashSaleEngine = {
  SYNTHETIC_TICK_MS,
  REFRACTORY_MS,
  PROXIMITY_CHECK_EVERY_N_TICKS,
  getRefractoryMap,
  isRefractory,
  markRefractory,
  clearRefractory,
  getPreferredCategory,
  saleProbabilityForSession,
  proximityCandidateStores,
  selectProximityStore,
  triggerProximityFlashSale,
  buildAndPushSale,
  dismissFlashSale,
  expireFlashSale,
  resetFlashSaleEngine,
  activeFlashSales,
};

export default flashSaleEngine;
