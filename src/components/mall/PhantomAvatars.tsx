"use client";

import { useMemo, useState, useEffect, useRef } from "react";
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

  // Deterministic staggered delay and movement speed derived from the phantom
  // id so the pulsing rings are desynchronized and each phantom walks at a
  // slightly different pace (4–10s) without calling Math.random during render.
  const { moveDuration } = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < phantom.id.length; i += 1) {
      hash = (hash * 31 + phantom.id.charCodeAt(i)) | 0;
    }
    const absHash = Math.abs(hash);
    return {
      moveDuration: 4 + (absHash % 7), // 4–10 seconds
    };
  }, [phantom.id]);

  const [isFlipped, setIsFlipped] = useState(false);
  const prevXRef = useRef(x);

  useEffect(() => {
    if (x < prevXRef.current) {
      setIsFlipped(true); // walking left
    } else if (x > prevXRef.current) {
      setIsFlipped(false); // walking right
    }
    prevXRef.current = x;
  }, [x]);

  return (
    <motion.g
      key={phantom.id}
      initial={{ opacity: 0, scale: 0.5, x, y }}
      animate={{ opacity: 1, scale: 1, x, y }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{
        opacity: { duration: 0.5, ease: PREMIUM_EASE },
        scale: { duration: 0.5, ease: PREMIUM_EASE },
        x: { duration: moveDuration, ease: "easeInOut" },
        y: { duration: moveDuration, ease: "easeInOut" }
      }}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      data-testid={`phantom-avatar-${phantom.id}`}
      aria-label={`${phantom.name}: ${phantom.currentAction}`}
    >
      {/* Gamified Name Tag Pill */}
      <g transform="translate(0, -48)" style={{ pointerEvents: "none", userSelect: "none" }}>
        <rect
          x={-22}
          y={-7}
          width={44}
          height={14}
          rx={5}
          fill="rgba(26, 26, 26, 0.85)"
          stroke="#c4b5fd"
          strokeWidth={1}
          style={{ filter: "drop-shadow(0 1px 3px rgba(20,20,20,0.12))" }}
        />
        <text
          x={0}
          y={3}
          textAnchor="middle"
          fill="#ffffff"
          fontSize="8px"
          fontWeight="700"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {phantom.name}
        </text>
      </g>

      {/* Walking sway/bobbing animation wrapper */}
      <motion.g
        animate={{
          y: [0, -3, 0],
          rotate: [-3, 3, -3],
          scaleX: isFlipped ? -1 : 1,
        }}
        transition={{
          y: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
          scaleX: { duration: 0.25 }
        }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        {/* Animated shopper GIF — 90×67.5px (smaller than player's) */}
        <image
          href="/assets/avatar/shopper.gif"
          x={-45}
          y={-33.75}
          width={90}
          height={67.5}
          preserveAspectRatio="xMidYMid meet"
          style={{
            filter: "drop-shadow(0 0 5px rgba(124,58,237,0.5))",
            imageRendering: "auto",
          }}
        />
      </motion.g>
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
