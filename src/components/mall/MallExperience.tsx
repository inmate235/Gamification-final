"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { getEventScheduler, resetEventSchedulerSingleton } from "@/engine/EventScheduler";
import { showTokenFeedback } from "@/engine/tokenEconomy";
import { checkForTierUpgrade } from "@/engine/tierEngine";
import { StatusBar } from "./StatusBar";
import { MallMap } from "./MallMap";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { StoreDetail } from "@/components/overlays/StoreDetail";
import { Celebration } from "@/components/overlays/Celebration";
import { ShortcutUnlock, ShortcutEntryButton } from "@/components/overlays/ShortcutUnlock";
import { FlashSale, FlashSaleEntryButton } from "@/components/overlays/FlashSale";
import { SpinningWheel, SpinningWheelEntryButton } from "@/components/overlays/SpinningWheel";
import { TierUpgrade } from "@/components/overlays/TierUpgrade";
import { TierPerksPanel } from "@/components/overlays/TierPerksPanel";
import { TierHint } from "./TierHint";
import { TierDemotionThreat } from "./TierDemotionThreat";
import { usePlayerStore } from "@/stores/playerStore";

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
  const grantOnboardingTrialPerks = usePlayerStore((s) => s.grantOnboardingTrialPerks);

  /* --- Start / stop the game loop on mount / unmount --- */
  useEffect(() => {
    // Ensure onboarding trial perks are granted even if the survey completion
    // path was bypassed (defensive — idempotent if already granted).
    grantOnboardingTrialPerks();

    const scheduler = getEventScheduler({
      onTrialPerkExpired: (_perkId, perkName) => {
        // Notify the user that a trial perk was lost (VAL-TIER-015). Uses the
        // spend (red, downward) celebration treatment so the loss is visually
        // distinct from a token gain.
        showTokenFeedback("spend", 0, `Trial expired: ${perkName}`);
      },
    });
    scheduler.start();

    // Check for a tier upgrade immediately on mount (catches any score
    // crossed during onboarding before the loop started) and again right
    // away so the celebration surfaces promptly (VAL-TIER-023).
    checkForTierUpgrade();

    return () => {
      resetEventSchedulerSingleton();
    };
  }, [grantOnboardingTrialPerks]);

  return (
    <main className="relative z-10 flex min-h-[100dvh] flex-col">
      {/* Top chrome */}
      <StatusBar />

      {/* Tier demotion threat banner (shown when streak breaks) */}
      <TierDemotionThreat />

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

      {/* Floating spend-opportunity entry points (always visible) */}
      <FlashSaleEntryButton />
      <ShortcutEntryButton />
      <SpinningWheelEntryButton />

      {/* Tier aspiration hint (appears near next tier) */}
      <TierHint />

      {/* Overlays */}
      <StoreDetail />
      <ShortcutUnlock />
      <FlashSale />
      <SpinningWheel />
      <TierUpgrade />
      <TierPerksPanel />
      <Celebration />
    </main>
  );
}

export default MallExperience;
