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
 *
 * Fading footprint trails trail behind each moving phantom so the player
 * sees where they've been walking, reinforcing the "lots of people walking"
 * impression.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/** Number of fading trail dots behind each phantom. */
const TRAIL_LENGTH = 2;

interface PhantomAvatarProps {
  phantom: PhantomUser;
}

/** A single phantom avatar on the map. */
function PhantomAvatar({ phantom }: PhantomAvatarProps) {
  const { x, y } = phantom.position;

  // Deterministic movement speed per phantom. Durations are kept just under
  // the 2-second phantom tick so the walk animation is continuous — the
  // avatar is always mid-stride when the next position arrives.
  const { moveDuration } = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < phantom.id.length; i += 1) {
      hash = (hash * 31 + phantom.id.charCodeAt(i)) | 0;
    }
    const absHash = Math.abs(hash);
    return {
      moveDuration: 1.4 + (absHash % 4) * 0.15, // 1.4 .. 1.85 seconds
    };
  }, [phantom.id]);

  const [isFlipped, setIsFlipped] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const prevPosRef = useRef({ x, y });
  // Brief grace period after a position change before we mark idle again.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const moved = x !== prevPosRef.current.x || y !== prevPosRef.current.y;
    if (moved) {
      if (x < prevPosRef.current.x) setIsFlipped(true);
      else if (x > prevPosRef.current.x) setIsFlipped(false);
      prevPosRef.current = { x, y };
      setIsMoving(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      // Keep walking animation alive for the full moveDuration, then idle.
      idleTimerRef.current = setTimeout(() => setIsMoving(false), moveDuration * 1000);
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y]);

  return (
    <motion.g
      key={phantom.id}
      initial={{ opacity: 0, scale: 0.5, x, y }}
      animate={{ opacity: 1, scale: 1, x, y }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{
        opacity: { duration: 0.5, ease: PREMIUM_EASE },
        scale: { duration: 0.5, ease: PREMIUM_EASE },
        x: { duration: moveDuration, ease: [0.25, 0.1, 0.25, 1] },
        y: { duration: moveDuration, ease: [0.25, 0.1, 0.25, 1] },
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

      {/* Walking sway/bobbing — active only while position is changing */}
      <motion.g
        animate={{
          y: isMoving ? [0, -3, 0] : 0,
          rotate: isMoving ? [-3, 3, -3] : 0,
          scaleX: isFlipped ? -1 : 1,
        }}
        transition={{
          y: { duration: 0.55, repeat: isMoving ? Infinity : 0, ease: "easeInOut" },
          rotate: { duration: 0.55, repeat: isMoving ? Infinity : 0, ease: "easeInOut" },
          scaleX: { duration: 0.2 },
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

/* ============================================================================
   Phantom trails — fading footprint dots behind moving phantoms
   ========================================================================== */

interface TrailEntry {
  lastSeen: { x: number; y: number } | null;
  trail: Array<{ x: number; y: number }>;
}

/**
 * Module-level trail cache (NOT a React ref) — stores each phantom's recent
 * positions so we can render fading footprint dots. Updated during render
 * with a position-change guard, which is safe under React strict-mode
 * double-rendering because the guard prevents duplicate pushes.
 */
const trailCache = new Map<string, TrailEntry>();

/**
 * PhantomTrails — renders small fading dots at each phantom's recent
 * positions so the player sees where they've walked. The dots are static
 * (no animation) and semi-transparent; they read as footprints left behind
 * as the avatar strides away.
 */
function PhantomTrails({ phantoms }: { phantoms: PhantomUser[] }) {
  for (const p of phantoms) {
    const st = trailCache.get(p.id);
    if (!st) {
      trailCache.set(p.id, {
        lastSeen: { x: p.position.x, y: p.position.y },
        trail: [],
      });
      continue;
    }
    if (
      st.lastSeen &&
      (st.lastSeen.x !== p.position.x || st.lastSeen.y !== p.position.y)
    ) {
      st.trail = [st.lastSeen, ...st.trail].slice(0, TRAIL_LENGTH);
      st.lastSeen = { x: p.position.x, y: p.position.y };
    }
  }

  return (
    <g data-testid="phantom-trails-layer" style={{ pointerEvents: "none" }}>
      {phantoms.map((p) => {
        const st = trailCache.get(p.id);
        const trail = st?.trail ?? [];
        return trail.map((pos, i) => (
          <circle
            key={`${p.id}-trail-${i}`}
            cx={pos.x}
            cy={pos.y}
            r={4 - i}
            fill="#c4b5fd"
            opacity={0.3 - i * 0.12}
          />
        ));
      })}
    </g>
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
      <PhantomTrails phantoms={visiblePhantoms} />
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
