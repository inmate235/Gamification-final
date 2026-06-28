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

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;
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
        ease: "linear",
        times: hasWaypoints ? [0, 0.5, 1] : undefined,
      }}
      data-testid="player-avatar"
      aria-label="Your avatar"
    >
      {/* Outer pulsing glow ring */}
      <motion.circle
        r={14}
        fill="#e6009e"
        opacity={0.25}
        animate={{ scale: [1, 1.5, 1], opacity: [0.25, 0.05, 0.25] }}
        transition={{
          duration: 2.4,
          ease: PREMIUM_EASE,
          repeat: Infinity,
        }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      {/* Mid glow */}
      <circle r={9} fill="#e6009e" opacity={0.35} />
      {/* Core magenta dot */}
      <circle
        r={6}
        fill="#e6009e"
        stroke="#ff9ed4"
        strokeWidth={1.5}
        style={{ filter: "drop-shadow(0 0 8px rgba(230,0,158,0.8))" }}
      />
      {/* Inner highlight */}
      <circle r={2} fill="#ffd6f0" opacity={0.9} />
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
