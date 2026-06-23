"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coin, Minus } from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import type { CelebrationData } from "@/types";

/**
 * Celebration - a transient token-feedback overlay.
 *
 * Shown when the player earns OR spends tokens (zone reveal, first token,
 * secret token, task completion, wheel prize, shortcut unlock, flash sale
 * purchase). Earn events render a gold +N upward burst; spend events render a
 * distinct red -N downward dim so the two are visually distinguishable
 * (VAL-TOKEN-017). Does NOT block map interaction (pointerEvents disabled on
 * the backdrop) so the player can keep moving while the feedback plays.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;
const AUTO_DISMISS_MS = 1800;

export function Celebration() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const overlayData = useUIStore((s) => s.overlayData) as CelebrationData | null;
  const hideOverlay = useUIStore((s) => s.hideOverlay);

  const isOpen = activeOverlay === "celebration" && overlayData !== null;
  const kind = overlayData?.kind ?? "earn";

  /* --- Auto-dismiss after the feedback plays --- */
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => hideOverlay(), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [isOpen, hideOverlay]);

  const isEarn = kind === "earn";
  const accent = isEarn ? "#d4af37" : "#ef4444";
  const ring = isEarn ? "rgba(212,175,55,0.4)" : "rgba(239,68,68,0.4)";
  const glow = isEarn ? "0 0 28px rgba(212,175,55,0.35)" : "0 0 28px rgba(239,68,68,0.35)";

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
          {/* Particle burst (earn: gold outward, spend: red falling) */}
          <ParticleBurst kind={kind} />

          <motion.div
            initial={{ opacity: 0, y: isEarn ? 32 : -32, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isEarn ? -16 : 16, scale: 0.95 }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="relative flex items-center gap-3 rounded-full bg-[#12121a]/90 px-6 py-3 ring-1 backdrop-blur-2xl"
            style={{ boxShadow: glow, ["--tw-ring-color" as string]: ring }}
          >
            <motion.div
              animate={
                isEarn
                  ? { rotate: [0, 14, -14, 0], scale: [1, 1.15, 1] }
                  : { scale: [1, 0.85, 1] }
              }
              transition={{ duration: 0.8, ease: PREMIUM_EASE, repeat: Infinity }}
            >
              {isEarn ? (
                <Coin size={22} weight="fill" style={{ color: accent }} />
              ) : (
                <Minus size={22} weight="bold" style={{ color: accent }} />
              )}
            </motion.div>
            <span
              className="font-mono text-lg font-bold tracking-tight"
              style={{ color: accent }}
              data-testid="celebration-message"
            >
              {overlayData.message}
            </span>
            <span
              className="sr-only"
              data-testid="celebration-kind"
            >
              {kind}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
   Particle burst - GPU-safe (transform + opacity only)
   ========================================================================== */

function ParticleBurst({ kind }: { kind: "earn" | "spend" }) {
  const isEarn = kind === "earn";
  const color = isEarn ? "#d4af37" : "#ef4444";
  const particles = Array.from({ length: 14 });
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        // Earn: outward burst. Spend: downward fall (gravity-like).
        const distance = isEarn ? 80 + (i % 3) * 30 : 40 + (i % 3) * 18;
        const dx = Math.cos(angle) * (isEarn ? distance : distance * 0.6);
        const dy = (isEarn ? Math.sin(angle) : 1) * distance + (isEarn ? 0 : 40 + i * 6);
        return (
          <motion.span
            key={i}
            className="absolute h-2 w-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 8px ${color}cc` }}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x: dx, y: dy, scale: 0.4 }}
            transition={{ duration: isEarn ? 1.1 : 0.9, ease: PREMIUM_EASE }}
          />
        );
      })}
    </div>
  );
}

export default Celebration;
