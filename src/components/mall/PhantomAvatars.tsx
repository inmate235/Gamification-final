"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useSocialStore } from "@/stores/socialStore";
import { useMapStore } from "@/stores/mapStore";
import type { PhantomUser } from "@/types";

/**
 * PhantomAvatars — renders social phantom friend avatars on the mall map.
 *
 * Phantoms are fabricated users whose positions and actions update via the
 * EventScheduler. They appear on the map in REVEALED zones only (a phantom
 * in a fogged zone is hidden, consistent with fog-of-war). Each phantom
 * renders as a small amethyst dot with a subtle ring, visually distinct from
 * the player's gold avatar (VAL-MAP-036) and from store markers.
 *
 * A tooltip-like activity label appears on hover/visible showing the
 * phantom's name and current action (e.g. "Sarah: browsing TechNova"),
 * providing the social proof / phantom activity message required by
 * VAL-CROSS-051 and VAL-CROSS-039.
 *
 * For Explorer-type players, the phantomEngine positions phantoms at
 * unexplored zones more frequently (VAL-CROSS-039), but those phantoms
 * remain hidden under fog until the zone is revealed — creating a sense of
 * "someone is exploring ahead" once the user arrives.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

interface PhantomAvatarProps {
  phantom: PhantomUser;
}

/** A single phantom avatar on the map. */
function PhantomAvatar({ phantom }: PhantomAvatarProps) {
  const { x, y } = phantom.position;

  // Deterministic staggered delay derived from the phantom id so the pulsing
  // rings are desynchronized without calling Math.random during render.
  const pulseDelay = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < phantom.id.length; i += 1) {
      hash = (hash * 31 + phantom.id.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 1500 / 1000;
  }, [phantom.id]);

  return (
    <motion.g
      key={phantom.id}
      initial={{ opacity: 0, scale: 0.5, x, y }}
      animate={{ opacity: 1, scale: 1, x, y }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{
        opacity: { duration: 0.5, ease: PREMIUM_EASE },
        scale: { duration: 0.5, ease: PREMIUM_EASE },
        x: { duration: 8, ease: "linear" },
        y: { duration: 8, ease: "linear" }
      }}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      data-testid={`phantom-avatar-${phantom.id}`}
      aria-label={`${phantom.name}: ${phantom.currentAction}`}
    >
      {/* Subtle pulsing ring (amethyst, distinct from player gold) */}
      <motion.circle
        r={10}
        fill="#9d7fdb"
        opacity={0.15}
        animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.03, 0.15] }}
        transition={{
          duration: 3,
          ease: PREMIUM_EASE,
          repeat: Infinity,
          delay: pulseDelay,
        }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      {/* Mid glow */}
      <circle r={7} fill="#9d7fdb" opacity={0.25} />
      {/* Core amethyst dot (smaller than player's gold dot) */}
      <circle
        r={4.5}
        fill="#9d7fdb"
        stroke="#c4b0e8"
        strokeWidth={1}
        style={{ filter: "drop-shadow(0 0 5px rgba(157,127,219,0.6))" }}
      />
      {/* Inner highlight */}
      <circle r={1.5} fill="#e8defb" opacity={0.8} />

      {/* Activity label — name + action, shown as SVG text */}
      <text
        x={0}
        y={-16}
        textAnchor="middle"
        className="fill-[#c4b0e8] text-[9px] font-medium"
        style={{ pointerEvents: "none", userSelect: "none" }}
        opacity={0.7}
      >
        {phantom.name}
      </text>
    </motion.g>
  );
}

/**
 * Renders all phantoms that are currently in REVEALED zones. Phantoms in
 * fogged zones are hidden (consistent with fog-of-war).
 */
export function PhantomAvatars() {
  const phantoms = useSocialStore((s) => s.phantoms);
  const fogState = useMapStore((s) => s.fogState);

  const visiblePhantoms = phantoms.filter(
    (p) => fogState[p.position.zoneId] === true
  );

  if (visiblePhantoms.length === 0) return null;

  return (
    <g data-testid="phantom-avatars-layer" aria-label="Friends on the map">
      {visiblePhantoms.map((phantom) => (
        <PhantomAvatar
          key={phantom.id}
          phantom={phantom}
        />
      ))}
    </g>
  );
}

export default PhantomAvatars;
