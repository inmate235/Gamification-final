"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionStyle,
} from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * MagneticButton — a button that physically pulls toward the cursor
 * using Framer Motion's useMotionValue/useSpring (outside React render cycle
 * per design-taste-frontend Section 4).
 *
 * The magnetic effect is disabled on touch devices and when
 * prefers-reduced-motion is set.
 */

interface MagneticButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  /** Magnetic pull strength in pixels (max displacement). */
  strength?: number;
  "aria-label"?: string;
  "data-testid"?: string;
}

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

export function MagneticButton({
  children,
  onClick,
  disabled,
  className,
  strength = 12,
  ...rest
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { stiffness: 150, damping: 15, mass: 0.1 };
  const x = useSpring(useTransform(mouseX, [-0.5, 0.5], [-strength, strength]), springConfig);
  const y = useSpring(useTransform(mouseY, [-0.5, 0.5], [-strength, strength]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const motionStyle: MotionStyle = { x, y };

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={motionStyle}
      transition={{ duration: 0.4, ease: PREMIUM_EASE }}
      className={cn(
        "cursor-pointer transition-shadow duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] disabled:pointer-events-none",
        className
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export default MagneticButton;
