/**
 * exitFrictionEngine - the 3-layer exit friction dark pattern.
 *
 * Implements the escalating leave-mall flow (VAL-EXIT-001..032):
 *   Layer 1 (Soft Nudge)   — dismissible, shows missed deals / unexplored %
 *                              / tokens away from the nearest shortcut.
 *   Layer 2 (Guilt)        — streak status + sunk-cost summary + friends
 *                              still inside.
 *   Layer 3 (Rescue Bargain) — "stay 5 more min for bonus wheel + streak
 *                              protection + 2x tokens".
 *
 * The exit-attempt counter lives in `sessionStore`. Each activation of the
 * Leave Mall control increments it (capped at 3); the friction layer matches
 * the attempt count. Choosing "Stay" on any layer resets the counter so the
 * next attempt starts again at Layer 1 (VAL-EXIT-022). Choosing "Leave
 * anyway" advances to the next layer, and on Layer 3 actually exits (resets
 * the counter and marks the session exited, VAL-EXIT-017, VAL-EXIT-032).
 *
 * Accepting the Layer 3 bargain activates the promised bonuses
 * (VAL-EXIT-027): a bonus spinning-wheel spin, streak protection for the
 * session (VAL-EXIT-028), and a 2x token boost for the 5-minute stay window
 * (VAL-EXIT-016).
 */

import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useEconomyStore } from "@/stores/economyStore";
import { useSocialStore } from "@/stores/socialStore";
import { useTaskStore } from "@/stores/taskStore";
import { getStoreById } from "@/data/mallData";
import type { ExitFrictionData } from "@/types";

/* ============================================================================
   Constants
   ========================================================================== */

/** Minutes the user is asked to stay in the Layer 3 rescue bargain. */
export const BARGAIN_STAY_MINUTES = 5;
/** Duration of the 2x rescue token boost (ms) — matches the stay window. */
export const RESCUE_BOOST_DURATION_MS = BARGAIN_STAY_MINUTES * 60 * 1000;

/* ============================================================================
   Data assembly (VAL-EXIT-031: overlayData matches rendered content)
   ========================================================================== */

/**
 * Build the ExitFrictionData payload from the live store values. Every number
 * shown in the overlay is read directly from its source store so the
 * overlayData and the rendered text can never diverge.
 *
 * @param layer - the friction layer to render (1, 2, or 3).
 */
export function buildExitFrictionData(layer: 1 | 2 | 3): ExitFrictionData {
  const player = usePlayerStore.getState();
  const map = useMapStore.getState();
  const economy = useEconomyStore.getState();
  const social = useSocialStore.getState();
  const session = useSessionStore.getState();
  const tasks = useTaskStore.getState();

  // --- Missed flash sales (Layer 1, VAL-EXIT-005) ---
  const missedSales = economy.flashSales.map((sale) => {
    const store = getStoreById(sale.storeId);
    return {
      storeName: store?.name ?? "A mystery store",
      discount: sale.discount,
      countdownSeconds: sale.countdownSeconds,
    };
  });

  // --- Exploration / unexplored (VAL-EXIT-006) ---
  const explorationPercent = map.explorationPercent;
  const unexploredPercent = Math.max(0, 100 - explorationPercent);

  // --- Tokens away from the nearest shortcut (VAL-EXIT-007) ---
  // The live deficit price is always balance + 2..3, so the gap is the
  // deficit engine's computed shortfall.
  const tokensAwayFromShortcut = Math.max(
    0,
    economy.liveDeficitPrice - player.tokens
  );

  // --- Sunk-cost summary (VAL-EXIT-010, VAL-EXIT-023..025) ---
  const playerRank =
    social.leaderboard.find((e) => e.isPlayer)?.rank ?? 0;
  const sunkCost = {
    cumulativeTokensEarned: player.tierXP,
    timeSpentMinutes: session.sessionMinutes,
    explorationPercent,
    perksUnlocked: player.perks.length + player.trialPerks.length,
    tasksCompleted: tasks.completedTasks.length,
    leaderboardRank: playerRank,
  };

  // --- Friends still inside (VAL-EXIT-011) ---
  const friendsInside = social.phantoms.map((p) => p.name);

  return {
    layer,
    missedSales,
    explorationPercent,
    unexploredPercent,
    tokensAwayFromShortcut,
    streakCount: player.streak.count,
    sunkCost,
    friendsInside,
    bargain: {
      stayMinutes: BARGAIN_STAY_MINUTES,
      bonusWheel: true,
      streakProtection: true,
      tokenBoost: 2,
    },
  };
}

