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
} from "@/data/mallData";
import { onPlayerEnterZone, onZoneRevealed, onStoreVisited } from "@/engine/taskEngine";
import { playAchievement } from "@/lib/sound";
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

/** Corner radius for all zone shapes — the key to Apple-aligned rounded rooms. */
const ZONE_RADIUS = 28;

/**
 * Architectural corridor strips — fills the structural gaps between zones
 * so the space between rooms reads as a connected hallway rather than empty air.
 * Each entry is { x, y, w, h } in the 1000×1200 SVG coordinate space.
 */
const CORRIDOR_STRIPS = [
  // Food Court ↔ Central Plaza  (horizontal, top section)
  { x: 360, y: 340, w: 280, h: 20 },
  // Central Plaza ↔ West Wing  (left connector)
  { x: 300, y: 620, w: 140, h: 20 },
  // Central Plaza ↔ East Wing  (right connector)
  { x: 560, y: 620, w: 140, h: 20 },
  // West Wing ↔ Entrance
  { x: 150, y: 980, w: 290, h: 20 },
  // East Wing ↔ Entrance
  { x: 560, y: 980, w: 290, h: 20 },
] as const;

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

/** Compute the bounding box {x, y, w, h} from polygon points string. */
function polygonBBox(points: string): { x: number; y: number; w: number; h: number } {
  const coords = points.split(/\s+/).map((p) => p.split(",").map(Number));
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

/**
 * Alias that returns the same bounding box as a rect descriptor.
 * All zones in mallData are rectangles so this is lossless.
 */
const polygonToRect = polygonBBox;

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
  const pushCelebration = useUIStore((s) => s.pushCelebration);
  const activeOverlay = useUIStore((s) => s.activeOverlay);

  const [failedZoneImages, setFailedZoneImages] = useState<Set<string>>(new Set());
  const [streakImgError, setStreakImgError] = useState(false);

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
          pushCelebration({
            message: `Secret Token! +${secret}`,
            amount: explore + secret,
            kind: "earn",
          });
          playAchievement(0.8);
        } else if (isFirstMove) {
          // First move from entrance: automatic first token (Day 1 2:00) on
          // top of the tier-multiplied exploration reward.
          const explore = awardTokens(EXPLORE_REWARD);
          addTokens(FIRST_TOKEN_BONUS);
          pushCelebration({
            message: `+1 Token!`,
            amount: explore + FIRST_TOKEN_BONUS,
            kind: "earn",
          });
          playAchievement(0.8);
          firstMoveDone = true;
        } else {
          const explore = awardTokens(EXPLORE_REWARD);
          pushCelebration({
            message: `+${explore} Tokens`,
            amount: explore,
            kind: "earn",
          });
          playAchievement(0.8);
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
          pushCelebration({
            message: `+${FIRST_TOKEN_BONUS} Token!`,
            amount: FIRST_TOKEN_BONUS,
            kind: "earn",
          });
          playAchievement(0.8);
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
      pushCelebration,
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
          {/* Warm architectural paper — slightly neutral to suggest floor-plan paper */}
          <radialGradient id="map-atmosphere" cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="#fdf8ee" stopOpacity={1} />
            <stop offset="55%" stopColor="#f7f0e0" stopOpacity={1} />
            <stop offset="100%" stopColor="#ede5d0" stopOpacity={1} />
          </radialGradient>
          {/* Subtle vertical warmth overlay */}
          <linearGradient id="map-tint" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity={0.14} />
            <stop offset="50%" stopColor="#fffbeb" stopOpacity={0} />
            <stop offset="100%" stopColor="#fcd34d" stopOpacity={0.10} />
          </linearGradient>

          {/* Floor tile grid pattern — renders inside revealed zone rooms */}
          <pattern id="floor-tiles" patternUnits="userSpaceOnUse" width="36" height="36">
            <rect width="36" height="36" fill="none" />
            <line x1="0" y1="0" x2="36" y2="0" stroke="rgba(20,20,20,0.04)" strokeWidth="1" />
            <line x1="0" y1="0" x2="0" y2="36" stroke="rgba(20,20,20,0.04)" strokeWidth="1" />
          </pattern>

          {/* Corridor hatching pattern — crosshatch for the hallway strips */}
          <pattern id="corridor-hatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(20,20,20,0.05)" strokeWidth="1.5" />
          </pattern>

          {/* Soft outer glow for revealed zone edges */}
          <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Inset shadow filter for zone depth */}
          <filter id="zone-inset" x="-5%" y="-5%" width="110%" height="110%">
            <feFlood floodColor="rgba(20,20,20,0.08)" result="flood" />
            <feComposite in="flood" in2="SourceGraphic" operator="in" result="shadow" />
            <feGaussianBlur in="shadow" stdDeviation="6" result="blurred" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="blurred" />
            </feMerge>
          </filter>

          {/* Per-zone rounded-rect clip paths — images + fog respect zone corners */}
          {zones.map((zone) => {
            const r = polygonToRect(zone.polygonPoints);
            return (
              <clipPath key={`clip-${zone.id}`} id={`clip-${zone.id}`}>
                <rect
                  x={r.x} y={r.y}
                  width={r.w} height={r.h}
                  rx={ZONE_RADIUS} ry={ZONE_RADIUS}
                />
              </clipPath>
            );
          })}

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

        {/* ── Architectural corridor strips ──────────────────────────────────
            These fill the structural gaps between rooms so the map reads as
            a connected floor plan rather than isolated floating zones.        */}
        <g pointerEvents="none">
          {CORRIDOR_STRIPS.map((c, i) => (
            <g key={i}>
              {/* Corridor floor — slightly warmer than background, darker than room */}
              <rect
                x={c.x} y={c.y}
                width={c.w} height={c.h}
                fill="#e8dfc8"
                rx={4}
              />
              {/* Corridor hatching for texture */}
              <rect
                x={c.x} y={c.y}
                width={c.w} height={c.h}
                fill="url(#corridor-hatch)"
                rx={4}
                opacity={0.6}
              />
              {/* Corridor center guide line */}
              <line
                x1={c.x + c.w / 2}
                y1={c.y}
                x2={c.x + c.w / 2}
                y2={c.y + c.h}
                stroke="rgba(20,20,20,0.10)"
                strokeWidth={1}
                strokeDasharray="3 5"
                strokeLinecap="round"
              />
            </g>
          ))}
        </g>

        {/* ── Zone rooms (rounded rectangles) ────────────────────────────────
            All zone polygons are rectangles in mallData, so we parse them
            into rect descriptors and render with rx=ZONE_RADIUS for proper
            Apple-style rounded corners. Each room gets:
            • A white/neutral fill (like a floor plan room)
            • A zone-colored stroke border (the "wall outline")
            • A subtle floor-tile grid inside revealed rooms
            • An inner-glow shadow for the "you are here" state              */}
        <g>
          {zones.map((zone) => {
            const revealed = fogState[zone.id] === true;
            const current = playerPosition.zoneId === zone.id;
            const reachable = isAdjacent(playerPosition.zoneId, zone.id) && !current;
            const stroke = zoneColor(zone.id);
            const r = polygonToRect(zone.polygonPoints);

            return (
              <g key={zone.id}>
                {/* ── Room floor fill ── */}
                <rect
                  x={r.x} y={r.y}
                  width={r.w} height={r.h}
                  rx={ZONE_RADIUS} ry={ZONE_RADIUS}
                  fill={revealed ? "#fafaf8" : "#f0ede6"}
                  stroke={revealed ? stroke : "rgba(20,20,20,0.12)"}
                  strokeWidth={revealed ? 3.5 : 2}
                  filter={revealed ? "url(#edge-glow)" : undefined}
                  style={{
                    cursor: reachable ? "pointer" : "default",
                    transition:
                      "stroke 700ms cubic-bezier(0.32,0.72,0,1), fill 700ms cubic-bezier(0.32,0.72,0,1), stroke-width 700ms cubic-bezier(0.32,0.72,0,1)",
                  }}
                  onClick={() => handleZoneClick(zone)}
                  data-testid={`zone-${zone.id}`}
                  data-reachable={reachable ? "true" : "false"}
                  data-revealed={revealed ? "true" : "false"}
                  aria-label={zone.name}
                  role={reachable ? "button" : undefined}
                />

                {/* ── Floor tile grid (revealed rooms only) ── */}
                {revealed && (
                  <rect
                    x={r.x} y={r.y}
                    width={r.w} height={r.h}
                    rx={ZONE_RADIUS} ry={ZONE_RADIUS}
                    fill="url(#floor-tiles)"
                    pointerEvents="none"
                  />
                )}

                {/* ── Corner accent dots — architectural notation ── */}
                {revealed && [
                  [r.x + ZONE_RADIUS, r.y + ZONE_RADIUS],
                  [r.x + r.w - ZONE_RADIUS, r.y + ZONE_RADIUS],
                  [r.x + ZONE_RADIUS, r.y + r.h - ZONE_RADIUS],
                  [r.x + r.w - ZONE_RADIUS, r.y + r.h - ZONE_RADIUS],
                ].map(([cx, cy], i) => (
                  <circle
                    key={i}
                    cx={cx} cy={cy}
                    r={3}
                    fill={stroke}
                    opacity={0.35}
                    pointerEvents="none"
                  />
                ))}

                {/* ── Reachable pulse overlay ── */}
                {reachable && (
                  <motion.rect
                    x={r.x} y={r.y}
                    width={r.w} height={r.h}
                    rx={ZONE_RADIUS} ry={ZONE_RADIUS}
                    fill={stroke}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.06, 0.18, 0.06] }}
                    transition={{ duration: 2.4, ease: PREMIUM_EASE, repeat: Infinity }}
                    pointerEvents="none"
                    data-testid={`zone-hint-${zone.id}`}
                  />
                )}

                {/* ── Current zone soft tint ── */}
                {current && (
                  <rect
                    x={r.x} y={r.y}
                    width={r.w} height={r.h}
                    rx={ZONE_RADIUS} ry={ZONE_RADIUS}
                    fill={stroke}
                    opacity={0.09}
                    pointerEvents="none"
                  />
                )}

                {/* ── Revealed: inner wall-edge shadow line ── */}
                {revealed && (
                  <rect
                    x={r.x + 1} y={r.y + 1}
                    width={r.w - 2} height={r.h - 2}
                    rx={ZONE_RADIUS - 1} ry={ZONE_RADIUS - 1}
                    fill="none"
                    stroke="rgba(255,255,255,0.8)"
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* ── Zone illustrations — clipped to the rounded zone rect ────────
            The clipPath ensures PNGs can never bleed over the rounded corner
            walls, even if scale/position tweaks cause slight overflow.       */}
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
                opacity={0.97}
                clipPath={`url(#clip-${zone.id})`}
                style={{ filter: "drop-shadow(0 10px 14px rgba(20,20,20,0.14))" }}
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



// Module-level flag: has the player made their first move from the entrance?
// (Per Day 1 minute 2:00 the first token is found automatically on the
// initial path. This is a session-only flag, intentionally not persisted.)
let firstMoveDone = false;

/** Test-only helper to reset the first-move flag between tests. */
export function __resetFirstMoveFlag(): void {
  firstMoveDone = false;
}

export default MallMap;
