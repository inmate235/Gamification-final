/**
 * phantomEngine - social phantom behavior for the leaderboard dark pattern.
 *
 * Implements the "just barely ahead" goalpost-shifting mechanic:
 *   - The phantom ranked immediately above the real user is always kept just
 *     barely ahead (within a small gap) on the active metric, so the user
 *     always feels one step from overtaking (VAL-LEADER-010).
 *   - When the user overtakes the phantom immediately above, a new phantom
 *     is fabricated and inserted just ahead, so the user can never settle at
 *     #1 with nobody ahead (VAL-LEADER-014, VAL-LEADER-017, VAL-LEADER-025).
 *   - Proximity alerts fire only when the user is genuinely close to
 *     overtaking (within the alert threshold), naming the phantom, the gap,
 *     and the rank at stake (VAL-LEADER-011..013, VAL-LEADER-020).
 *   - Phantom scores evolve slowly over time so they are not frozen
 *     (VAL-LEADER-016).
 *
 * The engine is a set of pure functions that operate on the socialStore /
 * playerStore / mapStore / sessionStore state. It is driven by the
 * EventScheduler tick.
 */

import { useSocialStore } from "@/stores/socialStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useSessionStore } from "@/stores/sessionStore";
import { fabricatePhantom } from "@/data/phantomData";
import type {
  LeaderboardEntry,
  LeaderboardMetric,
  PhantomUser,
} from "@/types";

/* ============================================================================
   Configuration
   ========================================================================== */

/**
 * Maximum gap (in the active metric's units) for the phantom immediately
 * above the user to be considered "just barely ahead". When the gap exceeds
 * this, the goalposts shift inward so the leader is pulled closer.
 */
const JUST_BARELY_AHEAD_GAP = 3;

/**
 * Gap at or below which a proximity alert fires. Must be <= the
 * just-barely-ahead gap so alerts only fire when the user is genuinely close
 * (VAL-LEADER-020: no alert when far behind).
 */
export const PROXIMITY_ALERT_THRESHOLD = 3;

/** Maximum number of phantom entries the leaderboard will ever show. */
export const MAX_LEADERBOARD_ENTRIES = 12;

/* ============================================================================
   Metric value extraction
   ========================================================================== */

/**
 * Read the player's current value for the given metric. The player's values
 * come from the live stores so the leaderboard always reflects reality
 * (VAL-LEADER-004..006, VAL-LEADER-015, VAL-LEADER-024).
 */
export function playerMetricValue(metric: LeaderboardMetric): number {
  switch (metric) {
    case "tokens":
      return usePlayerStore.getState().tokens;
    case "time":
      return useSessionStore.getState().sessionMinutes;
    case "exploration":
      return useMapStore.getState().explorationPercent;
  }
}

/** Read a phantom's value for the given metric. */
export function phantomMetricValue(
  phantom: PhantomUser,
  metric: LeaderboardMetric,
): number {
  switch (metric) {
    case "tokens":
      return phantom.tokenCount;
    case "time":
      return phantom.timeInMall;
    case "exploration":
      return phantom.explorationPercent;
  }
}

/** Read a leaderboard entry's value for the given metric. */
export function entryMetricValue(
  entry: LeaderboardEntry,
  metric: LeaderboardMetric,
): number {
  switch (metric) {
    case "tokens":
      return entry.tokenCount;
    case "time":
      return entry.timeInMall;
    case "exploration":
      return entry.explorationPercent;
  }
}

/* ============================================================================
   Goalpost shifting
   ========================================================================== */

/**
 * Ensure there is always a phantom ranked just above the player on the active
 * metric, kept within the "just barely ahead" gap. If the phantom immediately
 * above is too far ahead, its score is pulled down to `player + gap` (the
 * goalposts shift inward). If there is no phantom above the player at all
 * (the player is #1), a new phantom is fabricated just ahead
 * (VAL-LEADER-014, VAL-LEADER-017).
 *
 * Returns a short summary of what changed (for testability).
 */
