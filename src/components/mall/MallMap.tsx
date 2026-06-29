"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import {
  EXPLORE_REWARD,
  FIRST_TOKEN_BONUS,
  FOOD_COURT_SECRET_REWARD,
  ZONE_ENTRANCE,
  ZONE_EAST_WING,
  ZONE_WEST_WING,
  ZONE_CENTRAL_PLAZA,
  ZONE_FOOD_COURT,
  getZoneById,
} from "@/data/mallData";
import { onPlayerEnterZone, onZoneRevealed, onStoreVisited } from "@/engine/taskEngine";
import type { Store, Zone } from "@/types";
import { FogFilterDefs, FogOverlay } from "@/components/mall/FogOverlay";
import { ZoneLabel, zoneColor } from "@/components/mall/ZoneLabel";
import { StoreMarker } from "@/components/mall/StoreMarker";
import { PlayerAvatar } from "@/components/mall/PlayerAvatar";
import { PhantomAvatars } from "@/components/mall/PhantomAvatars";
import { Star, MapPin } from "@phosphor-icons/react/dist/ssr";

/**
 * MallMap — the SVG-based 2D floor plan at the heart of `/mall`.
 *
 * Playful Figma direction: white background with scattered doodle decorations,
 * 5 zones as light SVG polygons with zone-colored strokes, corridor lines,
 * store markers (only within revealed zones), zone labels, fog-of-war mist
 * overlay on unexplored zones, and the player avatar.
 *
 * Navigation is click-to-move and restricted to adjacent zones. Moving into a
 * fogged zone reveals it, awards exploration tokens, and updates the progress
 * bar. Non-adjacent clicks are a no-op (with a subtle locked affordance).
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Component
   ========================================================================== */

const ZONE_IMAGES: Record<string, string> = {
  [ZONE_ENTRANCE]: "/assets/map/entrance.png",
  [ZONE_EAST_WING]: "/assets/map/east-wing.png",
  [ZONE_WEST_WING]: "/assets/map/west-wing.png",
  [ZONE_CENTRAL_PLAZA]: "/assets/map/central-plaza.png",
  [ZONE_FOOD_COURT]: "/assets/map/food-court.png",
};

const ZONE_ICON_LAYOUT: Record<string, { scale: number; dx?: number; dy?: number }> = {
  [ZONE_ENTRANCE]: { scale: 0.62, dy: 0.04 },
  [ZONE_EAST_WING]: { scale: 0.84, dx: -0.08 },
  [ZONE_WEST_WING]: { scale: 0.805, dx: -0.1 },
  [ZONE_CENTRAL_PLAZA]: { scale: 0.66 },
  [ZONE_FOOD_COURT]: { scale: 0.58, dy: 0.02 },
};

