"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useMapStore } from "@/stores/mapStore";
import { getCorridorPath } from "@/data/mallData";
import type { PlayerPosition } from "@/types";

/**
 * PlayerAvatar — the pulsing gold dot representing the player on the map.
 *
 * Visually distinct from store markers and phantoms: a gold dot with a
 * pulsing glow ring (per VAL-MAP-036). When the player moves between zones
 * the avatar animates along the corridor path (current center → corridor
 * midpoint → target center) using the premium easing curve, rather than
 * cutting a straight diagonal (per VAL-MAP-009).
 *
 * The mapStore is the source of truth for the player's final position; this
 * component tracks the previous zone in a ref (read inside an effect) and
 * stores the animated corridor keyframes in state.
 */

const MOVE_DURATION = 2.5; // seconds — slower to match a walking pace

interface AvatarPath {
  x: number[];
  y: number[];
  zone: string;
}

export function PlayerAvatar() {
  const playerPosition = useMapStore((s) => s.playerPosition);

  const [path, setPath] = useState<AvatarPath>({
    x: [playerPosition.x],
    y: [playerPosition.y],
    zone: playerPosition.zoneId,
  });
  const prevZoneRef = useRef<string>(playerPosition.zoneId);

  /* --- Recompute the corridor keyframes whenever the zone changes --- */
  useEffect(() => {
    const prev = prevZoneRef.current;
    if (prev === playerPosition.zoneId) return;
    const points = getCorridorPath(prev, playerPosition.zoneId);
    setPath({
      x: points.map((p) => p.x),
      y: points.map((p) => p.y),
      zone: playerPosition.zoneId,
    });
    prevZoneRef.current = playerPosition.zoneId;
  }, [playerPosition.zoneId, playerPosition.x, playerPosition.y]);

  const hasWaypoints = path.x.length > 1;

  // Track target x direction to flip the avatar image
  const targetX = path.x[path.x.length - 1] ?? playerPosition.x;
  const [isFlipped, setIsFlipped] = useState(false);
  const prevTargetXRef = useRef(targetX);

  useEffect(() => {
    if (targetX < prevTargetXRef.current) {
      setIsFlipped(true); // walking left
    } else if (targetX > prevTargetXRef.current) {
      setIsFlipped(false); // walking right
    }
    prevTargetXRef.current = targetX;
  }, [targetX]);

  return (
    <motion.g
      key={path.zone}
      initial={false}
      animate={{
        x: path.x,
        y: path.y,
      }}
      transition={{
        duration: MOVE_DURATION,
        ease: "easeInOut",
        times: hasWaypoints ? [0, 0.5, 1] : undefined,
      }}
      data-testid="player-avatar"
      aria-label="Your avatar"
    >
      {/* Gamified Player Name Tag Pill */}
      <g transform="translate(0, -80)" style={{ pointerEvents: "none", userSelect: "none" }}>
        <rect
          x={-24}
          y={-8}
          width={48}
          height={16}
          rx={6}
          fill="#ffe600"
          stroke="#141414"
          strokeWidth={1.5}
          style={{ filter: "drop-shadow(0 2px 4px rgba(20,20,20,0.2))" }}
        />
        <text
          x={0}
          y={3}
          textAnchor="middle"
          fill="#141414"
          fontSize="9px"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          You
        </text>
      </g>

      {/* Walking sway/bobbing animation wrapper */}
      <motion.g
        animate={{
          y: [0, -4, 0],
          rotate: [-3, 3, -3],
          scaleX: isFlipped ? -1 : 1,
        }}
        transition={{
          y: { duration: 0.7, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 0.7, repeat: Infinity, ease: "easeInOut" },
          scaleX: { duration: 0.25 }
        }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        {/* Animated shopper GIF — 172×129px (player-sized, largest on map) */}
        <image
          href="/assets/avatar/shopper.gif"
          x={-86}
          y={-64.5}
          width={172}
          height={129}
          preserveAspectRatio="xMidYMid meet"
          style={{
            filter: "drop-shadow(0 0 12px rgba(230,0,158,0.7))",
            imageRendering: "auto",
          }}
        />
      </motion.g>
    </motion.g>
  );
}

/**
 * Returns true if the given position falls within the entrance zone.
 * Exposed for re-use / tests.
 */
export function isAtEntrance(pos: PlayerPosition): boolean {
  return pos.zoneId === "zone-entrance";
}

export default PlayerAvatar;
