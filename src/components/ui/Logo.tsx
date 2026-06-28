"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Logo — the MurkyCorps brand mark.
 *
 * A black rounded pill reading "Murky", placed top-right on every screen
 * to match the Figma "Gamification" project.
 */

interface LogoProps {
  className?: string;
  size?: number;
}

const POP_EASE = [0.34, 1.56, 0.64, 1] as const;

export function Logo({ className, size = 40 }: LogoProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: POP_EASE, delay: 0.15 }}
      className={cn(
        "flex items-center justify-center rounded-full bg-[#141414] px-4 font-display font-semibold tracking-tight text-white",
        className
      )}
      style={{ height: size, fontSize: size * 0.42 }}
      aria-label="MurkyCorps"
    >
      Murky
    </motion.div>
  );
}

export default Logo;
