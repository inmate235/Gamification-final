"use client";

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { initiateExit } from "@/engine/exitFrictionEngine";

/**
 * LeaveMallButton — the floating "Leave Mall" control that initiates the
 * 3-layer exit friction flow (VAL-EXIT-001).
 *
 * Tapping it registers an exit attempt and opens the exit-friction overlay at
 * the layer matching the attempt counter (Layer 1 on first attempt,
 * VAL-EXIT-002). The button is hidden while any overlay (including the exit
 * friction overlay itself) is active, and while the session is in the
 * "exited" goodbye state.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

export function LeaveMallButton() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const exited = useSessionStore((s) => s.exited);

  const onLeave = useCallback(() => {
    initiateExit();
  }, []);

  // Hide while an overlay is capturing the screen or after the user left.
  if (exited) return null;
  if (activeOverlay !== "none" && activeOverlay !== "exit-friction") return null;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, x: -24, scale: 0.85 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -24, scale: 0.85 }}
        transition={{ duration: 0.7, ease: PREMIUM_EASE }}
        onClick={onLeave}
        aria-label="Leave the mall"
        className="fixed top-24 left-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-[#12121a]/60 ring-1 ring-white/5 backdrop-blur-md transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#12121a]/80 active:scale-[0.97] sm:top-28 sm:left-4"
        data-testid="leave-mall-button"
      >
        <SignOut size={16} weight="light" className="text-[#71717a] ml-0.5" />
      </motion.button>
    </AnimatePresence>
  );
}

export default LeaveMallButton;
