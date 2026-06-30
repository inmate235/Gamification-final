import { describe, it, expect, beforeEach } from "vitest";
import { useSocialStore } from "@/stores/socialStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useEconomyStore } from "@/stores/economyStore";
import { ZONE_BOUNDS, phantoms as staticPhantoms } from "@/data/phantomData";
import { stores as allStores, areZonesAdjacent, getZoneById } from "@/data/mallData";

/* Helper: run movePhantoms N times, collecting snapshots. */
function runMoves(n: number) {
  const snapshots: Array<{
    id: string;
    x: number;
    y: number;
    zoneId: string;
    action: string;
    tokens: number;
  }[]> = [];
  for (let i = 0; i < n; i++) {
    useSocialStore.getState().movePhantoms();
    snapshots.push(
      useSocialStore.getState().phantoms.map((p) => ({
        id: p.id,
        x: p.position.x,
        y: p.position.y,
        zoneId: p.position.zoneId,
        action: p.currentAction,
        tokens: p.tokenCount,
      })),
    );
  }
  return snapshots;
}

/**
 * Check that a position is within the bounds for its zone, or within an
 * adjacent zone's bounds (accounts for corridor transit during zone
 * transitions, when the phantom's zoneId is still the old zone but its
 * position has moved toward the new zone). A margin of 100px is added to
 * each zone's bounds to cover the corridor gap between adjacent zones.
 */
function inZoneBounds(x: number, y: number, zoneId: string): boolean {
  const MARGIN = 100;
  const check = (b: typeof ZONE_BOUNDS[string]) => {
    if (!b) return false;
    return (
      x >= b.minX - MARGIN &&
      x <= b.maxX + MARGIN &&
      y >= b.minY - MARGIN &&
      y <= b.maxY + MARGIN
    );
  };
  if (check(ZONE_BOUNDS[zoneId])) return true;
  const zone = getZoneById(zoneId);
  if (zone) {
    for (const adjId of zone.adjacentZoneIds) {
      if (check(ZONE_BOUNDS[adjId])) return true;
    }
  }
  return false;
}

describe("phantom behavior — state machine movement", () => {
  beforeEach(() => {
    useSocialStore.getState().reset();
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
    useSessionStore.getState().reset();
    useEconomyStore.getState().reset();
  });

  it("movePhantoms preserves all required phantom fields", () => {
    useSocialStore.getState().movePhantoms();
    for (const p of useSocialStore.getState().phantoms) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(["bronze", "silver", "gold", "neodymium"]).toContain(p.tier);
      expect(typeof p.tokenCount).toBe("number");
      expect(typeof p.position.x).toBe("number");
      expect(typeof p.position.y).toBe("number");
      expect(p.position.zoneId.length).toBeGreaterThan(0);
      expect(p.currentAction.length).toBeGreaterThan(0);
    }
  });

  it("phantoms stay within zone bounds after many moves", () => {
    const snaps = runMoves(100);
    for (const tick of snaps) {
      for (const p of tick) {
        expect(inZoneBounds(p.x, p.y, p.zoneId)).toBe(true);
      }
    }
  });

  it("phantoms produce store-specific actions (FSM reaches in-store phase)", () => {
    const snaps = runMoves(150);
    const storeNames = allStores.map((s) => s.name);
    // At least one action across all ticks should mention a store name
    // (e.g. "trying on a silk dress at Bloom").
    const hasStoreAction = snaps.some((tick) =>
      tick.some((p) =>
        storeNames.some((name) => p.action.includes(name)),
      ),
    );
    expect(hasStoreAction).toBe(true);
  });

  it("phantoms approach and reach store positions", () => {
    const snaps = runMoves(150);
    // At least one phantom across all ticks should be within 35px of a store in its zone.
    const nearStore = snaps.some((tick) =>
      tick.some((p) => {
        const storesInZone = allStores.filter((s) => s.zoneId === p.zoneId);
        return storesInZone.some((s) => {
          const d = Math.sqrt(
            (p.x - s.position.x) ** 2 + (p.y - s.position.y) ** 2,
          );
          return d <= 35;
        });
      })
    );
    expect(nearStore).toBe(true);
  });

  it("zone transitions only go to adjacent zones (no random teleport)", () => {
    const snaps = runMoves(120);
    // For each phantom, track zone changes and verify adjacency.
    const ids = snaps[0]!.map((p) => p.id);
    for (const id of ids) {
      let prevZone: string | null = null;
      for (const tick of snaps) {
        const p = tick.find((t) => t.id === id);
        if (!p) continue;
        if (prevZone !== null && p.zoneId !== prevZone) {
          // Zone changed — must be adjacent.
          expect(areZonesAdjacent(prevZone, p.zoneId)).toBe(true);
        }
        prevZone = p.zoneId;
      }
    }
  });

  it("phantoms do not teleport (positions change gradually)", () => {
    const snaps = runMoves(60);
    const ids = snaps[0]!.map((p) => p.id);
    const MAX_STEP = 180; // max reasonable single-tick movement (accounts for step size + separation push)
    for (const id of ids) {
      let prev = snaps[0]!.find((t) => t.id === id);
      for (const tick of snaps.slice(1)) {
        const curr = tick.find((t) => t.id === id);
        if (!prev || !curr) continue;
        if (prev.zoneId === curr.zoneId) {
          const d = Math.sqrt(
            (prev.x - curr.x) ** 2 + (prev.y - curr.y) ** 2,
          );
          // Within the same zone, movement should be gradual.
          expect(d).toBeLessThanOrEqual(MAX_STEP);
        }
        prev = curr;
      }
    }
  });
});

