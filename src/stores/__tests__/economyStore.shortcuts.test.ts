import { describe, it, expect, beforeEach } from "vitest";
import {
  useEconomyStore,
  calculateDeficitPrice,
} from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { SHORTCUT_AURORA } from "@/data/shortcutData";
import { ZONE_ENTRANCE, ZONE_CENTRAL_PLAZA } from "@/data/mallData";

describe("economyStore shortcuts + deficit spending", () => {
  beforeEach(() => {
    useEconomyStore.getState().reset();
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
  });

  it("seeds 3 shortcuts with only the first frozen at a deficit price", () => {
    const s = useEconomyStore.getState();
    expect(s.shortcuts).toHaveLength(3);
    const active = s.getActiveShortcut();
    expect(active).not.toBeNull();
    expect(active!.unlocked).toBe(false);
    // Active shortcut cost = balance(0) + 2..3
    expect(active!.tokenCost).toBeGreaterThanOrEqual(2);
    expect(active!.tokenCost).toBeLessThanOrEqual(3);
  });

  it("liveDeficitPrice is always balance + 2..3 after refresh", () => {
    usePlayerStore.getState().addTokens(7);
    useEconomyStore.getState().refreshLiveDeficitPrice();
    const p = useEconomyStore.getState().liveDeficitPrice;
    expect(p).toBeGreaterThanOrEqual(9);
    expect(p).toBeLessThanOrEqual(10);
  });

  it("calculateDeficitPrice pure fn returns balance + 2..3", () => {
    for (let i = 0; i < 30; i++) {
      const p = calculateDeficitPrice(4);
      expect(p).toBeGreaterThanOrEqual(6);
      expect(p).toBeLessThanOrEqual(7);
    }
  });

  it("unlockShortcut fails when balance is insufficient", () => {
    const active = useEconomyStore.getState().getActiveShortcut()!;
    const ok = useEconomyStore.getState().unlockShortcut(active.id);
    expect(ok).toBe(false);
    expect(usePlayerStore.getState().tokens).toBe(0);
    expect(useEconomyStore.getState().shortcuts[0]!.unlocked).toBe(false);
  });

  it("unlockShortcut deducts the frozen cost and opens the route when affordable", () => {
    const active = useEconomyStore.getState().getActiveShortcut()!;
    // Earn enough to cover the frozen cost.
    usePlayerStore.getState().addTokens(active.tokenCost);
    const ok = useEconomyStore.getState().unlockShortcut(active.id);
    expect(ok).toBe(true);
    expect(usePlayerStore.getState().tokens).toBe(0);
    expect(
      useEconomyStore.getState().shortcuts.find((s) => s.id === active.id)!.unlocked
    ).toBe(true);
  });

  it("the next shortcut is frozen at the new deficit price after an unlock", () => {
    const first = useEconomyStore.getState().getActiveShortcut()!;
    usePlayerStore.getState().addTokens(first.tokenCost + 5);
    useEconomyStore.getState().unlockShortcut(first.id);
    const next = useEconomyStore.getState().getActiveShortcut();
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe(first.id);
    // Post-unlock balance is 5 -> next cost should be 7..8
    expect(next!.tokenCost).toBeGreaterThanOrEqual(7);
    expect(next!.tokenCost).toBeLessThanOrEqual(8);
  });

  it("unlocked shortcut edges are exposed for map adjacency", () => {
    const first = useEconomyStore.getState().getActiveShortcut()!;
    usePlayerStore.getState().addTokens(first.tokenCost);
    useEconomyStore.getState().unlockShortcut(first.id);
    const edges = useEconomyStore.getState().getUnlockedEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual([first.fromZoneId, first.toZoneId]);
  });

  it("mapStore treats unlocked shortcut zones as adjacent", () => {
    // Aurora Passage: Entrance <-> Central Plaza (normally not adjacent).
    expect(
      useMapStore.getState().isAdjacent(ZONE_ENTRANCE, ZONE_CENTRAL_PLAZA)
    ).toBe(false);
    usePlayerStore.getState().addTokens(100);
    useEconomyStore.getState().unlockShortcut(SHORTCUT_AURORA);
    expect(
      useMapStore.getState().isAdjacent(ZONE_ENTRANCE, ZONE_CENTRAL_PLAZA)
    ).toBe(true);
    // And movement is now allowed directly.
    expect(useMapStore.getState().moveToZone(ZONE_CENTRAL_PLAZA)).toBe(true);
  });

  it("unlockShortcut rejects unknown / already-unlocked ids", () => {
    expect(useEconomyStore.getState().unlockShortcut("nope")).toBe(false);
    const first = useEconomyStore.getState().getActiveShortcut()!;
    usePlayerStore.getState().addTokens(first.tokenCost);
    useEconomyStore.getState().unlockShortcut(first.id);
    expect(useEconomyStore.getState().unlockShortcut(first.id)).toBe(false);
  });

  it("the active shortcut cost stays frozen across balance changes (frozen-at-activation)", () => {
    const active = useEconomyStore.getState().getActiveShortcut()!;
    const frozen = active.tokenCost;
    usePlayerStore.getState().addTokens(20);
    useEconomyStore.getState().refreshLiveDeficitPrice();
    // The frozen buyable cost does NOT mutate; only the live teaser does.
    expect(
      useEconomyStore.getState().shortcuts.find((s) => s.id === active.id)!.tokenCost
    ).toBe(frozen);
  });
});

describe("economyStore flash sale spending", () => {
  beforeEach(() => {
    useEconomyStore.getState().reset();
    usePlayerStore.getState().reset();
  });

  it("triggerDeficitFlashSale creates a sale with a deficit-priced tokenCost", () => {
    usePlayerStore.getState().addTokens(4);
    const sale = useEconomyStore.getState().triggerDeficitFlashSale();
    expect(sale).not.toBeNull();
    expect(sale!.tokenCost).toBeGreaterThanOrEqual(6);
    expect(sale!.tokenCost).toBeLessThanOrEqual(7);
    expect(sale!.socialProof).toBeGreaterThan(0);
    expect(useEconomyStore.getState().flashSales).toHaveLength(1);
  });

  it("claimFlashSale fails when balance is insufficient", () => {
    const sale = useEconomyStore.getState().triggerDeficitFlashSale();
    const ok = useEconomyStore.getState().claimFlashSale(sale!.id);
    expect(ok).toBe(false);
    expect(useEconomyStore.getState().flashSales).toHaveLength(1);
  });

  it("claimFlashSale deducts the frozen cost and removes the sale when affordable", () => {
    const sale = useEconomyStore.getState().triggerDeficitFlashSale();
    usePlayerStore.getState().addTokens(sale!.tokenCost);
    const ok = useEconomyStore.getState().claimFlashSale(sale!.id);
    expect(ok).toBe(true);
    expect(usePlayerStore.getState().tokens).toBe(0);
    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
  });

  it("claimFlashSale rejects unknown ids", () => {
    expect(useEconomyStore.getState().claimFlashSale("nope")).toBe(false);
  });
});
