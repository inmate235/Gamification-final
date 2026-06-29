"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useCrowdStore } from "@/stores/crowdStore";
import { useMapStore } from "@/stores/mapStore";
import type { CrowdNPC } from "@/stores/crowdStore";

/**
 * AmbientCrowd — renders the lightweight background shopper dots on the map.
 *
 * These are simple colored circles (no GIFs, no name tags) that wander the
 * mall, browse stores, and flow through corridors. They appear ONLY in
 * revealed zones (fog-of-war) but the simulation runs for all zones so newly
 * revealed areas already feel populated.
 *
 * Each dot animates smoothly between positions via Framer Motion with a
 * duration just under the 2-second crowd tick so movement reads as
 * continuous walking rather than jump-then-freeze.
 */

/** Small deterministic hash from an id string -> 0..1. */
function hash01(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000;
}

/** A single ambient crowd dot. */
function CrowdDot({ npc }: { npc: CrowdNPC }) {
  const { x, y, hue, size, phase, speed } = npc;

  // Per-dot timing derived from id + speed so the crowd is never in lockstep.
  const { moveDuration, bobDuration, bobDelay, lightness, saturation } =
    useMemo(() => {
      const r = hash01(npc.id);
      return {
        // Faster shoppers cover their step in less time; clamp under 2s tick.
        moveDuration: Math.min(1.75, 0.7 / speed + r * 0.35),
        bobDuration: 0.85 + r * 0.9, // 0.85 .. 1.75s — different gaits
        bobDelay: r * 0.8, // desynced bob phase
        lightness: 50 + Math.round(r * 16), // 50 .. 66%
        saturation: 42 + Math.round(((r * 7) % 1) * 24), // 42 .. 66%
      };
    }, [npc.id, speed]);

  // Gentle vertical bob; stronger while lingering (browsing a store), and
  // scaled a touch by pace so brisk walkers bob more than slow strollers.
  const bobAmplitude = (phase === "lingering" ? 1.8 : 0.7) + speed * 0.6;

  return (
    <motion.g
      initial={false}
      animate={{ x, y }}
      transition={{
        duration: moveDuration,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      data-testid={`crowd-dot-${npc.id}`}
    >
      <motion.circle
        cx={0}
        cy={0}
        r={size}
        fill={`hsl(${hue}, ${saturation}%, ${lightness}%)`}
        style={{
          opacity: 0.62,
          filter: "drop-shadow(0 1px 1.5px rgba(20,20,20,0.18))",
        }}
        animate={{ cy: [0, -bobAmplitude, 0] }}
        transition={{
          duration: bobDuration,
          delay: bobDelay,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.g>
  );
}

/**
 * Renders all crowd NPCs that are currently in REVEALED zones. NPCs in
 * fogged zones are hidden (consistent with fog-of-war) but keep simulating.
 */
export function AmbientCrowd() {
  const npcs = useCrowdStore((s) => s.npcs);
  const fogState = useMapStore((s) => s.fogState);

  const visibleNpcs = useMemo(
    () => npcs.filter((n) => fogState[n.zoneId] === true),
    [npcs, fogState],
  );

  if (visibleNpcs.length === 0) return null;

  return (
    <g data-testid="ambient-crowd-layer" aria-hidden="true">
      {visibleNpcs.map((npc) => (
        <CrowdDot key={npc.id} npc={npc} />
      ))}
    </g>
  );
}

export default AmbientCrowd;
