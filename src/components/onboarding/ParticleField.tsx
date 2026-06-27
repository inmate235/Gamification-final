"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * ParticleField — decorative GPU-safe particle layer.
 *
 * Renders a set of small glowing dots that drift slowly upward, creating an
 * ethereal "mystic premium" atmosphere for the welcome animation. All motion
 * uses transform + opacity only (no layout-triggering properties).
 *
 * Particles are generated in useEffect (not during render) to keep the
 * component pure per React's rules.
 */

interface ParticleFieldProps {
  /** Number of particles to render. */
  count?: number;
  /** Optional color or array of colors for the particles (defaults to gold). */
  color?: string | string[];
  /** Optional className for the container. */
  className?: string;
}

interface Particle {
  id: number;
  x: number; // percent
  y: number; // percent
  size: number; // px
  duration: number; // seconds
  delay: number; // seconds
  drift: number; // horizontal drift in px
  color: string; // resolved color for this particle
}

export function ParticleField({
  count = 24,
  color = "#d4af37",
  className,
}: ParticleFieldProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  // Generate particles in an effect to avoid impure Math.random during render.
  useEffect(() => {
    const generated: Particle[] = Array.from({ length: count }, (_, i) => {
      let resolvedColor = "#d4af37";
      if (Array.isArray(color)) {
        resolvedColor = color[i % color.length];
      } else if (typeof color === "string") {
        resolvedColor = color;
      }
      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1.5 + Math.random() * 4,
        duration: 8 + Math.random() * 10,
        delay: Math.random() * -5, // negative delay so they start pre-simulated
        drift: (Math.random() - 0.5) * 80,
        color: resolvedColor,
      };
    });
    setParticles(generated);
  }, [count, color]);

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "9999px",
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 3.5}px ${p.color}, 0 0 ${p.size * 1.5}px ${p.color}`,
          }}
          initial={{ opacity: 0, y: 0, x: 0, scale: 0.8 }}
          animate={{
            opacity: [0, 0.75, 0.75, 0],
            y: [0, -140, -260],
            x: [0, p.drift * 0.4, p.drift * 0.8, p.drift],
            scale: [0.8, 1.25, 1.25, 0.8],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export default ParticleField;