describe("phantom behavior — visible consequences", () => {
  beforeEach(() => {
    useSocialStore.getState().reset();
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
    useSessionStore.getState().reset();
    useEconomyStore.getState().reset();
  });

  it("phantom token counts can increase (visible on leaderboard)", () => {
    // Keep the player at 0 tokens so most phantoms are above (not pinned).
    const initialTokens = new Map(
      staticPhantoms.map((p) => [p.id, p.tokenCount]),
    );
    runMoves(150);
    const finalPhantoms = useSocialStore.getState().phantoms;
    // At least one phantom should have gained tokens.
    const anyIncreased = finalPhantoms.some(
      (p) => (initialTokens.get(p.id) ?? 0) < p.tokenCount,
    );
    expect(anyIncreased).toBe(true);
  });

  it("phantoms can consume flash sales (sale disappears)", () => {
    // Create flash sales for every store so phantoms have many opportunities.
    for (const store of allStores) {
      useEconomyStore.getState().triggerFlashSale({
        storeId: store.id,
        discount: "30% off",
        tokenCost: 10,
        countdownSeconds: 999,
        personalized: false,
      });
    }
    expect(useEconomyStore.getState().flashSales.length).toBe(allStores.length);

    // Run many moves to give phantoms a chance to claim sales.
    runMoves(200);
    // At least one sale should have been consumed.
    expect(useEconomyStore.getState().flashSales.length).toBeLessThan(
      allStores.length,
    );
  });
});

describe("phantom behavior — player reactivity", () => {
  beforeEach(() => {
    useSocialStore.getState().reset();
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
    useSessionStore.getState().reset();
    useEconomyStore.getState().reset();
  });

  it("phantoms notice when the player enters their zone", () => {
    // Start in entrance, then move to an adjacent zone (east wing).
    // First, prime previousPlayerZone by running a move.
    useSocialStore.getState().movePhantoms();

    // Move player to the east wing (adjacent to entrance).
    useMapStore.getState().moveToZone("zone-east-wing");

    // Run movePhantoms — phantoms in east wing may notice.
    useSocialStore.getState().movePhantoms();

    const eastWingPhantoms = useSocialStore
      .getState()
      .phantoms.filter((p) => p.position.zoneId === "zone-east-wing");

    // If there are phantoms in the east wing, check for notice actions.
    // (Probabilistic: at least check the actions are well-formed.)
    for (const p of eastWingPhantoms) {
      expect(p.currentAction.length).toBeGreaterThan(0);
    }

    // Run several more moves to increase the chance of observing a notice.
    let sawNotice = false;
    const noticePhrases = [
      "glanced your way",
      "noticed you nearby",
      "looking around",
      "checking out the new arrival",
    ];
    // Reset and retry with multiple zone entries.
    for (let attempt = 0; attempt < 10 && !sawNotice; attempt++) {
      useSocialStore.getState().reset();
      useMapStore.getState().reset();
      useSocialStore.getState().movePhantoms(); // prime
      // Move to a zone with phantoms, then back, then again.
      useMapStore.getState().moveToZone("zone-east-wing");
      for (let i = 0; i < 3; i++) {
        useSocialStore.getState().movePhantoms();
        const actions = useSocialStore
          .getState()
          .phantoms.filter((p) => p.position.zoneId === "zone-east-wing")
          .map((p) => p.currentAction);
        if (actions.some((a) => noticePhrases.includes(a))) {
          sawNotice = true;
          break;
        }
      }
    }
    expect(sawNotice).toBe(true);
  });

  it("in-store phantoms may leave when the player approaches their store", () => {
    // This is probabilistic; we run many iterations to observe the behavior.
    // Place phantoms near stores and the player near the same store.
    const store = allStores[0]!;
    // Move player to the store's zone.
    useMapStore.getState().moveToZone(store.zoneId);
    // Position player near the store.
    useMapStore.getState().updatePlayerPosition({
      x: store.position.x + 10,
      y: store.position.y + 10,
      zoneId: store.zoneId,
    });

    // Run many moves; some phantoms should eventually be in a leaving phase
    // (action starts with "leaving ").
    let sawLeaving = false;
    const snaps = runMoves(200);
    for (const tick of snaps) {
      if (tick.some((p) => p.action.startsWith("leaving "))) {
        sawLeaving = true;
        break;
      }
    }
    expect(sawLeaving).toBe(true);
  });
});

describe("phantom behavior — explorer bias", () => {
  beforeEach(() => {
    useSocialStore.getState().reset();
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
    useSessionStore.getState().reset();
    useEconomyStore.getState().reset();
  });

  it("explorer-type phantoms prefer unexplored zones", () => {
    usePlayerStore.setState({ bartleType: "explorer" });

    // Track zone visits across many moves.
    const zoneVisitCounts: Record<string, number> = {};
    const snaps = runMoves(200);
    for (const tick of snaps) {
      for (const p of tick) {
        zoneVisitCounts[p.zoneId] = (zoneVisitCounts[p.zoneId] ?? 0) + 1;
      }
    }

    // The entrance is always revealed. Unexplored zones (east, west, central,
    // food court) should receive significant visits due to the 60% bias.
    const fogState = useMapStore.getState().fogState;
    const foggedZones = Object.keys(fogState).filter((k) => !fogState[k]);
    const foggedVisits = foggedZones.reduce(
      (sum, z) => sum + (zoneVisitCounts[z] ?? 0),
      0,
    );
    // At least some visits should go to fogged zones.
    expect(foggedVisits).toBeGreaterThan(0);
  });
});
