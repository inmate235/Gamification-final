/**
 * taskStore - breadcrumb task system.
 *
 * Holds: activeTasks, completedTasks, taskChain.
 * Actions: completeTask, generateNextTask, getTimeGatedTasks,
 *          escalateTaskDifficulty, addTask, seedInitialTasks, reset.
 *
 * The task list is NEVER empty: completing a task immediately auto-generates
 * a new one with an escalated chain level and slightly larger reward.
 * Generation is delegated to `engine/taskGenerator` so every task references
 * a real map location (zone id, and store ids for visit-stores tasks).
 */

import { create } from "zustand";
import type { Task, TaskState } from "@/types";
import {
  generateTask,
  generateInitialTasks,
  __resetTaskIdCounter,
} from "@/engine/taskGenerator";
import { useMapStore } from "./mapStore";

/* ============================================================================
   Store
   ========================================================================== */

export interface TaskStore extends TaskState {
  addTask: (task: Task) => void;
  completeTask: (taskId: string) => Task | null;
  generateNextTask: (chainLevel?: number) => Task;
  getTimeGatedTasks: () => Task[];
  escalateTaskDifficulty: (taskId: string) => void;
  seedInitialTasks: () => void;
  reset: () => void;
}

/** Current set of revealed zone ids (used to keep find-token tasks solvable). */
function revealedZoneIds(): Set<string> {
  const fog = useMapStore.getState().fogState;
  return new Set(Object.keys(fog).filter((id) => fog[id]));
}

function buildInitialTasks(): Task[] {
  return generateInitialTasks(revealedZoneIds());
}

const initialTasks = buildInitialTasks();

export const useTaskStore = create<TaskStore>((set, get) => ({
  activeTasks: initialTasks,
  completedTasks: [],
  taskChain: 0,

  addTask: (task) =>
    set((state) => ({
      activeTasks: state.activeTasks.some((t) => t.id === task.id)
        ? state.activeTasks
        : [...state.activeTasks, task],
    })),

  completeTask: (taskId) => {
    const state = get();
    const task = state.activeTasks.find((t) => t.id === taskId);
    if (!task) return null;

    // Time-gated tasks cannot be completed before the gate elapses.
    if (task.timeGated && task.gateUntil !== undefined) {
      if (Date.now() < task.gateUntil) return null;
    }

    const nextChainLevel = state.taskChain + 1;
    const nextTask = get().generateNextTask(nextChainLevel);

    set({
      activeTasks: [
        ...state.activeTasks.filter((t) => t.id !== taskId),
        nextTask,
      ],
      completedTasks: [...state.completedTasks, task],
      taskChain: nextChainLevel,
    });

    return task;
  },

  generateNextTask: (chainLevel) => {
    const nextChain = chainLevel ?? get().taskChain + 1;
    // Avoid instantly regenerating the same task type+zone as the most
    // recently completed task (VAL-TASK-019).
    const last =
      get().completedTasks[get().completedTasks.length - 1] ?? null;
    return generateTask({
      chainLevel: nextChain,
      revealedZoneIds: revealedZoneIds(),
      avoid:
        last && last.targetZone
          ? { type: last.type, targetZone: last.targetZone }
          : undefined,
    });
  },

  getTimeGatedTasks: () =>
    get().activeTasks.filter((t) => t.timeGated && t.gateUntil !== undefined),

  escalateTaskDifficulty: (taskId) =>
    set((state) => ({
      activeTasks: state.activeTasks.map((t) =>
        t.id === taskId
          ? { ...t, difficulty: t.difficulty + 1, reward: t.reward + 1 }
          : t
      ),
    })),

  seedInitialTasks: () => {
    if (get().activeTasks.length > 0) return;
    set({ activeTasks: buildInitialTasks() });
  },

  reset: () => {
    __resetTaskIdCounter();
    set({
      activeTasks: buildInitialTasks(),
      completedTasks: [],
      taskChain: 0,
    });
  },
}));

export default useTaskStore;
