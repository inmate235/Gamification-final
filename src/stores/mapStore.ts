/**
 * mapStore - mall world state.
 *
 * Holds: zones, stores, fogState, playerPosition, explorationPercent.
 * Actions: moveToZone, revealZone, updatePlayerPosition,
 *          calculateExplorationPercent, getVisibleStores, setExplorationPercent.
 *
 * Movement is restricted to adjacent zones per the static adjacency graph.
 * Exploration percent uses the non-linear front-loaded scaling curve from
 * architecture.md (first 50% of zones map to 0-40%, second 50% to 40-50%).
 */

import { create } from "zustand";
import type { MapState, PlayerPosition, Store, Zone } from "@/types";
import {
  zones as initialZones,
  stores as initialStores,
  getZoneById,
  areZonesAdjacent,
  ZONE_ENTRANCE,
} from "@/data/mallData";
import { useEconomyStore } from "./economyStore";

/* ============================================================================
   Non-linear exploration scaling
   ========================================================================== */

/**
 * Front-loaded non-linear scaling per architecture.md.
 * - first 50% of zones -> 0-40% progress
 * - second 50% of zones -> 40-50% progress (crawls)
 *
 * The displayed value is further floored at 99% so full reveal never
 * trivially hits 100% (perpetual near-completion per Section 4.5.4).
 */
export function calculateExploration(
  revealedCount: number,
  totalZones: number
): number {
  if (totalZones <= 0) return 0;
  const linear = revealedCount / totalZones; // 0..1
  let base: number;
  if (linear <= 0.5) {
    base = linear * 0.8; // first half -> 0..0.4
  } else {
    base = 0.4 + (linear - 0.5) * 0.2; // second half -> 0.4..0.5
  }
  // Convert to a percentage and cap below 100 to preserve the perpetual hook.
  const percent = Math.round(base * 100);
  if (revealedCount >= totalZones) {
    // Fully revealed -> still frame as incomplete (phantom progress).
    return 99;
  }
  return percent;
}

/* ============================================================================
   Store
   ========================================================================== */

export interface MapStore extends MapState {
  moveToZone: (zoneId: string) => boolean;
  revealZone: (zoneId: string) => void;
  updatePlayerPosition: (position: PlayerPosition) => void;
  setExplorationPercent: (percent: number) => void;
  getVisibleStores: () => Store[];
  getZone: (zoneId: string) => Zone | undefined;
  isAdjacent: (fromZoneId: string, toZoneId: string) => boolean;
  /** Record that the player opened a store (for visit-stores tasks). */
  visitStore: (storeId: string) => void;
  reset: () => void;
}

function buildFogState(zonesList: Zone[]): Record<string, boolean> {
  const fog: Record<string, boolean> = {};
  for (const zone of zonesList) {
    fog[zone.id] = zone.revealed;
  }
  return fog;
}

const entranceZone = getZoneById(ZONE_ENTRANCE);
const initialPlayerPosition: PlayerPosition = entranceZone
  ? { x: entranceZone.center.x, y: entranceZone.center.y, zoneId: ZONE_ENTRANCE }
  : { x: 500, y: 1090, zoneId: ZONE_ENTRANCE };

const initialFogState = buildFogState(initialZones);
const initialExploration = calculateExploration(
  Object.values(initialFogState).filter(Boolean).length,
  initialZones.length
);

export const useMapStore = create<MapStore>((set, get) => ({
  zones: initialZones.map((z) => ({ ...z })),
  stores: initialStores.map((s) => ({ ...s })),
  playerPosition: { ...initialPlayerPosition },
  fogState: { ...initialFogState },
  explorationPercent: initialExploration,
  visitedStores: [],

  moveToZone: (zoneId) => {
    const state = get();
    const target = getZoneById(zoneId);
    if (!target) return false;

    // No-op if already in the target zone.
    if (state.playerPosition.zoneId === zoneId) return false;

    // Restrict to adjacent zones OR unlocked shortcut routes.
    if (!state.isAdjacent(state.playerPosition.zoneId, zoneId)) {
      return false;
    }

    set({
      playerPosition: {
        x: target.center.x,
        y: target.center.y,
        zoneId,
      },
    });

    // Reveal the destination zone (memory-based, stays revealed).
    get().revealZone(zoneId);
    return true;
  },

  revealZone: (zoneId) =>
    set((state) => {
      if (state.fogState[zoneId]) return state; // already revealed
      const fogState = { ...state.fogState, [zoneId]: true };
      const revealedCount = Object.values(fogState).filter(Boolean).length;
      const explorationPercent = calculateExploration(
        revealedCount,
        state.zones.length
      );
      return { fogState, explorationPercent };
    }),

  updatePlayerPosition: (position) =>
    set({ playerPosition: { ...position } }),

  setExplorationPercent: (percent) =>
    set({ explorationPercent: Math.max(0, Math.min(99, percent)) }),

  getVisibleStores: () => {
    const state = get();
    return state.stores.filter((s) => state.fogState[s.zoneId] === true);
  },

  getZone: (zoneId) => getZoneById(zoneId),

  isAdjacent: (fromZoneId, toZoneId) => {
    // Static corridor adjacency.
    if (areZonesAdjacent(fromZoneId, toZoneId)) return true;
    // Unlocked shortcut routes (faster paths purchased with tokens).
    const edges = useEconomyStore.getState().getUnlockedEdges();
    return edges.some(
      ([a, b]) =>
        (a === fromZoneId && b === toZoneId) ||
        (a === toZoneId && b === fromZoneId)
    );
  },

  visitStore: (storeId) =>
    set((state) =>
      state.visitedStores.includes(storeId)
        ? state
        : { visitedStores: [...state.visitedStores, storeId] }
    ),

  reset: () =>
    set({
      zones: initialZones.map((z) => ({ ...z })),
      stores: initialStores.map((s) => ({ ...s })),
      playerPosition: { ...initialPlayerPosition },
      fogState: { ...initialFogState },
      explorationPercent: initialExploration,
      visitedStores: [],
    }),
}));

export default useMapStore;
