"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { initiateExit } from "@/engine/exitFrictionEngine";

/**
 * LeaveMallButton — the floating "Leave Mall" control that initiates the
 * 3-layer exit friction flow (VAL-EXIT-001).
 *
 * Tapping it registers an exit attempt and opens the exit-friction overlay.
 * Hidden while another overlay is active or the session is in the
 * "exited" goodbye state.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;
const POP = [0.34, 1.56, 0.64, 1] as const;

export function LeaveMallButton() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const exited = useSessionStore((s) => s.exited);
  const [hovered, setHovered] = useState(false);

  const onLeave = useCallback(() => {
    initiateExit();
  }, []);

  if (exited) return null;
  if (activeOverlay !== "none" && activeOverlay !== "exit-friction") return null;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, x: -28, scale: 0.8 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -28, scale: 0.8 }}
        transition={{ duration: 0.55, ease: POP, delay: 0.25 }}
        onClick={onLeave}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Leave the mall"
        className="fixed top-24 left-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-[#141414]/10 shadow-[0_4px_16px_rgba(20,20,20,0.06)] backdrop-blur-sm transition-shadow duration-300 active:scale-[0.94] sm:top-28 sm:left-4 group outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444]/40"
        data-testid="leave-mall-button"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
      >
        {/* Hover danger glow */}
        {hovered && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full bg-[#ef4444]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.08 }}
            transition={{ duration: 0.3, ease: PREMIUM_EASE }}
            aria-hidden="true"
          />
        )}
        <motion.span
          animate={hovered ? { rotate: [-6, 6, -6, 0] } : { rotate: 0 }}
          transition={{ duration: 0.5, ease: PREMIUM_EASE }}
          className="flex items-center justify-center"
        >
          <SignOut
            size={16}
            weight="bold"
            className="text-[#8a8a8a] transition-colors duration-300 group-hover:text-[#ef4444] ml-0.5"
          />
        </motion.span>
      </motion.button>
    </AnimatePresence>
  );
}

export default LeaveMallButton;
