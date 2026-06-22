"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { getEventScheduler, resetEventSchedulerSingleton } from "@/engine/EventScheduler";
import { StatusBar } from "./StatusBar";
import { MallMap } from "./MallMap";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { StoreDetail } from "@/components/overlays/StoreDetail";
import { Celebration } from "@/components/overlays/Celebration";

/**
 * MallExperience — the full `/mall` screen.
 *
 * Composes the persistent chrome (StatusBar top, TaskPanel bottom) with the
 * SVG MallMap and the overlay system (StoreDetail, Celebration). The
 * EventScheduler game loop is started on mount and stopped on unmount so the
 * session clock, deficit pricing, and phantom movement run only while the
 * player is in the mall.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

export function MallExperience() {
  /* --- Start / stop the game loop on mount / unmount --- */
  useEffect(() => {
    const scheduler = getEventScheduler();
    scheduler.start();
    return () => {
      resetEventSchedulerSingleton();
    };
  }, []);

  return (
    <main className="relative z-10 flex min-h-[100dvh] flex-col">
      {/* Top chrome */}
      <StatusBar />

      {/* Map area — padded to clear the fixed status bar + bottom panel */}
      <motion.div
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: PREMIUM_EASE }}
        className="flex flex-1 items-center justify-center px-3 pb-44 pt-24 sm:px-6 sm:pb-48 sm:pt-28"
      >
        <MallMap />
      </motion.div>

      {/* Bottom chrome */}
      <TaskPanel />

      {/* Overlays */}
      <StoreDetail />
      <Celebration />
    </main>
  );
}

export default MallExperience;
