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
        initial={{ opacity: 0, y: 24, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.85 }}
        transition={{ duration: 0.7, ease: PREMIUM_EASE }}
        onClick={onLeave}
        aria-label="Leave the mall"
        className="fixed bottom-28 left-1/2 z-30 -translate-x-1/2 flex items-center gap-2 rounded-full bg-[#12121a]/90 px-4 py-2.5 ring-1 ring-white/10 backdrop-blur-2xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] sm:bottom-32"
        style={{ boxShadow: "0 0 18px rgba(239,68,68,0.18)" }}
        data-testid="leave-mall-button"
      >
        <SignOut size={15} weight="light" className="text-[#a1a1aa]" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a1a1aa]">
          Leave&nbsp;Mall
        </span>
      </motion.button>
    </AnimatePresence>
  );
}

export default LeaveMallButton;