export function ensurePhantomJustAbove(): {
  shifted: boolean;
  generated: boolean;
} {
  const social = useSocialStore.getState();
  const metric = social.activeMetric;
  const playerVal = playerMetricValue(metric);
  const phantoms = social.phantoms;

  // Find the phantom immediately above the player on the active metric.
  const above = phantoms
    .filter((p) => phantomMetricValue(p, metric) > playerVal)
    .sort(
      (a, b) =>
        phantomMetricValue(a, metric) - phantomMetricValue(b, metric),
    );

  // No phantom above the player -> fabricate one just ahead.
  if (above.length === 0) {
    const usedNames = new Set(phantoms.map((p) => p.name));
    const gap = 1 + Math.floor(Math.random() * JUST_BARELY_AHEAD_GAP);
    const newPhantom = fabricatePhantomForMetric(
      metric,
      playerVal,
      gap,
      usedNames,
    );
    useSocialStore.getState().addPhantom(newPhantom);
    return { shifted: false, generated: true };
  }

  // The closest phantom above. If it's too far ahead, pull it closer.
  const closest = above[0];
  if (!closest) return { shifted: false, generated: false };
  const gap = phantomMetricValue(closest, metric) - playerVal;
  if (gap > JUST_BARELY_AHEAD_GAP) {
    const newGap = 1 + Math.floor(Math.random() * JUST_BARELY_AHEAD_GAP);
    adjustPhantomMetric(closest.id, metric, playerVal + newGap);
    return { shifted: true, generated: false };
  }

  return { shifted: false, generated: false };
}

/**
 * Build a fabricated phantom whose value for the active metric sits at
 * `playerVal + gap`. Delegates to the data-layer fabricator but overrides the
 * relevant metric so the new phantom is just barely ahead on the *active*
 * metric regardless of which one it is.
 */
function fabricatePhantomForMetric(
  metric: LeaderboardMetric,
  playerVal: number,
  gap: number,
  usedNames: ReadonlySet<string>,
): PhantomUser {
  const playerTokens = usePlayerStore.getState().tokens;
  const playerTime = useSessionStore.getState().sessionMinutes;
  const playerExploration = useMapStore.getState().explorationPercent;

  const phantom = fabricatePhantom(
    playerTokens,
    playerTime,
    playerExploration,
    gap,
    usedNames,
  );

  // Override the active metric so the new phantom is exactly `gap` ahead on it.
  switch (metric) {
    case "tokens":
      phantom.tokenCount = playerVal + gap;
      break;
    case "time":
      phantom.timeInMall = playerVal + gap;
      break;
    case "exploration":
      phantom.explorationPercent = Math.min(99, playerVal + gap);
      break;
  }
  return phantom;
}

/** Adjust a single phantom's value for one metric (goalpost shift). */
function adjustPhantomMetric(
  phantomId: string,
  metric: LeaderboardMetric,
  newValue: number,
): void {
  useSocialStore.getState().adjustPhantom(phantomId, (p) => {
    switch (metric) {
      case "tokens":
        return { ...p, tokenCount: Math.max(0, newValue) };
      case "time":
        return { ...p, timeInMall: Math.max(0, newValue) };
      case "exploration":
        return { ...p, explorationPercent: Math.max(0, Math.min(99, newValue)) };
    }
  });
}

/* ============================================================================
   Proximity alerts
   ========================================================================== */

/** Track which phantom+metric combos we have already alerted about this
 *  "close window" to avoid spamming duplicate alerts every tick. Cleared when
 *  the gap grows large again. */
const alertedKeys = new Set<string>();

function alertKey(phantomId: string, metric: LeaderboardMetric): string {
  return `${phantomId}:${metric}`;
}

/**
 * Check whether the player is close to overtaking the phantom immediately
 * above on the active metric. If the gap is within the alert threshold, fire
 * a proximity alert naming the phantom, the exact gap, and the rank at stake
 * (VAL-LEADER-011..013). No alert fires when the gap is large
 * (VAL-LEADER-020). Returns the alert id if one was fired, else null.
 */
