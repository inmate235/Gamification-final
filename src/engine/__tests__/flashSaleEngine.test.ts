import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getPreferredCategory,
  saleProbabilityForSession,
  proximityCandidateStores,
  selectProximityStore,
  triggerProximityFlashSale,
  buildAndPushSale,
  dismissFlashSale,
  expireFlashSale,
  tickFlashSaleTimers,
  markRefractory,
  isRefractory,
  clearRefractory,
  getRefractoryMap,
  resetFlashSaleEngine,
  SYNTHETIC_TICK_MS,
  REFRACTORY_MS,
} from "@/engine/flashSaleEngine";
import { useEconomyStore } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { getStoreById, ZONE_ENTRANCE } from "@/data/mallData";

describe("flashSaleEngine", () => {
  beforeEach(() => {
    useEconomyStore.getState().reset();
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
    useSessionStore.getState().reset();
    useUIStore.getState().reset();
    resetFlashSaleEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* --- Personalization --- */

  it("getPreferredCategory maps survey style answers to store categories", () => {
    expect(getPreferredCategory({ style: "bold" })).toBe("tech");
    expect(getPreferredCategory({ style: "classic" })).toBe("fashion");
    expect(getPreferredCategory({ style: "trendy" })).toBe("accessories");
    expect(getPreferredCategory({ style: "cozy" })).toBe("food");
  });

  it("getPreferredCategory returns null when no style answer", () => {
    expect(getPreferredCategory({})).toBeNull();
    expect(getPreferredCategory({ social: "friends" })).toBeNull();
  });

  /* --- Probability curve --- */

  it("saleProbabilityForSession increases with time-in-mall", () => {
    const early = saleProbabilityForSession(0);
    const mid = saleProbabilityForSession(8);
    const late = saleProbabilityForSession(15);
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(mid);
  });

  it("saleProbabilityForSession is capped at a maximum", () => {
    const huge = saleProbabilityForSession(9999);
    const atCap = saleProbabilityForSession(15);
    expect(huge).toBeLessThanOrEqual(atCap + 1e-9);
    expect(huge).toBe(atCap);
  });

  /* --- Proximity candidates --- */

  it("proximityCandidateStores returns revealed stores in current + adjacent zones", () => {
    // Player starts at Entrance (revealed). Adjacent East/West wings are
    // fogged, so only Entrance stores (Bloom, Pulse) are candidates.
    const candidates = proximityCandidateStores(ZONE_ENTRANCE, {
      "zone-entrance": true,
      "zone-east-wing": false,
      "zone-west-wing": false,
      "zone-central-plaza": false,
      "zone-food-court": false,
    });
    const ids = candidates.map((s) => s.id).sort();
    expect(ids).toEqual(["store-bloom", "store-pulse"]);
  });

  it("proximityCandidateStores includes adjacent revealed zones", () => {
    const candidates = proximityCandidateStores(ZONE_ENTRANCE, {
      "zone-entrance": true,
      "zone-east-wing": true,
      "zone-west-wing": false,
      "zone-central-plaza": false,
      "zone-food-court": false,
    });
    // Entrance (2) + East Wing (3: TechNova, Chrome, Prism) = 5
    expect(candidates).toHaveLength(5);
  });

  /* --- Store selection --- */

  it("selectProximityStore prefers the user's preferred category", () => {
    usePlayerStore.getState().setSurveyAnswers({ style: "bold" }); // tech
    const fog = {
      "zone-entrance": true,
      "zone-east-wing": true,
      "zone-west-wing": true,
      "zone-central-plaza": false,
      "zone-food-court": false,
    };
    // Force deterministic pick: always index 0 of the filtered list.
    const rng = vi.spyOn(Math, "random").mockReturnValue(0);
    const store = selectProximityStore(ZONE_ENTRANCE, fog, "tech");
    expect(store?.category).toBe("tech");
    rng.mockRestore();
  });

  it("selectProximityStore excludes refractory stores", () => {
    const fog = {
      "zone-entrance": true,
      "zone-east-wing": false,
      "zone-west-wing": false,
      "zone-central-plaza": false,
      "zone-food-court": false,
    };
    // Mark both entrance stores refractory.
    markRefractory("store-bloom");
    markRefractory("store-pulse");
    const store = selectProximityStore(ZONE_ENTRANCE, fog, null);
    expect(store).toBeNull();
  });

  it("isRefractory respects the time window", () => {
    markRefractory("store-bloom", 1000, 1000);
    expect(isRefractory("store-bloom", 1500)).toBe(true);
    expect(isRefractory("store-bloom", 2001)).toBe(false);
  });

  /* --- triggerProximityFlashSale --- */

  it("triggerProximityFlashSale creates a personalized, deficit-priced sale when probability passes", () => {
    usePlayerStore.getState().setSurveyAnswers({ style: "classic" }); // fashion
    usePlayerStore.getState().addTokens(4);
    // Force the probability roll to pass (0 <= prob) and deterministic store pick.
    const rng = vi.spyOn(Math, "random");
    rng.mockReturnValueOnce(0); // roll <= prob -> trigger
    rng.mockReturnValue(0); // pickRandom index 0
    const sale = triggerProximityFlashSale();
    expect(sale).not.toBeNull();
    expect(useEconomyStore.getState().flashSales).toHaveLength(1);
    // Deficit price: balance(4) + 2..3 = 6 or 7
    expect(sale!.tokenCost).toBeGreaterThanOrEqual(6);
    expect(sale!.tokenCost).toBeLessThanOrEqual(7);
    // Synthetic timer set.
    expect(sale!.syntheticTickMs).toBe(SYNTHETIC_TICK_MS);
    // Social proof positive integer.
    expect(sale!.socialProof).toBeGreaterThan(0);
    // Item description non-empty.
    expect(sale!.itemDescription!.length).toBeGreaterThan(0);
  });

  it("triggerProximityFlashSale returns null when probability roll fails", () => {
    const rng = vi.spyOn(Math, "random").mockReturnValue(0.999);
    const sale = triggerProximityFlashSale();
    expect(sale).toBeNull();
    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
    rng.mockRestore();
  });

  it("triggerProximityFlashSale returns null when all nearby stores are refractory", () => {
    markRefractory("store-bloom");
    markRefractory("store-pulse");
    const rng = vi.spyOn(Math, "random").mockReturnValue(0); // pass roll
    const sale = triggerProximityFlashSale();
    expect(sale).toBeNull();
    rng.mockRestore();
  });

  /* --- buildAndPushSale --- */

  it("buildAndPushSale marks personalized=true when category matches preference", () => {
    const store = getStoreById("store-bloom")!; // fashion
    const sale = buildAndPushSale(store, "fashion");
    expect(sale.personalized).toBe(true);
  });

  it("buildAndPushSale marks personalized=false when category does not match", () => {
    const store = getStoreById("store-bloom")!; // fashion
    const sale = buildAndPushSale(store, "tech");
    expect(sale.personalized).toBe(false);
  });

  /* --- dismiss / expire --- */

  it("dismissFlashSale removes the sale and marks the store refractory", () => {
    const store = getStoreById("store-bloom")!;
    const sale = buildAndPushSale(store, null);
    useUIStore.getState().showOverlay("flash-sale", sale);
    dismissFlashSale(sale.id);
    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
    expect(useUIStore.getState().activeOverlay).toBe("none");
    expect(getRefractoryMap()[store.id]).toBeGreaterThan(0);
  });

  it("expireFlashSale removes the sale without charging or refractory", () => {
    const store = getStoreById("store-bloom")!;
    usePlayerStore.getState().addTokens(5);
    const balanceBefore = usePlayerStore.getState().tokens;
    const sale = buildAndPushSale(store, null);
    useUIStore.getState().showOverlay("flash-sale", sale);
    expireFlashSale(sale.id);
    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
    expect(usePlayerStore.getState().tokens).toBe(balanceBefore);
    expect(getRefractoryMap()[store.id]).toBeUndefined();
  });

  /* --- Constants --- */

  it("synthetic tick is slower than a real second", () => {
    expect(SYNTHETIC_TICK_MS).toBeGreaterThan(1000);
  });

  it("refractory window is a positive duration", () => {
    expect(REFRACTORY_MS).toBeGreaterThan(0);
  });

  it("clearRefractory empties the registry", () => {
    markRefractory("store-bloom");
    expect(Object.keys(getRefractoryMap()).length).toBeGreaterThan(0);
    clearRefractory();
    expect(Object.keys(getRefractoryMap()).length).toBe(0);
  });

  /* --- Background timer expiry (tickFlashSaleTimers) --- */

  it("tickFlashSaleTimers decrements countdown for all active sales", () => {
    const storeA = getStoreById("store-bloom")!;
    const storeB = getStoreById("store-technova")!;
    const saleA = buildAndPushSale(storeA, null);
    const saleB = buildAndPushSale(storeB, null);
    const initialA = saleA.countdownSeconds;
    const initialB = saleB.countdownSeconds;

    // Advance by one synthetic tick (1400ms). Both sales should decrement.
    const now = (saleA.createdAt ?? Date.now()) + SYNTHETIC_TICK_MS + 1;
    tickFlashSaleTimers(now);

    const updated = useEconomyStore.getState().flashSales;
    const a = updated.find((s) => s.id === saleA.id)!;
    const b = updated.find((s) => s.id === saleB.id)!;
    expect(a.countdownSeconds).toBe(initialA - 1);
    expect(b.countdownSeconds).toBe(initialB - 1);
  });

  it("tickFlashSaleTimers expires a sale when its timer reaches zero even if overlay is not open", () => {
    const store = getStoreById("store-bloom")!;
    const sale = buildAndPushSale(store, null);
    const createdAt = sale.createdAt ?? Date.now();
    // The sale was never shown (overlay stays "none") — this is the core
    // blocking issue: hidden pending sales must age out in background.
    expect(useUIStore.getState().activeOverlay).toBe("none");

    // Advance past the full countdown duration.
    const now = createdAt + sale.countdownSeconds * SYNTHETIC_TICK_MS + 1;
    tickFlashSaleTimers(now);

    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
    // No charge on natural expiry.
    expect(getRefractoryMap()[store.id]).toBeUndefined();
  });

  it("tickFlashSaleTimers expires multiple sales independently", () => {
    const storeA = getStoreById("store-bloom")!;
    const storeB = getStoreById("store-technova")!;
    const saleA = buildAndPushSale(storeA, null);
    const saleB = buildAndPushSale(storeB, null);

    // Give saleB a much longer countdown so only saleA expires at this point.
    useEconomyStore.setState({
      flashSales: useEconomyStore.getState().flashSales.map((s) =>
        s.id === saleB.id
          ? { ...s, countdownSeconds: 9999, initialCountdownSeconds: 9999 }
          : s
      ),
    });

    // Expire only saleA (advance past its duration but not saleB's).
    const now = (saleA.createdAt ?? Date.now()) + saleA.countdownSeconds * SYNTHETIC_TICK_MS + 1;
    tickFlashSaleTimers(now);

    const remaining = useEconomyStore.getState().flashSales;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(saleB.id);
  });

  it("expireFlashSale does not hide the overlay when expiring a non-shown sale", () => {
    const storeA = getStoreById("store-bloom")!;
    const storeB = getStoreById("store-technova")!;
    const saleA = buildAndPushSale(storeA, null);
    const saleB = buildAndPushSale(storeB, null);

    // Show saleB in the overlay.
    useUIStore.getState().showOverlay("flash-sale", saleB);
    expect(useUIStore.getState().activeOverlay).toBe("flash-sale");

    // Expire saleA (which is NOT shown). The overlay for saleB must remain.
    expireFlashSale(saleA.id);

    expect(useEconomyStore.getState().flashSales).toHaveLength(1);
    expect(useEconomyStore.getState().flashSales[0]!.id).toBe(saleB.id);
    expect(useUIStore.getState().activeOverlay).toBe("flash-sale");
  });

  it("expireFlashSale hides the overlay when expiring the shown sale", () => {
    const store = getStoreById("store-bloom")!;
    const sale = buildAndPushSale(store, null);
    useUIStore.getState().showOverlay("flash-sale", sale);

    expireFlashSale(sale.id);

    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });

  it("tickFlashSaleTimers is a no-op when there are no active sales", () => {
    expect(tickFlashSaleTimers()).toEqual([]);
    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
  });
});
