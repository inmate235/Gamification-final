"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import {
  EXPLORE_REWARD,
  FIRST_TOKEN_BONUS,
  FOOD_COURT_SECRET_REWARD,
  ZONE_ENTRANCE,
  ZONE_FOOD_COURT,
  getZoneById,
} from "@/data/mallData";
import type { Store, Zone } from "@/types";
import { FogFilterDefs, FogOverlay } from "./FogOverlay";
import { ZoneLabel } from "./ZoneLabel";
import { StoreMarker } from "./StoreMarker";
import { PlayerAvatar } from "./PlayerAvatar";

/**
 * MallMap — the SVG-based 2D floor plan at the heart of `/mall`.
 *
 * Renders:
 *   - 5 zones as SVG polygons (Entrance, East Wing, West Wing, Central Plaza,
 *     Food Court) with the documented spatial arrangement.
 *   - Corridor lines connecting adjacent zones.
 *   - Store markers (only within revealed zones).
 *   - Zone labels (only on revealed zones).
 *   - Fog-of-war mist overlay on unexplored zones (SVG feTurbulence).
 *   - The player avatar (pulsing gold dot) animating along corridors.
 *
 * Navigation is click-to-move and restricted to adjacent zones. Moving into a
 * fogged zone reveals it, awards exploration tokens, and updates the progress
 * bar. Non-adjacent clicks are a no-op (with a subtle locked affordance).
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Component
   ========================================================================== */

