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
 * Each dot animates smoothly between positions via Framer Motion. The move
 * duration is calibrated to the NPC's tick period so movement reads as
 * continuous walking — the dot is always mid-stride when its next position
 * arrives, eliminating the freeze-then-jump that made the old crowd look static.
 *
 * Per-dot animation variety: each dot gets a unique combination of vertical
 * bob, horizontal sway, and scale pulse so no two dots move in lockstep.
 */

/** Small deterministic hash from an id string -> 0..1. */
function hash01(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000;
}

/** A second hash from an id string -> 0..1 (for independent variation). */
function hash01b(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 37 + id.charCodeAt(i) * 7) | 0;
  return (Math.abs(h) % 1000) / 1000;
}

/** Per-dot animation archetype — controls the shape of idle motion. */
type DotArchetype = "bobber" | "swayer" | "pulser" | "drifter";

/** A single ambient crowd dot. */
function CrowdDot({ npc }: { npc: CrowdNPC }) {
  const { x, y, hue, size, phase, speed, tickPeriod } = npc;

  const {
    moveDuration,
    bobDuration,
    bobDelay,
    swayDuration,
    swayDelay,
    swayAmplitude,
    pulseDuration,
    lightness,
    saturation,
    archetype,
  } = useMemo(() => {
    const r = hash01(npc.id);
    const r2 = hash01b(npc.id);
    // Move duration fills the NPC's tick period so there's no freeze gap.
    // tickPeriod is in 1-second scheduler ticks; add slight per-dot variance.
    const basePeriod = tickPeriod; // 2 or 3 seconds
    const moveDuration = Math.max(0.1, basePeriod - 0.15 + r * 0.3);
    // Pick an animation archetype deterministically — distributes variety.
    const archetypes: DotArchetype[] = ["bobber", "swayer", "pulser", "drifter"];
    const archetype = archetypes[Math.floor(r2 * 4) % 4] ?? "bobber";
    return {
      moveDuration,
      bobDuration: 0.7 + r * 0.8, // 0.7 .. 1.5s — different gaits
      bobDelay: r2 * 0.6, // desynced bob phase
      swayDuration: 1.2 + r * 1.3, // 1.2 .. 2.5s
      swayDelay: r2 * 0.9, // desynced sway phase
      swayAmplitude: 1.5 + r2 * 2.5, // 1.5 .. 4 SVG units
      pulseDuration: 1.8 + r * 1.4, // 1.8 .. 3.2s
      lightness: 50 + Math.round(r * 16), // 50 .. 66%
      saturation: 42 + Math.round(((r * 7) % 1) * 24), // 42 .. 66%
      archetype,
    };
  }, [npc.id, tickPeriod]);

  // Bob amplitude varies by phase and archetype.
  const bobAmplitude = (phase === "lingering" ? 1.5 : 0.6) + speed * 0.5;

  // Build the idle animation based on the archetype so each dot looks unique.
  const idleAnimX =
    archetype === "swayer" || archetype === "drifter"
      ? { animate: { cx: [0, swayAmplitude, 0] } }
      : { animate: { cx: 0 } };

  const idleAnimY =
    archetype === "pulser"
      ? { animate: { cy: [0, -bobAmplitude * 0.4, 0] } }
      : { animate: { cy: [0, -bobAmplitude, 0] } };

  const idleAnimScale =
    archetype === "pulser"
      ? { animate: { scale: [1, 1.15, 1] } }
      : { animate: { scale: 1 } };

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
        {...idleAnimX}
        {...idleAnimY}
        {...idleAnimScale}
        transition={{
          cx: {
            duration: swayDuration,
            delay: swayDelay,
            repeat: Infinity,
            ease: "easeInOut",
          },
          cy: {
            duration: bobDuration,
            delay: bobDelay,
            repeat: Infinity,
            ease: "easeInOut",
          },
          scale: {
            duration: pulseDuration,
            delay: bobDelay * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
          },
          x: { duration: moveDuration, ease: [0.25, 0.1, 0.25, 1] },
          y: { duration: moveDuration, ease: [0.25, 0.1, 0.25, 1] },
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
