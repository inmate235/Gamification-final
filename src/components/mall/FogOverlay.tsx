"use client";

import { motion } from "framer-motion";
import type { Zone } from "@/types";

/**
 * FogOverlay — the dark mist layer applied to unexplored zones.
 *
 * Uses an SVG filter (feTurbulence + feDisplacementMap) to render a misty,
 * atmospheric fog rather than a flat color block. When a zone is revealed the
 * overlay fades out with the premium easing curve.
 *
 * The fog layer never blocks pointer events on reachable adjacent zones:
 * `pointerEvents="none"` lets clicks pass through to the zone polygon beneath.
 */

interface FogOverlayProps {
  zone: Zone;
  revealed: boolean;
}

export function FogOverlay({ zone, revealed }: FogOverlayProps) {
  const filterId = `fog-${zone.id}`;

  return (
    <motion.g
      initial={false}
      animate={{ opacity: revealed ? 0 : 1 }}
      transition={{ duration: 1.2, ease: [0.32, 0.72, 0, 1] }}
      pointerEvents="none"
      data-testid={`fog-${zone.id}`}
      aria-hidden={revealed ? true : undefined}
    >
      {/* Misty light cloud fill with turbulence displacement */}
      <polygon
        points={zone.polygonPoints}
        fill={`url(#${filterId}-grad)`}
        filter={`url(#${filterId}-mist)`}
        opacity={0.96}
      />
      {/* Extra white veil so unexplored zones read as obscured */}
      <polygon
        points={zone.polygonPoints}
        fill="#ffffff"
        opacity={0.7}
      />
    </motion.g>
  );
}

/**
 * FogFilterDefs — the SVG <defs> for all fog gradients + filters.
 * Rendered once inside the map <svg> so each zone can reference them by id.
 */
export function FogFilterDefs({ zones }: { zones: Zone[] }) {
  return (
    <defs>
      {zones.map((zone) => {
        const gradId = `fog-${zone.id}-grad`;
        const filterId = `fog-${zone.id}-mist`;
        return (
          <g key={zone.id}>
            {/* Radial light gradient centered on the zone for cloud depth */}
            <radialGradient id={gradId} cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#f4f4f5" stopOpacity={0.95} />
              <stop offset="60%" stopColor="#e4e4e7" stopOpacity={0.97} />
              <stop offset="100%" stopColor="#d4d4d8" stopOpacity={1} />
            </radialGradient>
            {/* Misty turbulence filter */}
            <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.018 0.022"
                numOctaves={3}
                seed={hashSeed(zone.id)}
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="26"
                xChannelSelector="R"
                yChannelSelector="G"
              />
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
          </g>
        );
      })}
    </defs>
  );
}

/** Deterministic integer seed from a zone id (stable turbulence per zone). */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000;
}

export default FogOverlay;