export function MallMap() {
  const zones = useMapStore((s) => s.zones);
  const stores = useMapStore((s) => s.stores);
  const fogState = useMapStore((s) => s.fogState);
  const playerPosition = useMapStore((s) => s.playerPosition);
  const moveToZone = useMapStore((s) => s.moveToZone);
  const isAdjacent = useMapStore((s) => s.isAdjacent);

  const addTokens = usePlayerStore((s) => s.addTokens);
  const awardTokens = usePlayerStore((s) => s.awardTokens);

  const showOverlay = useUIStore((s) => s.showOverlay);
  const activeOverlay = useUIStore((s) => s.activeOverlay);

  /* --- Build the set of corridor edges (undirected, de-duplicated) --- */
  const corridorEdges = buildCorridorEdges(zones);

  /* --- Click-to-move handler --- */
  const handleZoneClick = useCallback(
    (zone: Zone) => {
      // Block movement while a store-detail overlay is open.
      if (activeOverlay === "store-detail") return;

      const currentZoneId = playerPosition.zoneId;

      // No-op: clicking the current zone.
      if (zone.id === currentZoneId) return;

      // Reject non-adjacent clicks (no movement, no error dialog).
      if (!isAdjacent(currentZoneId, zone.id)) return;

      const wasFogged = !fogState[zone.id];
      const isFirstMove = currentZoneId === ZONE_ENTRANCE && !firstMoveDone;
      const isFoodCourtFirstReveal =
        zone.id === ZONE_FOOD_COURT && wasFogged;

      // moveToZone updates position and reveals the destination zone.
      const ok = moveToZone(zone.id);
      if (!ok) return;

      // Token rewards + celebration for newly revealed zones.
      if (wasFogged) {
        if (isFoodCourtFirstReveal) {
          // Furthest zone: large secret-token reward (10x value) + base
          // exploration reward, both tier-multiplied.
          const explore = awardTokens(EXPLORE_REWARD);
          const secret = awardTokens(FOOD_COURT_SECRET_REWARD);
          showOverlay("celebration", {
            message: `Secret Token! +${secret}`,
            amount: explore + secret,
            kind: "earn",
          });
        } else if (isFirstMove) {
          // First move from entrance: automatic first token (Day 1 2:00) on
          // top of the tier-multiplied exploration reward.
          const explore = awardTokens(EXPLORE_REWARD);
          addTokens(FIRST_TOKEN_BONUS);
          showOverlay("celebration", {
            message: `+1 Token!`,
            amount: explore + FIRST_TOKEN_BONUS,
            kind: "earn",
          });
          firstMoveDone = true;
        } else {
          const explore = awardTokens(EXPLORE_REWARD);
          showOverlay("celebration", {
            message: `+${explore} Tokens`,
            amount: explore,
            kind: "earn",
          });
        }
      } else if (isFirstMove) {
        // First move into an already-revealed zone still finds the first token.
        addTokens(FIRST_TOKEN_BONUS);
        showOverlay("celebration", {
          message: `+${FIRST_TOKEN_BONUS} Token!`,
          amount: FIRST_TOKEN_BONUS,
          kind: "earn",
        });
        firstMoveDone = true;
      }
    },
    [
      activeOverlay,
      playerPosition.zoneId,
      fogState,
      isAdjacent,
      moveToZone,
      addTokens,
      awardTokens,
      showOverlay,
    ]
  );

  /* --- Store marker click --- */
  const handleStoreClick = useCallback(
    (store: Store) => {
      showOverlay("store-detail", store);
    },
    [showOverlay]
  );

  return (
    <div
      className="relative mx-auto w-full max-w-4xl"
      data-testid="mall-map"
    >
      <svg
        viewBox="0 0 1000 1200"
        className="h-auto w-full select-none"
        role="img"
        aria-label="Mall floor plan"
        data-testid="mall-map-svg"
      >
        <defs>
          {/* Atmospheric radial gradient lighting for the whole map */}
          <radialGradient id="map-atmosphere" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#1a1a2e" stopOpacity={1} />
            <stop offset="60%" stopColor="#101019" stopOpacity={1} />
            <stop offset="100%" stopColor="#0a0a0f" stopOpacity={1} />
          </radialGradient>
          {/* Glow filter for revealed zone edges */}
          <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Per-zone fog filters + gradients */}
          <FogFilterDefs zones={zones} />
        </defs>

        {/* Atmospheric backdrop */}
        <rect
          x={0}
          y={0}
          width={1000}
          height={1200}
          fill="url(#map-atmosphere)"
          rx={24}
        />

        {/* Corridors (dashed lines between adjacent zones) */}
        <g pointerEvents="none">
          {corridorEdges.map((edge) => (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={6}
              strokeDasharray="4 10"
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Zone polygons */}
        <g>
          {zones.map((zone) => {
            const revealed = fogState[zone.id] === true;
            const current = playerPosition.zoneId === zone.id;
            const reachable =
              isAdjacent(playerPosition.zoneId, zone.id) && !current;
            return (
              <g key={zone.id}>
                <polygon
                  points={zone.polygonPoints}
                  fill="#1a1a25"
                  stroke={
                    revealed
                      ? "rgba(79,209,197,0.35)"
                      : "rgba(255,255,255,0.06)"
                  }
                  strokeWidth={revealed ? 2 : 1.5}
                  filter={revealed ? "url(#edge-glow)" : undefined}
                  style={{
                    cursor: reachable ? "pointer" : "default",
                    transition:
                      "stroke 700ms cubic-bezier(0.32,0.72,0,1)",
                  }}
                  onClick={() => handleZoneClick(zone)}
                  data-testid={`zone-${zone.id}`}
                  data-reachable={reachable ? "true" : "false"}
                  data-revealed={revealed ? "true" : "false"}
                  aria-label={zone.name}
                  role={reachable ? "button" : undefined}
                />
                {/* Subtle highlight overlay for reachable adjacent zones */}
                {reachable && (
                  <motion.polygon
                    points={zone.polygonPoints}
                    fill="#d4af37"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.04, 0.12, 0.04] }}
                    transition={{
                      duration: 2.4,
                      ease: PREMIUM_EASE,
                      repeat: Infinity,
                    }}
                    pointerEvents="none"
                    data-testid={`zone-hint-${zone.id}`}
                  />
                )}
                {/* Current zone soft glow */}
                {current && (
                  <polygon
                    points={zone.polygonPoints}
                    fill="#d4af37"
                    opacity={0.06}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* Store markers (only in revealed zones) */}
        <g>
          {stores.map((store) => {
            const revealed = fogState[store.zoneId] === true;
            if (!revealed) return null;
            return (
              <StoreMarker
                key={store.id}
                store={store}
                onStoreClick={handleStoreClick}
              />
            );
          })}
        </g>

        {/* Zone labels (only on revealed zones) */}
        <g>
          {zones.map((zone) => (
            <ZoneLabel
              key={`label-${zone.id}`}
              zone={zone}
              revealed={fogState[zone.id] === true}
            />
          ))}
        </g>

        {/* Fog-of-war overlay (rendered above zones/stores/labels so it
            actually obscures unexplored content) */}
        <g>
          {zones.map((zone) => (
            <FogOverlay
              key={`fog-${zone.id}`}
              zone={zone}
              revealed={fogState[zone.id] === true}
            />
          ))}
        </g>

        {/* Player avatar (top layer) */}
        <PlayerAvatar />
      </svg>
    </div>
  );
}

/* ============================================================================
   Helpers
   ========================================================================== */

interface CorridorEdge {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Builds the de-duplicated set of corridor edges from zone adjacency. */
function buildCorridorEdges(zones: Zone[]): CorridorEdge[] {
  const seen = new Set<string>();
  const edges: CorridorEdge[] = [];
  for (const zone of zones) {
    const from = getZoneById(zone.id);
    if (!from) continue;
    for (const adjId of zone.adjacentZoneIds) {
      const to = getZoneById(adjId);
      if (!to) continue;
      const key = [zone.id, adjId].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        from: zone.id,
        to: adjId,
        x1: from.center.x,
        y1: from.center.y,
        x2: to.center.x,
        y2: to.center.y,
      });
    }
  }
  return edges;
}

// Module-level flag: has the player made their first move from the entrance?
// (Per Day 1 minute 2:00 the first token is found automatically on the
// initial path. This is a session-only flag, intentionally not persisted.)
let firstMoveDone = false;

/** Test-only helper to reset the first-move flag between tests. */
export function __resetFirstMoveFlag(): void {
  firstMoveDone = false;
}

export default MallMap;