export function checkProximityAndAlert(): string | null {
  const social = useSocialStore.getState();
  const metric = social.activeMetric;
  const playerVal = playerMetricValue(metric);

  // The phantom immediately above the player on the active metric.
  const above = social.phantoms
    .filter((p) => phantomMetricValue(p, metric) > playerVal)
    .sort(
      (a, b) =>
        phantomMetricValue(a, metric) - phantomMetricValue(b, metric),
    );

  if (above.length === 0) return null;

  const closest = above[0];
  if (!closest) return null;
  const gap = phantomMetricValue(closest, metric) - playerVal;

  // Only fire when genuinely close (VAL-LEADER-020).
  if (gap > PROXIMITY_ALERT_THRESHOLD) {
    // Gap grew large -> clear any stale alert marker for this combo.
    alertedKeys.delete(alertKey(closest.id, metric));
    return null;
  }

  // Avoid duplicate alerts for the same close window.
  const key = alertKey(closest.id, metric);
  if (alertedKeys.has(key)) return null;
  alertedKeys.add(key);

  // The rank at stake is the rank of the phantom the user would overtake.
  // Compute it from the current sorted leaderboard.
  const board = social.leaderboard;
  const phantomEntry = board.find((e) => e.name === closest.name && !e.isPlayer);
  const rank = phantomEntry?.rank ?? 1;

  const metricLabel =
    metric === "tokens"
      ? gap === 1
        ? "1 token"
        : `${gap} tokens`
      : metric === "time"
        ? `${gap} min`
        : `${gap}%`;

  const alert = useSocialStore.getState().triggerProximityAlert(
    closest.name,
    gap,
    rank,
    metric,
    metricLabel,
  );
  return alert.id;
}

/**
 * Detect that the player has overtaken the phantom that was immediately above
 * them. When this happens the goalpost-shifting logic in
 * `ensurePhantomJustAbove` will fabricate a new phantom just ahead. This
 * function clears stale alert markers so a fresh alert can fire for the new
 * leader.
 *
 * Returns true if an overtake was detected (the player's value now exceeds a
 * phantom that was previously above them).
 */
export function detectOvertakeAndShift(): boolean {
  const result = ensurePhantomJustAbove();
  if (result.generated || result.shifted) {
    // A new leader appeared or the goalposts shifted; clear stale markers so
    // a fresh proximity alert can fire for the new closest phantom.
    alertedKeys.clear();
  }
  return result.generated || result.shifted;
}

/* ============================================================================
   Phantom score evolution (VAL-LEADER-016)
   ========================================================================== */

/**
 * Nudge phantom scores upward slightly so they are not frozen. Only a subset
 * of phantoms move each call to keep the evolution subtle. Phantoms far above
 * the player drift slowly; the phantom just above the player is NOT nudged
 * here (the goalpost logic keeps it pinned just ahead).
 */
export function tickPhantomScores(): void {
  const social = useSocialStore.getState();
  const metric = social.activeMetric;
  const playerVal = playerMetricValue(metric);

  for (const phantom of social.phantoms) {
    // Skip the phantom immediately above the player (it's pinned by goalposts).
    const val = phantomMetricValue(phantom, metric);
    if (val > playerVal && val - playerVal <= JUST_BARELY_AHEAD_GAP) continue;

    // ~30% chance per tick to nudge a given phantom's score.
    if (Math.random() > 0.3) continue;

    const increment = 1 + Math.floor(Math.random() * 2);
    useSocialStore.getState().adjustPhantom(phantom.id, (p) => ({
      ...p,
      tokenCount: p.tokenCount + increment,
      timeInMall: p.timeInMall + (Math.random() > 0.5 ? 1 : 0),
      explorationPercent: Math.min(
        99,
        p.explorationPercent + (Math.random() > 0.7 ? 1 : 0),
      ),
    }));
  }
}

/* ============================================================================
   Engine reset (for tests / session reset)
   ========================================================================== */

export function resetPhantomEngine(): void {
  alertedKeys.clear();
}

const phantomEngine = {
  ensurePhantomJustAbove,
  checkProximityAndAlert,
  detectOvertakeAndShift,
  tickPhantomScores,
  playerMetricValue,
  phantomMetricValue,
  entryMetricValue,
  resetPhantomEngine,
  PROXIMITY_ALERT_THRESHOLD,
  MAX_LEADERBOARD_ENTRIES,
};

export default phantomEngine;