/* ============================================================================
   Exit flow orchestration
   ========================================================================== */

/**
 * Activate the Leave Mall flow: increments the exit-attempt counter (capped at
 * 3), determines the friction layer, and opens the exit-friction overlay with
 * a freshly-built data payload. Returns the layer that was opened.
 *
 * VAL-EXIT-002, VAL-EXIT-008, VAL-EXIT-012, VAL-EXIT-020, VAL-EXIT-021,
 * VAL-EXIT-026, VAL-EXIT-030.
 */
export function initiateExit(): 1 | 2 | 3 {
  const attempts = useSessionStore.getState().registerExitAttempt();
  const layer = Math.min(3, attempts) as 1 | 2 | 3;
  const data = buildExitFrictionData(layer);
  useUIStore.getState().showOverlay("exit-friction", data);
  return layer;
}

/**
 * The user chose "Stay" / "Keep Exploring" on the current layer. Resets the
 * exit-attempt counter (so the next leave attempt starts at Layer 1 again,
 * VAL-EXIT-022) and closes the overlay.
 */
export function stayInMall(): void {
  useSessionStore.getState().resetExitAttempts();
  useUIStore.getState().hideOverlay();
}

/**
 * The user chose "Leave anyway" on the current layer. On Layers 1 and 2 this
 * advances to the next layer (re-initiating the exit so the counter
 * increments and the next layer renders). On Layer 3 the user actually leaves
 * the mall: the exit-friction state resets and the session is marked exited
 * (VAL-EXIT-017, VAL-EXIT-032).
 *
 * Returns a tag describing what happened: "advance" | "left".
 */
export function leaveAnyway(): "advance" | "left" {
  const session = useSessionStore.getState();
  const currentLayer = session.exitFrictionLayer;

  if (currentLayer >= 3) {
    // Final layer — actually leave.
    useUIStore.getState().hideOverlay();
    useSessionStore.getState().leaveMall();
    return "left";
  }

  // Advance to the next layer by re-initiating the exit (increments the
  // counter and opens the next layer's data).
  initiateExit();
  return "advance";
}

/**
 * Accept the Layer 3 rescue bargain: activates the promised bonuses
 * (VAL-EXIT-027) and keeps the user in the mall.
 *   - Bonus spinning wheel: makes the wheel available immediately.
 *   - Streak protection: the streak will not break for this session
 *     (VAL-EXIT-028).
 *   - 2x token boost: active for the 5-minute stay window (VAL-EXIT-016).
 * Also resets the exit-attempt counter (the user chose to stay, VAL-EXIT-022)
 * and closes the overlay.
 */
export function acceptRescueBargain(): void {
  const now = Date.now();
  const player = usePlayerStore.getState();

  // Bonus wheel spin.
  useEconomyStore.getState().makeWheelAvailable();

  // Streak protection for the session.
  player.activateStreakProtection();

  // 2x token boost for the 5-minute stay window.
  player.activateRescueBoost(now + RESCUE_BOOST_DURATION_MS);

  // Reset exit attempts (chose to stay) and close the overlay.
  useSessionStore.getState().resetExitAttempts();
  useUIStore.getState().hideOverlay();
}

/**
 * Check whether the rescue boost has expired and clear it if so. Intended to
 * be called by the EventScheduler on its tick.
 */
export function checkRescueBoostExpiry(now: number = Date.now()): boolean {
  const boost = usePlayerStore.getState().rescueBoost;
  if (!boost || !boost.active) return false;
  if (boost.expiresAt <= now) {
    usePlayerStore.getState().clearRescueBoost();
    return true;
  }
  return false;
}

const exitFrictionEngine = {
  BARGAIN_STAY_MINUTES,
  RESCUE_BOOST_DURATION_MS,
  buildExitFrictionData,
  initiateExit,
  stayInMall,
  leaveAnyway,
  acceptRescueBargain,
  checkRescueBoostExpiry,
};

export default exitFrictionEngine;
