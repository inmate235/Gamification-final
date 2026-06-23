/**
 * taskEngine - orchestrates breadcrumb task completion.
 *
 * Bridges player actions (zone entry, zone reveal / token pickup, store
 * visits) to the taskStore and token economy. A task is completed ONLY by the
 * action described in its description (VAL-TASK-018):
 *
 *   - explore-zone : completes when the player ENTERS the target zone.
 *   - find-token   : completes when a token is found in the target zone
 *                    (first fog reveal / secret-token pickup there).
 *   - visit-stores : completes when ALL target stores have been visited.
 *
 * On completion the engine:
 *   1. Calls `taskStore.completeTask` (moves to completed + auto-generates a
 *      new escalated task — VAL-TASK-002, VAL-TASK-008/009).
 *   2. Awards the displayed reward through the tier multiplier
 *      (`awardTaskReward`) — VAL-TASK-015, VAL-TASK-021.
 *   3. Triggers a celebration overlay — VAL-TASK-014.
 *
 * Time-gated tasks are rejected by `completeTask` before the gate elapses
 * (VAL-TASK-010).
 */

import { useTaskStore } from "@/stores/taskStore";
import { useMapStore } from "@/stores/mapStore";
import { awardTaskReward } from "@/engine/tokenEconomy";
import type { Task } from "@/types";

export interface TaskCompletionResult {
  completed: Task;
  credited: number;
}

/* ============================================================================
   Internal: complete a single task (reward + celebration + auto-generate)
   ========================================================================== */

function completeAndReward(task: Task): TaskCompletionResult | null {
  // completeTask handles time-gate enforcement and auto-generation.
  const completed = useTaskStore.getState().completeTask(task.id);
  if (!completed) return null;
  const credited = awardTaskReward(completed);
  return { completed, credited };
}

/* ============================================================================
   Public: player action hooks
   ========================================================================== */

/**
 * Call when the player enters a zone. Completes any `explore-zone` task whose
 * targetZone matches. Returns the completed tasks (if any).
 */
export function onPlayerEnterZone(zoneId: string): TaskCompletionResult[] {
  const tasks = useTaskStore.getState().activeTasks;
  const results: TaskCompletionResult[] = [];
  for (const task of tasks) {
    if (task.type === "explore-zone" && task.targetZone === zoneId) {
      const r = completeAndReward(task);
      if (r) results.push(r);
    }
  }
  return results;
}

/**
 * Call when a zone is revealed (a token is found there on first fog clear).
 * Completes any `find-token` task whose targetZone matches. Returns the
 * completed tasks (if any).
 */
export function onZoneRevealed(zoneId: string): TaskCompletionResult[] {
  const tasks = useTaskStore.getState().activeTasks;
  const results: TaskCompletionResult[] = [];
  for (const task of tasks) {
    if (task.type === "find-token" && task.targetZone === zoneId) {
      const r = completeAndReward(task);
      if (r) results.push(r);
    }
  }
  return results;
}

/**
 * Call when the player opens (visits) a store. Records the visit in mapStore
 * and completes any `visit-stores` task whose target stores have all now been
 * visited. Returns the completed tasks (if any).
 */
export function onStoreVisited(storeId: string): TaskCompletionResult[] {
  // Record the visit.
  useMapStore.getState().visitStore(storeId);

  const visited = new Set(useMapStore.getState().visitedStores);
  const tasks = useTaskStore.getState().activeTasks;
  const results: TaskCompletionResult[] = [];
  for (const task of tasks) {
    if (task.type !== "visit-stores") continue;
    const targets = task.targetStores ?? [];
    if (targets.length === 0) continue;
    const allVisited = targets.every((id) => visited.has(id));
    if (allVisited) {
      const r = completeAndReward(task);
      if (r) results.push(r);
    }
  }
  return results;
}

const taskEngine = {
  onPlayerEnterZone,
  onZoneRevealed,
  onStoreVisited,
};

export default taskEngine;
