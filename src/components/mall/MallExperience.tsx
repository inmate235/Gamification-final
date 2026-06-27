"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { getEventScheduler, resetEventSchedulerSingleton } from "@/engine/EventScheduler";
import { showTokenFeedback } from "@/engine/tokenEconomy";
import { checkForTierUpgrade } from "@/engine/tierEngine";
import {
  checkStreakOnVisit,
  processMissedDayPenalties,
} from "@/engine/streakEngine";
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
import { ExitFriction } from "@/components/overlays/ExitFriction";
import {
  Leaderboard,
  LeaderboardEntryButton,
  ProximityAlertBanner,
} from "@/components/social/Leaderboard";
import { LeaveMallButton } from "./LeaveMallButton";
import { GoodbyeScreen } from "./GoodbyeScreen";
import { TierHint } from "./TierHint";
import { TierDemotionThreat } from "./TierDemotionThreat";
import { StreakAnxietyMessage } from "./StreakAnxietyMessage";
import { StreakRecoveryBanner } from "./StreakRecoveryBanner";
import { StreakPenaltyNotification } from "./StreakPenaltyNotification";
import { TimelineFeed } from "@/components/social/TimelineFeed";
import { TimelineEntryButton } from "@/components/social/TimelineEntryButton";
import { usePlayerStore } from "@/stores/playerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSocialStore } from "@/stores/socialStore";
import { useUIStore } from "@/stores/uiStore";

/**
 * MallExperience — the full `/mall` screen.
 *
 * Composes the persistent chrome (StatusBar top, TaskPanel bottom) with the
 * SVG MallMap and the overlay system (StoreDetail, Celebration). The
 * EventScheduler game loop is started on mount and stopped on unmount so the
 * session clock, deficit pricing, and phantom movement run only while the
 * player is in the mall.
 *
 * The streak system is checked on mount (VAL-STREAK-004, VAL-STREAK-009):
 * the visit check compares the current time with the last visit to determine
 * whether to increment, recover, or reset the streak.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

export function MallExperience() {
  const grantOnboardingTrialPerks = usePlayerStore((s) => s.grantOnboardingTrialPerks);
  const exited = useSessionStore((s) => s.exited);

  /* --- Start / stop the game loop on mount / unmount --- */
  useEffect(() => {
    // Ensure onboarding trial perks are granted even if the survey completion
    // path was bypassed (defensive — idempotent if already granted).
    grantOnboardingTrialPerks();

    // Apply any pending missed-day penalties BEFORE the visit check. The
    // streak escalation (Day 1 token loss, Day 2 perk loss, Day 3 demotion)
    // is detected by comparing the current time with `streak.lastVisit`; it
    // must run before `checkStreakOnVisit` updates lastVisit / resets the
    // missed-day counter, otherwise the penalties for days missed while away
    // would be lost (VAL-STREAK-005..008, VAL-STREAK-016).
    processMissedDayPenalties();

    // Check the streak on visit: increments on a new day, recovers within the
    // 48h window, or resets if the window expired (VAL-STREAK-004, -009,
    // -013, -017).
    checkStreakOnVisit();

    const scheduler = getEventScheduler({
      onTrialPerkExpired: (_perkId, perkName) => {
        // Notify the user that a trial perk was lost (VAL-TIER-015). Uses the
        // spend (red, downward) celebration treatment so the loss is visually
        // distinct from a token gain.
        showTokenFeedback("spend", 0, `Trial expired: ${perkName}`);
      },
      onMissedDayPenalty: (result) => {
        // Surface the streak-miss penalty via the token-feedback overlay so
        // the loss is communicated alongside the StreakPenaltyNotification
        // banner (VAL-STREAK-005..008). `result.tokensLost` carries the
        // ACTUAL capped token loss so the notification never overstates the
        // deduction.
        showTokenFeedback("spend", result.tokensLost ?? 0, result.message);
      },
      onRecoveryWindowExpired: () => {
        // The 48h recovery window has expired (VAL-STREAK-017). The streak
        // is now fully broken — a full reset applies on the next visit.
        showTokenFeedback("spend", 0, "Recovery window expired. Streak fully broken.");
      },
      onComebackBonusExpired: () => {
        // The 30-min 2x comeback bonus has ended (VAL-STREAK-012).
        showTokenFeedback("spend", 0, "2x comeback bonus ended.");
      },
      onRescueBoostExpired: () => {
        // The 5-min 2x rescue-bargain boost has ended (VAL-EXIT-016).
        showTokenFeedback("spend", 0, "2x rescue boost ended.");
      },
    });
    scheduler.start();

    // Check for a tier upgrade immediately on mount (catches any score
    // crossed during onboarding before the loop started) and again right
    // away so the celebration surfaces promptly (VAL-TIER-023).
    checkForTierUpgrade();

    // Populate the leaderboard immediately on mount with the player's live
    // values so it is never stale on first render (the initial store state
    // already includes the player row, but this guarantees the ranks reflect
    // any onboarding trial perks / tier changes before the first scheduler
    // tick fires).
    useSocialStore.getState().updateLeaderboard();

    // Swipe right to open timeline
    let touchStartX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].screenX;
      // swipe right distance threshold
      if (touchEndX - touchStartX > 100) {
        useUIStore.getState().setTimelineOpen(true);
      }
    };
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      resetEventSchedulerSingleton();
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [grantOnboardingTrialPerks]);

  // After the user successfully leaves the mall (final "Leave anyway" on
  // Layer 3), render the goodbye screen in place of the mall experience
  // (VAL-EXIT-017, VAL-EXIT-032). The exit-friction state has already been
  // reset on leave.
  if (exited) {
    return <GoodbyeScreen />;
  }

  return (
    <main className="relative z-10 flex min-h-[100dvh] flex-col">
      {/* Top chrome */}
      <StatusBar />

      {/* Streak recovery window banner (VAL-STREAK-010, -011) */}
      <StreakRecoveryBanner />

      {/* Tier demotion threat banner (shown when streak breaks) */}
      <TierDemotionThreat />

      {/* Streak penalty notification (VAL-STREAK-005..008) */}
      <StreakPenaltyNotification />

      {/* Top Right Actions (Eye-catching placement) */}
      <div className="fixed top-20 right-4 z-30 flex flex-col items-end gap-3 sm:top-24">
        <SpinningWheelEntryButton />
      </div>

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

      {/* Action Dock (Consolidated entry points) */}
      <div className="fixed bottom-24 right-4 z-30 flex flex-col items-end gap-3 sm:bottom-28">
        <TimelineEntryButton />
        <LeaderboardEntryButton />
        <ShortcutEntryButton />
        <FlashSaleEntryButton />
      </div>
      
      {/* Proximity alert banner (VAL-LEADER-011) */}
      <ProximityAlertBanner />

      {/* Leave Mall control — triggers the exit friction flow (VAL-EXIT-001) */}
      <LeaveMallButton />

      {/* Tier aspiration hint (appears near next tier) */}
      <TierHint />

      {/* Streak anxiety messaging (VAL-STREAK-014) */}
      <StreakAnxietyMessage />

      {/* Overlays */}
      <StoreDetail />
      <ShortcutUnlock />
      <FlashSale />
      <SpinningWheel />
      <TierUpgrade />
      <TierPerksPanel />
      <ExitFriction />
      <Leaderboard />
      <Celebration />
      <TimelineFeed />
    </main>
  );
}

export default MallExperience;
