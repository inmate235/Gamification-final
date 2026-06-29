import { describe, it, expect, beforeEach } from "vitest";
import {
  useMapStore,
  calculateExploration,
} from "@/stores/mapStore";
import {
  zones as staticZones,
  stores as staticStores,
  ZONE_ENTRANCE,
  ZONE_EAST_WING,
  ZONE_WEST_WING,
  ZONE_CENTRAL_PLAZA,
  ZONE_FOOD_COURT,
  areZonesAdjacent,
} from "@/data/mallData";

describe("mapStore", () => {
  beforeEach(() => {
    useMapStore.getState().reset();
  });

  it("initializes with 5 zones and 11 stores", () => {
    const s = useMapStore.getState();
    expect(s.zones).toHaveLength(5);
    expect(s.stores).toHaveLength(11);
  });

  it("starts with the entrance zone revealed and others fogged", () => {
    const s = useMapStore.getState();
    expect(s.fogState[ZONE_ENTRANCE]).toBe(true);
    expect(s.fogState[ZONE_EAST_WING]).toBe(false);
    expect(s.fogState[ZONE_WEST_WING]).toBe(false);
    expect(s.fogState[ZONE_CENTRAL_PLAZA]).toBe(false);
    expect(s.fogState[ZONE_FOOD_COURT]).toBe(false);
  });

  it("places the player in the entrance zone on first load", () => {
    const s = useMapStore.getState();
    expect(s.playerPosition.zoneId).toBe(ZONE_ENTRANCE);
  });

  it("moveToZone to an adjacent zone moves the player and reveals it", () => {
    const ok = useMapStore.getState().moveToZone(ZONE_EAST_WING);
    expect(ok).toBe(true);
    const s = useMapStore.getState();
    expect(s.playerPosition.zoneId).toBe(ZONE_EAST_WING);
    expect(s.fogState[ZONE_EAST_WING]).toBe(true);
  });

  it("moveToZone to a non-adjacent zone is rejected (returns false)", () => {
    // Entrance is not adjacent to Central Plaza directly.
    const ok = useMapStore.getState().moveToZone(ZONE_CENTRAL_PLAZA);
    expect(ok).toBe(false);
    expect(useMapStore.getState().playerPosition.zoneId).toBe(ZONE_ENTRANCE);
  });

  it("moveToZone to the current zone is a no-op", () => {
    const ok = useMapStore.getState().moveToZone(ZONE_ENTRANCE);
    expect(ok).toBe(false);
  });

  it("Food Court is only reachable through Central Plaza", () => {
    // From entrance -> east wing -> central plaza -> food court
    expect(useMapStore.getState().moveToZone(ZONE_FOOD_COURT)).toBe(false);
    expect(useMapStore.getState().moveToZone(ZONE_EAST_WING)).toBe(true);
    expect(useMapStore.getState().moveToZone(ZONE_CENTRAL_PLAZA)).toBe(true);
    expect(useMapStore.getState().moveToZone(ZONE_FOOD_COURT)).toBe(true);
  });

  it("revealZone persists (memory-based) and updates exploration percent", () => {
    const before = useMapStore.getState().explorationPercent;
    useMapStore.getState().revealZone(ZONE_EAST_WING);
    const after = useMapStore.getState();
    expect(after.fogState[ZONE_EAST_WING]).toBe(true);
    expect(after.explorationPercent).not.toBe(before);
  });

  it("revealing an already-revealed zone is a no-op", () => {
    const before = useMapStore.getState().explorationPercent;
    useMapStore.getState().revealZone(ZONE_ENTRANCE);
    expect(useMapStore.getState().explorationPercent).toBe(before);
  });

  it("getVisibleStores only returns stores in revealed zones", () => {
    const visible = useMapStore.getState().getVisibleStores();
    // Only entrance stores are visible on first load.
    expect(visible.every((s) => s.zoneId === ZONE_ENTRANCE)).toBe(true);
    expect(visible.length).toBeGreaterThanOrEqual(2);
  });

  it("exploration percent never reaches 100 even after full reveal", () => {
    for (const zone of staticZones) {
      useMapStore.getState().revealZone(zone.id);
    }
    expect(useMapStore.getState().explorationPercent).toBeLessThan(100);
  });

  it("non-linear scaling: first reveal jumps more than later reveals", () => {
    // Reset to a clean state for this assertion.
    useMapStore.getState().reset();
    const start = useMapStore.getState().explorationPercent;
    useMapStore.getState().revealZone(ZONE_EAST_WING);
    const afterFirst = useMapStore.getState().explorationPercent;
    useMapStore.getState().revealZone(ZONE_WEST_WING);
    const afterSecond = useMapStore.getState().explorationPercent;
    // First jump should be at least as large as subsequent jumps (front-loaded).
    expect(afterFirst - start).toBeGreaterThanOrEqual(afterSecond - afterFirst);
  });

  it("calculateExploration implements the documented non-linear curve", () => {
    // 0 revealed -> 0%
    expect(calculateExploration(0, 5)).toBe(0);
    // 1/5 = 0.2 linear -> 0.2 * 0.8 = 0.16 -> 16%
    expect(calculateExploration(1, 5)).toBe(16);
    // 2/5 = 0.4 linear -> 0.4 * 0.8 = 0.32 -> 32%
    expect(calculateExploration(2, 5)).toBe(32);
    // 3/5 = 0.6 linear -> 0.4 + (0.1 * 0.2) = 0.42 -> 42%
    expect(calculateExploration(3, 5)).toBe(42);
    // Full reveal -> capped at 99%
    expect(calculateExploration(5, 5)).toBe(99);
  });

  it("static adjacency graph matches the spec", () => {
    expect(areZonesAdjacent(ZONE_ENTRANCE, ZONE_EAST_WING)).toBe(true);
    expect(areZonesAdjacent(ZONE_ENTRANCE, ZONE_WEST_WING)).toBe(true);
    expect(areZonesAdjacent(ZONE_EAST_WING, ZONE_CENTRAL_PLAZA)).toBe(true);
    expect(areZonesAdjacent(ZONE_WEST_WING, ZONE_CENTRAL_PLAZA)).toBe(true);
    expect(areZonesAdjacent(ZONE_CENTRAL_PLAZA, ZONE_FOOD_COURT)).toBe(true);
    // Non-edges
    expect(areZonesAdjacent(ZONE_ENTRANCE, ZONE_FOOD_COURT)).toBe(false);
    expect(areZonesAdjacent(ZONE_ENTRANCE, ZONE_CENTRAL_PLAZA)).toBe(false);
  });

  it("static store data has 11 stores with valid zone assignments", () => {
    const validZoneIds = new Set(staticZones.map((z) => z.id));
    for (const store of staticStores) {
      expect(validZoneIds.has(store.zoneId)).toBe(true);
    }
  });
});
