import { describe, it, expect, beforeEach } from "vitest";
import {
  onPlayerEnterZone,
  onZoneRevealed,
  onStoreVisited,
} from "@/engine/taskEngine";
import { useTaskStore } from "@/stores/taskStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";
import {
  ZONE_EAST_WING,
  ZONE_FOOD_COURT,
  STORE_TECHNOVA,
  STORE_CHROME,
  STORE_PRISM,
  storesByZone,
} from "@/data/mallData";
import type { Task } from "@/types";

function injectTask(task: Partial<Task> & { type: Task["type"] }): Task {
  const t: Task = {
    id: `injected-${Math.random().toString(36).slice(2)}`,
    description: "injected",
    reward: 5,
    timeGated: false,
    difficulty: 1,
    chainLevel: 0,
    targetZone: undefined,
    ...task,
  };
  // Replace active tasks with only this one for deterministic completion.
  useTaskStore.setState({
    activeTasks: [t],
    completedTasks: [],
    taskChain: 0,
  });
  return t;
}

describe("engine/taskEngine", () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
    useUIStore.getState().reset();
    useTaskStore.getState().reset();
  });

  describe("onPlayerEnterZone (explore-zone)", () => {
    it("completes an explore-zone task matching the entered zone", () => {
      const task = injectTask({
        type: "explore-zone",
        targetZone: ZONE_EAST_WING,
        reward: 4,
      });
      const results = onPlayerEnterZone(ZONE_EAST_WING);
      expect(results).toHaveLength(1);
      expect(results[0]!.completed.id).toBe(task.id);
      // Reward credited (bronze 1x).
      expect(usePlayerStore.getState().tokens).toBe(4);
      // Moved to completed + auto-generated a new task.
      expect(useTaskStore.getState().completedTasks).toContainEqual(task);
      expect(useTaskStore.getState().activeTasks.length).toBeGreaterThanOrEqual(1);
      // Celebration shown.
      expect(useUIStore.getState().activeOverlay).toBe("celebration");
    });

    it("does NOT complete an explore-zone task for a different zone", () => {
      injectTask({ type: "explore-zone", targetZone: ZONE_EAST_WING });
      const results = onPlayerEnterZone(ZONE_FOOD_COURT);
      expect(results).toHaveLength(0);
      expect(usePlayerStore.getState().tokens).toBe(0);
    });

    it("does not complete non-explore-zone tasks on zone entry", () => {
      injectTask({ type: "find-token", targetZone: ZONE_EAST_WING });
      const results = onPlayerEnterZone(ZONE_EAST_WING);
      expect(results).toHaveLength(0);
    });
  });

  describe("onZoneRevealed (find-token)", () => {
    it("completes a find-token task matching the revealed zone", () => {
      const task = injectTask({
        type: "find-token",
        targetZone: ZONE_EAST_WING,
        reward: 6,
      });
      const results = onZoneRevealed(ZONE_EAST_WING);
      expect(results).toHaveLength(1);
      expect(results[0]!.completed.id).toBe(task.id);
      expect(usePlayerStore.getState().tokens).toBe(6);
    });

    it("does NOT complete a find-token task for a different zone", () => {
      injectTask({ type: "find-token", targetZone: ZONE_EAST_WING });
      expect(onZoneRevealed(ZONE_FOOD_COURT)).toHaveLength(0);
    });
  });

  describe("onStoreVisited (visit-stores)", () => {
    it("records the visit and completes when all target stores visited", () => {
      const eastStores = storesByZone[ZONE_EAST_WING].map((s) => s.id);
      const targets = eastStores.slice(0, 2);
      injectTask({ type: "visit-stores", targetStores: targets, reward: 7 });
      // Visit first store -> not yet complete.
      let results = onStoreVisited(targets[0]!);
      expect(results).toHaveLength(0);
      expect(useMapStore.getState().visitedStores).toContain(targets[0]);
      // Visit second store -> complete.
      results = onStoreVisited(targets[1]!);
      expect(results).toHaveLength(1);
      expect(usePlayerStore.getState().tokens).toBe(7);
    });

    it("does not complete visit-stores tasks on unrelated store visits", () => {
      injectTask({
        type: "visit-stores",
        targetStores: [STORE_TECHNOVA, STORE_CHROME],
      });
      expect(onStoreVisited(STORE_PRISM)).toHaveLength(0);
    });
  });

  describe("tier multiplier (VAL-TASK-021)", () => {
    it("credits reward * tier multiplier on task completion", () => {
      usePlayerStore.getState().setTier("gold"); // 2x
      injectTask({ type: "explore-zone", targetZone: ZONE_EAST_WING, reward: 4 });
      onPlayerEnterZone(ZONE_EAST_WING);
      expect(usePlayerStore.getState().tokens).toBe(8); // 4 * 2
    });

    it("neodymium 3x multiplier applies", () => {
      usePlayerStore.getState().setTier("neodymium");
      injectTask({ type: "explore-zone", targetZone: ZONE_EAST_WING, reward: 3 });
      onPlayerEnterZone(ZONE_EAST_WING);
      expect(usePlayerStore.getState().tokens).toBe(9);
    });
  });

  describe("time-gate enforcement (VAL-TASK-010)", () => {
    it("a time-gated task cannot be completed before the gate elapses", () => {
      injectTask({
        type: "explore-zone",
        targetZone: ZONE_EAST_WING,
        reward: 4,
        timeGated: true,
        gateUntil: Date.now() + 60000,
      });
      const results = onPlayerEnterZone(ZONE_EAST_WING);
      expect(results).toHaveLength(0);
      expect(usePlayerStore.getState().tokens).toBe(0);
      // Task remains active.
      expect(
        useTaskStore.getState().activeTasks.some((t) => t.timeGated)
      ).toBe(true);
    });

    it("a time-gated task completes after the gate elapses", () => {
      injectTask({
        type: "explore-zone",
        targetZone: ZONE_EAST_WING,
        reward: 4,
        timeGated: true,
        gateUntil: Date.now() - 1000, // already elapsed
      });
      const results = onPlayerEnterZone(ZONE_EAST_WING);
      expect(results).toHaveLength(1);
      expect(usePlayerStore.getState().tokens).toBe(4);
    });
  });

  describe("auto-generation + never empty (VAL-TASK-001/002/019)", () => {
    it("completing a task auto-generates a new distinct task immediately", () => {
      const before = useTaskStore.getState().activeTasks.slice();
      const target = before[0]!;
      // Complete the first task via its real trigger if it is explore-zone;
      // otherwise inject a guaranteed explore-zone task.
      let completedId: string;
      if (target.type === "explore-zone" && target.targetZone) {
        onPlayerEnterZone(target.targetZone);
        completedId = target.id;
      } else {
        const t = injectTask({
          type: "explore-zone",
          targetZone: ZONE_EAST_WING,
        });
        onPlayerEnterZone(ZONE_EAST_WING);
        completedId = t.id;
      }
      const after = useTaskStore.getState().activeTasks;
      expect(after.length).toBeGreaterThanOrEqual(1);
      // Completed task id no longer active.
      expect(after.some((t) => t.id === completedId)).toBe(false);
      // Chain incremented.
      expect(useTaskStore.getState().taskChain).toBeGreaterThanOrEqual(1);
    });

    it("task list is never empty after completing all active tasks", () => {
      const ids = useTaskStore.getState().activeTasks.map((t) => t.id);
      for (const id of ids) {
        // Force completion by clearing any time gate.
        const task = useTaskStore
          .getState()
          .activeTasks.find((t) => t.id === id);
        if (task?.timeGated) {
          useTaskStore.getState().escalateTaskDifficulty(id); // no-op for gate
        }
        useTaskStore.getState().completeTask(id);
      }
      expect(useTaskStore.getState().activeTasks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
