import { describe, it, expect } from "vitest";
import {
  zones,
  stores,
  getZoneById,
  getStoreById,
  areZonesAdjacent,
  storesByZone,
  ZONE_ENTRANCE,
  ZONE_EAST_WING,
  ZONE_WEST_WING,
  ZONE_CENTRAL_PLAZA,
  ZONE_FOOD_COURT,
} from "@/data/mallData";
import { reviewsForStore } from "@/data/reviewData";

describe("mallData", () => {
  it("contains exactly 5 zones", () => {
    expect(zones).toHaveLength(5);
  });

  it("contains exactly 11 stores", () => {
    expect(stores).toHaveLength(11);
  });

  it("zones have the canonical names", () => {
    const names = zones.map((z) => z.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Entrance",
        "East Wing",
        "West Wing",
        "Central Plaza",
        "Food Court",
      ])
    );
  });

  it("every zone has a non-empty polygon, center, and adjacency list", () => {
    for (const zone of zones) {
      expect(zone.polygonPoints.length).toBeGreaterThan(0);
      expect(typeof zone.center.x).toBe("number");
      expect(typeof zone.center.y).toBe("number");
      expect(zone.adjacentZoneIds.length).toBeGreaterThan(0);
    }
  });

  it("entrance zone is the only revealed zone by default", () => {
    expect(zones.filter((z) => z.revealed)).toHaveLength(1);
    expect(getZoneById(ZONE_ENTRANCE)?.revealed).toBe(true);
  });

  it("adjacency graph matches the spec exactly", () => {
    const adjacency: Record<string, string[]> = {};
    for (const z of zones) {
      adjacency[z.id] = [...z.adjacentZoneIds].sort();
    }
    expect(adjacency[ZONE_ENTRANCE].sort()).toEqual(
      [ZONE_EAST_WING, ZONE_WEST_WING].sort()
    );
    expect(adjacency[ZONE_EAST_WING].sort()).toEqual(
      [ZONE_ENTRANCE, ZONE_CENTRAL_PLAZA].sort()
    );
    expect(adjacency[ZONE_WEST_WING].sort()).toEqual(
      [ZONE_ENTRANCE, ZONE_CENTRAL_PLAZA].sort()
    );
    expect(adjacency[ZONE_CENTRAL_PLAZA].sort()).toEqual(
      [
        ZONE_EAST_WING,
        ZONE_WEST_WING,
        ZONE_FOOD_COURT,
      ].sort()
    );
    expect(adjacency[ZONE_FOOD_COURT].sort()).toEqual(
      [ZONE_CENTRAL_PLAZA].sort()
    );
  });

  it("store distribution: Zone 4 (Central Plaza) has no stores", () => {
    expect(stores.filter((s) => s.zoneId === ZONE_CENTRAL_PLAZA)).toHaveLength(0);
  });

  it("store distribution matches the spec", () => {
    const dist: Record<string, number> = {};
    for (const s of stores) {
      dist[s.zoneId] = (dist[s.zoneId] ?? 0) + 1;
    }
    expect(dist[ZONE_ENTRANCE]).toBe(3);
    expect(dist[ZONE_EAST_WING]).toBe(3);
    expect(dist[ZONE_WEST_WING]).toBe(2);
    expect(dist[ZONE_FOOD_COURT]).toBe(3);
    expect(dist[ZONE_CENTRAL_PLAZA]).toBeUndefined();
  });

  it("every store has a valid zone id and required fields", () => {
    const validZoneIds = new Set(zones.map((z) => z.id));
    for (const s of stores) {
      expect(validZoneIds.has(s.zoneId)).toBe(true);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.category.length).toBeGreaterThan(0);
      expect(s.icon.length).toBeGreaterThan(0);
      expect(s.reviews.length).toBeGreaterThan(0);
      expect(s.visitorCount).toBeGreaterThan(0);
    }
  });

  it("getStoreById and getZoneById return undefined for unknown ids", () => {
    expect(getStoreById("nope")).toBeUndefined();
    expect(getZoneById("nope")).toBeUndefined();
  });

  it("storesByZone groups stores by zone id", () => {
    expect(storesByZone[ZONE_ENTRANCE]).toHaveLength(3);
    expect(storesByZone[ZONE_FOOD_COURT]).toHaveLength(3);
    expect(storesByZone[ZONE_CENTRAL_PLAZA]).toBeUndefined();
  });

  it("areZonesAdjacent is symmetric and respects the graph", () => {
    expect(areZonesAdjacent(ZONE_ENTRANCE, ZONE_EAST_WING)).toBe(true);
    expect(areZonesAdjacent(ZONE_EAST_WING, ZONE_ENTRANCE)).toBe(true);
    expect(areZonesAdjacent(ZONE_ENTRANCE, ZONE_FOOD_COURT)).toBe(false);
  });
});

describe("reviewData", () => {
  it("every store has 3 reviews with rating 4 or 5", () => {
    for (const store of stores) {
      const reviews = reviewsForStore(store.id);
      expect(reviews).toHaveLength(3);
      for (const r of reviews) {
        expect(r.rating).toBeGreaterThanOrEqual(4);
        expect(r.rating).toBeLessThanOrEqual(5);
        expect(r.authorName.length).toBeGreaterThan(0);
        expect(r.text.length).toBeGreaterThan(0);
        expect(r.date.length).toBeGreaterThan(0);
      }
    }
  });

  it("reviews are deterministic for a given store id", () => {
    const a = JSON.stringify(reviewsForStore("store-bloom"));
    const b = JSON.stringify(reviewsForStore("store-bloom"));
    expect(a).toBe(b);
  });

  it("reviews have no disclosure labels (no 'sponsored' or 'ad' text)", () => {
    for (const store of stores) {
      for (const r of reviewsForStore(store.id)) {
        const lower = r.text.toLowerCase();
        expect(lower).not.toContain("sponsored");
        // Check for the standalone word "ad" with word boundaries,
        // not substrings like "advertised" or "shadow".
        expect(/\bad\b/.test(lower)).toBe(false);
      }
    }
  });
});
