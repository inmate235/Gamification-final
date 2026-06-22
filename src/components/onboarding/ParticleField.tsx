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
  /** Optional color for the particles (defaults to gold). */
  color?: string;
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
}

export function ParticleField({
  count = 24,
  color = "#d4af37",
  className,
}: ParticleFieldProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  // Generate particles in an effect to avoid impure Math.random during render.
  // This is a one-time initialization of decorative data — the lint rule's
  // concern about cascading renders does not apply here since it runs once.
  useEffect(() => {
    const generated: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      duration: 6 + Math.random() * 8,
      delay: Math.random() * 4,
      drift: (Math.random() - 0.5) * 60,
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time decorative init
    setParticles(generated);
  }, [count]);

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
            backgroundColor: color,
            boxShadow: `0 0 ${p.size * 3}px ${color}`,
          }}
          initial={{ opacity: 0, y: 0, x: 0 }}
          animate={{
            opacity: [0, 0.8, 0],
            y: [0, -120, -200],
            x: [0, p.drift, p.drift * 0.5],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: [0.32, 0.72, 0, 1],
          }}
        />
      ))}
    </div>
  );
}

export default ParticleField;
