"use client";

import React, { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useFountainStore } from "@/stores/fountainStore";
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
import { AmbientCrowd } from "@/components/mall/AmbientCrowd";
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
  // Food Court ↔ Central Plaza (both are x=220–780, centered strip)
  { x: 330, y: 340, w: 340, h: 20 },
  // Central Plaza (x=220–780) ↔ West Wing (x=60–460) — overlap x=220–460
  { x: 235, y: 620, w: 215, h: 20 },
  // Central Plaza (x=220–780) ↔ East Wing (x=540–940) — overlap x=540–780
  { x: 550, y: 620, w: 215, h: 20 },
  // West Wing (x=60–460) ↔ Entrance (x=60–940) — overlap x=60–460
  { x: 80, y: 980, w: 365, h: 20 },
  // East Wing (x=540–940) ↔ Entrance (x=60–940) — overlap x=540–940
  { x: 555, y: 980, w: 365, h: 20 },
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
  // Entrance is now 880×180 — keep image wide and centered vertically
  [ZONE_ENTRANCE]: { scale: 0.78, dy: 0.04 },
  // East Wing is now 400×340 — slightly less dx offset needed in wider zone
  [ZONE_EAST_WING]: { scale: 0.97, dx: -0.05 },
  // West Wing is now 400×340 — slightly less dx offset needed in wider zone
  [ZONE_WEST_WING]: { scale: 0.80, dx: -0.07 },
  // Central Plaza is now 560×260 — can scale up a touch
  [ZONE_CENTRAL_PLAZA]: { scale: 0.78 },
  // Food Court is now 560×280 — can scale up a touch
  [ZONE_FOOD_COURT]: { scale: 0.60, dy: 0.02 },
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

/**
 * Build an SVG path string for a rounded rectangle that has a single
 * concave arc "indent" on one vertical side — used for the West Wing
 * (right-side indent) and East Wing (left-side indent) to create the
 * scalloped atrium recess facing the central fountain corridor.
 *
 * @param r        Zone bounding rect
 * @param rx       Corner radius
 * @param side     Which vertical edge gets the indent
 * @param indentCY Y centre of the indent arc
 * @param arcR     Circle radius for the indent arc (larger = shallower)
 * @param arcSpan  Vertical span of the indent chord in SVG units
 */
