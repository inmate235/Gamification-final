import { describe, it, expect, beforeEach } from "vitest";
import { useTaskStore } from "@/stores/taskStore";

describe("taskStore", () => {
  beforeEach(() => {
    useTaskStore.getState().reset();
  });

  it("initializes with at least one active task", () => {
    expect(useTaskStore.getState().activeTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("starts with chain level 0 and empty completedTasks", () => {
    expect(useTaskStore.getState().taskChain).toBe(0);
    expect(useTaskStore.getState().completedTasks).toEqual([]);
  });

  it("completeTask moves a task to completedTasks and auto-generates a new one", () => {
    const firstTask = useTaskStore.getState().activeTasks[0];
    if (!firstTask) throw new Error("Expected an initial task");
    const result = useTaskStore.getState().completeTask(firstTask.id);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(firstTask.id);

    const s = useTaskStore.getState();
    expect(s.completedTasks).toContainEqual(firstTask);
    expect(s.activeTasks.length).toBeGreaterThanOrEqual(1);
    expect(s.taskChain).toBe(1);
  });

  it("task list is never empty after a completion", () => {
    // Complete every currently-active task.
    const ids = useTaskStore.getState().activeTasks.map((t) => t.id);
    for (const id of ids) {
      useTaskStore.getState().completeTask(id);
    }
    expect(useTaskStore.getState().activeTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("completeTask returns null for an unknown id", () => {
    expect(useTaskStore.getState().completeTask("does-not-exist")).toBeNull();
  });

  it("generated tasks have escalating chain levels", () => {
    const first = useTaskStore.getState().activeTasks[0];
    if (!first) throw new Error("Expected an initial task");
    useTaskStore.getState().completeTask(first.id);
    const next = useTaskStore.getState().activeTasks.find(
      (t) => t.chainLevel === 1
    );
    expect(next).toBeDefined();
    expect(next?.chainLevel).toBe(1);
  });

  it("task templates cover all three task types", () => {
    // Re-seed multiple tasks and ensure each type shows up eventually.
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const t = useTaskStore.getState().generateNextTask(i);
      seen.add(t.type);
    }
    expect(seen.has("explore-zone")).toBe(true);
    expect(seen.has("find-token")).toBe(true);
    expect(seen.has("visit-stores")).toBe(true);
  });

  it("each task has a description, positive reward, and difficulty", () => {
    for (const t of useTaskStore.getState().activeTasks) {
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.reward).toBeGreaterThan(0);
      expect(t.difficulty).toBeGreaterThanOrEqual(1);
    }
  });

  it("time-gated tasks cannot be completed before the gate elapses", () => {
    const task = useTaskStore.getState().generateNextTask(5);
    if (!task.timeGated || task.gateUntil === undefined) {
      // Force gate for this assertion.
      task.timeGated = true;
      task.gateUntil = Date.now() + 60000;
    }
    useTaskStore.getState().addTask(task);
    const result = useTaskStore.getState().completeTask(task.id);
    expect(result).toBeNull();
  });

  it("getTimeGatedTasks returns only gated tasks", () => {
    const gated = useTaskStore.getState().generateNextTask(5);
    gated.timeGated = true;
    gated.gateUntil = Date.now() + 60000;
    useTaskStore.getState().addTask(gated);
    const all = useTaskStore.getState().getTimeGatedTasks();
    expect(all.every((t) => t.timeGated)).toBe(true);
    expect(all.some((t) => t.id === gated.id)).toBe(true);
  });

  it("escalateTaskDifficulty bumps difficulty and reward", () => {
    const task = useTaskStore.getState().activeTasks[0];
    if (!task) throw new Error("Expected an initial task");
    const beforeDiff = task.difficulty;
    const beforeReward = task.reward;
    useTaskStore.getState().escalateTaskDifficulty(task.id);
    const after = useTaskStore
      .getState()
      .activeTasks.find((t) => t.id === task.id);
    expect(after?.difficulty).toBe(beforeDiff + 1);
    expect(after?.reward).toBe(beforeReward + 1);
  });
});