/** Compute the bounding box {x, y, width, height} from polygon points. */
function polygonBBox(points: string): { x: number; y: number; w: number; h: number } {
  const coords = points.split(/\s+/).map((p) => p.split(",").map(Number));
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

function iconFrame(zoneId: string, bbox: { x: number; y: number; w: number; h: number }) {
  const layout = ZONE_ICON_LAYOUT[zoneId] ?? { scale: 0.6 };
  const iw = bbox.w * layout.scale;
  const ih = bbox.h * layout.scale;
  const x = bbox.x + (bbox.w - iw) / 2 + bbox.w * (layout.dx ?? 0);
  const y = bbox.y + (bbox.h - ih) / 2 + bbox.h * (layout.dy ?? 0);
  return { x, y, w: iw, h: ih };
}

export function MallMap() {
  const zones = useMapStore((s) => s.zones);
  const stores = useMapStore((s) => s.stores);
  const fogState = useMapStore((s) => s.fogState);
  const playerPosition = useMapStore((s) => s.playerPosition);
  const moveToZone = useMapStore((s) => s.moveToZone);
  const isAdjacent = useMapStore((s) => s.isAdjacent);

  const addTokens = usePlayerStore((s) => s.addTokens);
  const awardTokens = usePlayerStore((s) => s.awardTokens);
  const streakCount = usePlayerStore((s) => s.streak.count);

  const showOverlay = useUIStore((s) => s.showOverlay);
  const activeOverlay = useUIStore((s) => s.activeOverlay);

  const [failedZoneImages, setFailedZoneImages] = useState<Set<string>>(new Set());
  const [streakImgError, setStreakImgError] = useState(false);

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
        // Breadcrumb task checks: a token was found on reveal (find-token)
        // and the player entered the zone (explore-zone). Delayed slightly so
        // the exploration celebration is visible before any task celebration.
        window.setTimeout(() => {
          onZoneRevealed(zone.id);
          onPlayerEnterZone(zone.id);
        }, 700);
      } else {
        if (isFirstMove) {
          // First move into an already-revealed zone still finds the first token.
          addTokens(FIRST_TOKEN_BONUS);
          showOverlay("celebration", {
            message: `+${FIRST_TOKEN_BONUS} Token!`,
            amount: FIRST_TOKEN_BONUS,
            kind: "earn",
          });
          firstMoveDone = true;
          window.setTimeout(() => onPlayerEnterZone(zone.id), 700);
        } else {
          // Already-revealed zone: only explore-zone tasks can complete here.
          onPlayerEnterZone(zone.id);
        }
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
      // Opening a store counts as "visiting" it for visit-stores tasks.
      // onStoreVisited records the visit and completes any task whose target
      // stores have all been visited (showing a celebration on completion).
      onStoreVisited(store.id);
      showOverlay("store-detail", store);
    },
    [showOverlay]
  );

  return (
    <div
      className="relative mx-auto w-full max-w-4xl"
      data-testid="mall-map"
    >
      {/* Background visual layer — white with scattered doodle decorations */}
      <div
        className="absolute inset-0 overflow-hidden rounded-3xl bg-[#fffbeb]"
        aria-hidden
      >
        {/* Subtle dot grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(20,20,20,0.08) 1.5px, transparent 1.5px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Scattered doodle decorations — Figma-inspired scribbles/stars/dots */}
        <Doodle className="absolute left-[6%] top-[12%] text-[#e6009e]" rotate={-12}>
          <Star size={26} weight="fill" />
        </Doodle>
        <Doodle className="absolute right-[8%] top-[20%] text-[#14b8a6]" rotate={18}>
          <Star size={22} weight="fill" />
        </Doodle>
        <Doodle className="absolute left-[12%] top-[48%] text-[#7c3aed]" rotate={8}>
          <Star size={18} weight="fill" />
        </Doodle>
        <Doodle className="absolute right-[10%] top-[55%] text-[#f59e0b]" rotate={-20}>
          <Star size={20} weight="fill" />
        </Doodle>
        <Doodle className="absolute left-[40%] top-[8%] text-[#84cc16]" rotate={15}>
          <Star size={16} weight="fill" />
        </Doodle>
        <Doodle className="absolute right-[22%] top-[78%] text-[#e6009e]" rotate={-8}>
          <Star size={24} weight="fill" />
        </Doodle>

        {/* MurkyCorps sticker — top left */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-[#141414] px-2.5 py-1.5">
          <MapPin size={14} weight="fill" className="text-[#ffe600]" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white font-display">
            MurkyCorps
          </span>
        </div>

        {/* Day streak badge — bottom left (Figma "1 DAY STREAK" pill) */}
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-3 bottom-3 z-10 flex items-center gap-1.5 rounded-full bg-[#ffe600] px-2.5 py-1.5 ring-2 ring-[#141414]/10 shadow-[0_4px_12px_rgba(20,20,20,0.12)]"
        >
          {!streakImgError ? (
            <img
              src="/assets/map/streak-badge.png"
              alt=""
              className="h-5 w-5 object-contain"
              onError={() => setStreakImgError(true)}
            />
          ) : (
            <Star size={14} weight="fill" className="text-[#e6009e]" />
          )}
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.08em] text-[#141414]">
            {streakCount} Day Streak
          </span>
        </motion.div>
      </div>

      <svg
        viewBox="0 0 1000 1200"
        className="relative h-auto w-full select-none"
        role="img"
        aria-label="Mall floor plan"
        data-testid="mall-map-svg"
      >
        <defs>
          {/* Warm atmospheric gradient — soft amber/cream center, golden edges */}
          <radialGradient id="map-atmosphere" cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="#fffbeb" stopOpacity={1} />
            <stop offset="50%" stopColor="#fef9e7" stopOpacity={1} />
            <stop offset="100%" stopColor="#fef3c7" stopOpacity={1} />
          </radialGradient>
          {/* Subtle vertical tint — warm honey at top, soft amber at bottom */}
          <linearGradient id="map-tint" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity={0.22} />
            <stop offset="50%" stopColor="#fffbeb" stopOpacity={0} />
            <stop offset="100%" stopColor="#fcd34d" stopOpacity={0.15} />
          </linearGradient>
          {/* Soft glow filter for revealed zone edges */}
          <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
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
        {/* Subtle color tint overlay for warmth and depth */}
        <rect
          x={0}
          y={0}
          width={1000}
          height={1200}
          fill="url(#map-tint)"
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
              stroke="rgba(20,20,20,0.14)"
              strokeWidth={5}
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
            const stroke = zoneColor(zone.id);
            return (
              <g key={zone.id}>
                <polygon
                  points={zone.polygonPoints}
                  fill={revealed ? "#ffffff" : "#f4f4f5"}
                  stroke={
                    revealed ? stroke : "rgba(20,20,20,0.1)"
                  }
                  strokeWidth={revealed ? 3 : 1.5}
                  filter={revealed ? "url(#edge-glow)" : undefined}
                  style={{
                    cursor: reachable ? "pointer" : "default",
                    transition:
                      "stroke 700ms cubic-bezier(0.32,0.72,0,1), fill 700ms cubic-bezier(0.32,0.72,0,1)",
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
                    fill={stroke}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.06, 0.16, 0.06] }}
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
                    fill={stroke}
                    opacity={0.1}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* Zone illustrations (icon-like assets centered per revealed zone) */}
        <g pointerEvents="none">
          {zones.map((zone) => {
            const revealed = fogState[zone.id] === true;
            const imgSrc = ZONE_IMAGES[zone.id];
            if (!revealed || !imgSrc || failedZoneImages.has(zone.id)) return null;
            const bbox = polygonBBox(zone.polygonPoints);
            const frame = iconFrame(zone.id, bbox);
            return (
              <image
                key={`img-${zone.id}`}
                href={imgSrc}
                x={frame.x}
                y={frame.y}
                width={frame.w}
                height={frame.h}
                preserveAspectRatio="xMidYMid meet"
                opacity={0.98}
                style={{ filter: "drop-shadow(0 8px 10px rgba(20,20,20,0.12))" }}
                onError={() =>
                  setFailedZoneImages((prev) => {
                    const next = new Set(prev);
                    next.add(zone.id);
                    return next;
                  })
                }
              />
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

        {/* Phantom friend avatars (only in revealed zones, VAL-CROSS-051) */}
        <PhantomAvatars />

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
   Doodle decoration wrapper
   ========================================================================== */

function Doodle({
  children,
  className,
  rotate = 0,
}: {
  children: React.ReactNode;
  className?: string;
  rotate?: number;
}) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -5, 0], rotate: [rotate, rotate + 4, rotate] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      style={{ rotate }}
    >
      {children}
    </motion.div>
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
