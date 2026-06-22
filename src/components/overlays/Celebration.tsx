"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coin } from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";

/**
 * Celebration — a transient token-earned celebration overlay.
 *
 * Shown when the player earns tokens (zone reveal, first token, secret token).
 * Displays the reward amount with a particle burst, then auto-dismisses after
 * a short delay. Does NOT block map interaction (pointerEvents disabled on the
 * backdrop) so the player can keep moving while the celebration plays.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;
const AUTO_DISMISS_MS = 1800;

interface CelebrationData {
  message: string;
  amount: number;
}

export function Celebration() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const overlayData = useUIStore((s) => s.overlayData) as CelebrationData | null;
  const hideOverlay = useUIStore((s) => s.hideOverlay);

  const isOpen = activeOverlay === "celebration" && overlayData !== null;

  /* --- Auto-dismiss after the celebration plays --- */
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => hideOverlay(), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [isOpen, hideOverlay]);

  return (
    <AnimatePresence>
      {isOpen && overlayData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: PREMIUM_EASE }}
          className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center pt-24 sm:pt-32"
          data-testid="celebration-overlay"
          aria-live="assertive"
        >
          {/* Particle burst */}
          <ParticleBurst />

          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="relative flex items-center gap-3 rounded-full bg-[#12121a]/90 px-6 py-3 ring-1 ring-[#d4af37]/40 backdrop-blur-2xl"
            style={{ boxShadow: "0 0 28px rgba(212,175,55,0.35)" }}
          >
            <motion.div
              animate={{ rotate: [0, 14, -14, 0], scale: [1, 1.15, 1] }}
              transition={{
                duration: 0.8,
                ease: PREMIUM_EASE,
                repeat: Infinity,
              }}
            >
              <Coin size={22} weight="fill" className="text-[#d4af37]" />
            </motion.div>
            <span
              className="font-mono text-lg font-bold tracking-tight text-[#d4af37]"
              data-testid="celebration-message"
            >
              {overlayData.message}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
   Particle burst — GPU-safe (transform + opacity only)
   ========================================================================== */

function ParticleBurst() {
  const particles = Array.from({ length: 14 });
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const distance = 80 + (i % 3) * 30;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        return (
          <motion.span
            key={i}
            className="absolute h-2 w-2 rounded-full bg-[#d4af37]"
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x: dx, y: dy, scale: 0.4 }}
            transition={{
              duration: 1.1,
              ease: PREMIUM_EASE,
            }}
            style={{ boxShadow: "0 0 8px rgba(212,175,55,0.8)" }}
          />
        );
      })}
    </div>
  );
}

export default Celebration;