function buildIndentPath(
  r: { x: number; y: number; w: number; h: number },
  rx: number,
  side: "left" | "right",
  indentCY: number,
  arcR: number,
  arcSpan: number,
): string {
  const { x, y, w, h } = r;
  const x2 = x + w;
  const y2 = y + h;
  const arcTop = indentCY - arcSpan / 2;
  const arcBot = indentCY + arcSpan / 2;

  if (side === "right") {
    // Path traces the zone clockwise; right edge goes DOWN, indent bows LEFT (sweep=0).
    return [
      `M ${x + rx},${y}`,
      `L ${x2 - rx},${y}`,
      `Q ${x2},${y} ${x2},${y + rx}`,
      `L ${x2},${arcTop}`,
      `A ${arcR},${arcR} 0 0,0 ${x2},${arcBot}`,
      `L ${x2},${y2 - rx}`,
      `Q ${x2},${y2} ${x2 - rx},${y2}`,
      `L ${x + rx},${y2}`,
      `Q ${x},${y2} ${x},${y2 - rx}`,
      `L ${x},${y + rx}`,
      `Q ${x},${y} ${x + rx},${y}`,
      "Z",
    ].join(" ");
  } else {
    // Path traces the zone clockwise; left edge goes UP, indent bows RIGHT (sweep=0
    // mirrors the right-side sweep=0 — both use CCW arc so they bow symmetrically
    // inward toward their respective zone interiors).
    return [
      `M ${x + rx},${y}`,
      `L ${x2 - rx},${y}`,
      `Q ${x2},${y} ${x2},${y + rx}`,
      `L ${x2},${y2 - rx}`,
      `Q ${x2},${y2} ${x2 - rx},${y2}`,
      `L ${x + rx},${y2}`,
      `Q ${x},${y2} ${x},${y2 - rx}`,
      `L ${x},${arcBot}`,
      `A ${arcR},${arcR} 0 0,0 ${x},${arcTop}`,
      `L ${x},${y + rx}`,
      `Q ${x},${y} ${x + rx},${y}`,
      "Z",
    ].join(" ");
  }
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
      const revealedCount = Object.values(fogState).filter(Boolean).length;
      const isFirstMove = currentZoneId === ZONE_ENTRANCE && !firstMoveDone && revealedCount <= 1;
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
            <line x1="0" y1="0" x2="36" y2="0" stroke="rgba(20,20,20,0.14)" strokeWidth="1" />
            <line x1="0" y1="0" x2="0" y2="36" stroke="rgba(20,20,20,0.14)" strokeWidth="1" />
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

          {/* Per-zone clip paths — indented zones use path, others use rect */}
          {zones.map((zone) => {
            const r = polygonToRect(zone.polygonPoints);
            const isWest = zone.id === ZONE_WEST_WING;
            const isEast = zone.id === ZONE_EAST_WING;
            return (
              <clipPath key={`clip-${zone.id}`} id={`clip-${zone.id}`}>
                {isWest ? (
                  <path d={buildIndentPath(r, ZONE_RADIUS, "right", 810, 100, 160)} />
                ) : isEast ? (
                  <path d={buildIndentPath(r, ZONE_RADIUS, "left", 810, 100, 160)} />
                ) : (
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={ZONE_RADIUS} ry={ZONE_RADIUS} />
                )}
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

        {/* ── All map content shifted 10 SVG units up ── */}
        <g transform="translate(0, -10)">

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
            const isWest = zone.id === ZONE_WEST_WING;
            const isEast = zone.id === ZONE_EAST_WING;
            const hasIndent = isWest || isEast;
            const indentSide = isWest ? "right" : "left";
            const indentPath = hasIndent
              ? buildIndentPath(r, ZONE_RADIUS, indentSide, 810, 100, 160)
              : "";

            const sharedPathProps = {
              fill: revealed ? "#fafaf8" : "#f0ede6",
              stroke: revealed ? stroke : "rgba(20,20,20,0.12)",
              strokeWidth: revealed ? 3.5 : 2,
              filter: revealed ? "url(#edge-glow)" : undefined,
              style: {
                cursor: reachable ? "pointer" : "default",
                transition:
                  "stroke 700ms cubic-bezier(0.32,0.72,0,1), fill 700ms cubic-bezier(0.32,0.72,0,1), stroke-width 700ms cubic-bezier(0.32,0.72,0,1)",
              } as React.CSSProperties,
              onClick: () => handleZoneClick(zone),
              "data-testid": `zone-${zone.id}`,
              "data-reachable": reachable ? "true" : "false",
              "data-revealed": revealed ? "true" : "false",
              "aria-label": zone.name,
              role: reachable ? ("button" as const) : undefined,
            };

            return (
              <g key={zone.id}>
                {/* ── Room floor fill ── */}
                {hasIndent ? (
                  <path d={indentPath} {...sharedPathProps} />
                ) : (
                  <rect
                    x={r.x} y={r.y}
                    width={r.w} height={r.h}
                    rx={ZONE_RADIUS} ry={ZONE_RADIUS}
                    {...sharedPathProps}
                  />
                )}

                {/* ── Floor tile grid (revealed rooms only) ── */}
                {revealed && (
                  hasIndent ? (
                    <path
                      d={indentPath}
                      fill="url(#floor-tiles)"
                      pointerEvents="none"
                    />
                  ) : (
                    <rect
                      x={r.x} y={r.y}
                      width={r.w} height={r.h}
                      rx={ZONE_RADIUS} ry={ZONE_RADIUS}
                      fill="url(#floor-tiles)"
                      pointerEvents="none"
                    />
                  )
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
                  hasIndent ? (
                    <motion.path
                      d={indentPath}
                      fill={stroke}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.06, 0.18, 0.06] }}
                      transition={{ duration: 2.4, ease: PREMIUM_EASE, repeat: Infinity }}
                      pointerEvents="none"
                      data-testid={`zone-hint-${zone.id}`}
                    />
                  ) : (
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
                  )
                )}

                {/* ── Current zone soft tint ── */}
                {current && (
                  hasIndent ? (
                    <path
                      d={indentPath}
                      fill={stroke}
                      opacity={0.09}
                      pointerEvents="none"
                    />
                  ) : (
                    <rect
                      x={r.x} y={r.y}
                      width={r.w} height={r.h}
                      rx={ZONE_RADIUS} ry={ZONE_RADIUS}
                      fill={stroke}
                      opacity={0.09}
                      pointerEvents="none"
                    />
                  )
                )}

                {/* ── Revealed: inner wall-edge highlight ── */}
                {revealed && (
                  hasIndent ? (
                    <path
                      d={buildIndentPath(
                        { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 },
                        ZONE_RADIUS - 1,
                        indentSide,
                        810,
                        100,
                        158,
                      )}
                      fill="none"
                      stroke="rgba(255,255,255,0.8)"
                      strokeWidth={2}
                      pointerEvents="none"
                    />
                  ) : (
                    <rect
                      x={r.x + 1} y={r.y + 1}
                      width={r.w - 2} height={r.h - 2}
                      rx={ZONE_RADIUS - 1} ry={ZONE_RADIUS - 1}
                      fill="none"
                      stroke="rgba(255,255,255,0.8)"
                      strokeWidth={2}
                      pointerEvents="none"
                    />
                  )
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

        {/* ── Atrium fountain — between West Wing and East Wing ──────────────
            Sits in the 120 SVG-unit gap (x=440–560, y=640–980) that
            separates the two wings. Appears when either wing is revealed.
            Tapping the fountain opens the Wishing Fountain cinematic overlay.  */}
        <FountainLandmark
          visible={
            fogState[ZONE_WEST_WING] === true ||
            fogState[ZONE_EAST_WING] === true
          }
        />

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

        {/* Ambient background crowd (only in revealed zones) */}
        <AmbientCrowd />

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

        </g>{/* end translate(0, -10) */}
      </svg>
    </div>
  );
}

/* ============================================================================
   Fountain landmark — atrium between West Wing and East Wing
   ========================================================================== */

/**
 * FountainLandmark — the crown-fountain PNG centred in the open corridor
 * between West Wing (right edge x=440) and East Wing (left edge x=560).
 *
 * Visual stack (bottom → top):
 *   1. Three staggered horizontal ripple ellipses (sky-blue, pulsing outward)
 *   2. The fountain PNG (gently floating up/down)
 *
 * Sits at SVG centre-point (500, 810) — midway between the two wings both
 * horizontally and vertically.
 */
function FountainLandmark({ visible }: { visible: boolean }) {
  const showOverlay = useUIStore((s) => s.showOverlay);
  const hasMet = useFountainStore((s) => s.hasMet);
  const canWish = useFountainStore((s) => s.canWish);
  // Fountain centre in SVG space — original atrium midpoint
  const cx = 500;
  const cy = 810;
  // PNG frame — expanded to 210×210 to fill the wider atrium corridor
  const fw = 210;
  const fh = 210;
  const fx = cx - fw / 2;
  const fy = cy - fh / 2;
  // Water basin base Y (slightly below image centre)
  const basinY = cy + fh * 0.34;
  // Show a "tap me" hint while the player has not met the fountain yet, or
  // when a wish is available again after cooldown.
  const showHint = visible && (!hasMet || canWish());

  return (
    <motion.g
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 1.2, ease: [0.32, 0.72, 0, 1] }}
      data-testid="fountain-landmark"
    >
      {/* ── Atrium floor disc — grounds the fountain in the corridor ── */}
      <ellipse
        cx={cx}
        cy={basinY}
        rx={68}
        ry={18}
        fill="rgba(186,230,253,0.22)"
        stroke="rgba(56,189,248,0.18)"
        strokeWidth={1}
      />

      {/* ── Water ripple ellipses — wider to match larger atrium ── */}
      {[
        { rx: 110, ry: 28, delay: 0 },
        { rx: 82, ry: 21, delay: 1.3 },
        { rx: 54, ry: 14, delay: 2.6 },
      ].map(({ rx, ry, delay }, i) => (
        <motion.ellipse
          key={i}
          cx={cx}
          cy={basinY}
          rx={rx}
          ry={ry}
          fill="rgba(56,189,248,0.10)"
          stroke="rgba(56,189,248,0.28)"
          strokeWidth={1.5}
          animate={{
            scale: [1, 1.35, 1],
            opacity: [0.7, 0, 0.7],
          }}
          transition={{
            duration: 4,
            delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ transformOrigin: `${cx}px ${basinY}px` }}
        />
      ))}

      {/* ── "Tap me" hint ring — pulses to invite interaction ── */}
      {showHint && (
        <motion.ellipse
          cx={cx}
          cy={cy + 10}
          rx={fw * 0.42}
          ry={fw * 0.42}
          fill="none"
          stroke="rgba(245,158,11,0.55)"
          strokeWidth={2.5}
          strokeDasharray="6 6"
          animate={{ scale: [1, 1.12, 1], opacity: [0.65, 0.15, 0.65] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${cx}px ${cy + 10}px` }}
          pointerEvents="none"
          data-testid="fountain-tap-hint"
        />
      )}

      {/* ── Fountain PNG — gently floating; tappable to open the cinematic ── */}
      <motion.image
        href="/assets/map/fountain.png"
        x={fx}
        y={fy}
        width={fw}
        height={fh}
        preserveAspectRatio="xMidYMid meet"
        animate={{ y: [0, -7, 0] }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          filter:
            "drop-shadow(0 16px 26px rgba(56,189,248,0.50)) drop-shadow(0 4px 8px rgba(20,20,20,0.20))",
          cursor: visible ? "pointer" : "default",
        }}
        onClick={() => visible && showOverlay("fountain")}
        role={visible ? "button" : undefined}
        aria-label={visible ? "Open the MurkyMall Wishing Fountain" : undefined}
      />
    </motion.g>
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
