/**
 * taskStore - breadcrumb task system.
 *
 * Holds: activeTasks, completedTasks, taskChain.
 * Actions: completeTask, generateNextTask, getTimeGatedTasks,
 *          escalateTaskDifficulty, addTask, seedInitialTasks, reset.
 *
 * The task list is NEVER empty: completing a task immediately auto-generates
 * a new one with an escalated chain level and slightly larger reward.
 */

import { create } from "zustand";
import type { Task, TaskState, TaskType } from "@/types";
import { zones } from "@/data/mallData";

/* ============================================================================
   Task pool / templates
   ========================================================================== */

interface TaskTemplate {
  type: TaskType;
  description: string;
  baseReward: number;
  difficulty: number;
}

const TASK_TEMPLATES: TaskTemplate[] = [
  {
    type: "explore-zone",
    description: "Explore the {zoneName}",
    baseReward: 3,
    difficulty: 1,
  },
  {
    type: "find-token",
    description: "Find a hidden token in the {zoneName}",
    baseReward: 4,
    difficulty: 2,
  },
  {
    type: "visit-stores",
    description: "Visit {count} stores in the {zoneName}",
    baseReward: 5,
    difficulty: 3,
  },
  {
    type: "explore-zone",
    description: "Discover a new wing of the mall",
    baseReward: 4,
    difficulty: 2,
  },
  {
    type: "find-token",
    description: "Collect the secret token at the Food Court",
    baseReward: 10,
    difficulty: 4,
  },
];

const TIME_GATE_MS = 15 * 60 * 1000; // 15 minutes

/* ============================================================================
   Helpers
   ========================================================================== */

let taskCounter = 0;

function nextTaskId(): string {
  taskCounter += 1;
  return `task-${taskCounter}`;
}

function pickZoneName(rng: () => number = Math.random): string {
  const zone = zones[Math.floor(rng() * zones.length)];
  return zone?.name ?? "Entrance";
}

function renderTemplate(
  template: TaskTemplate,
  chainLevel: number,
  rng: () => number = Math.random
): Task {
  const zoneName = pickZoneName(rng);
  const description = template.description
    .replace("{zoneName}", zoneName)
    .replace("{count}", String(2 + (chainLevel % 3)));
  const reward = template.baseReward + chainLevel;
  const difficulty = template.difficulty + Math.floor(chainLevel / 2);
  const timeGated = chainLevel > 0 && rng() < 0.3; // ~30% time-gated after first
  const now = Date.now();
  return {
    id: nextTaskId(),
    type: template.type,
    description,
    reward,
    timeGated,
    gateUntil: timeGated ? now + TIME_GATE_MS : undefined,
    difficulty,
    chainLevel,
  };
}

function pickTemplate(rng: () => number = Math.random): TaskTemplate {
  const t = TASK_TEMPLATES[Math.floor(rng() * TASK_TEMPLATES.length)];
  return t ?? TASK_TEMPLATES[0]!;
}

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

function buildInitialTasks(): Task[] {
  // Seed 2-3 initial tasks at chain level 0 so the panel is never empty.
  const seeded: Task[] = [];
  const seenTypes = new Set<TaskType>();
  for (const template of TASK_TEMPLATES) {
    if (seenTypes.has(template.type)) continue;
    if (seeded.length >= 2) break;
    seeded.push(renderTemplate(template, 0));
    seenTypes.add(template.type);
  }
  return seeded;
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
    const template = pickTemplate();
    return renderTemplate(template, nextChain);
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

  reset: () =>
    set({
      activeTasks: buildInitialTasks(),
      completedTasks: [],
      taskChain: 0,
    }),
}));

export default useTaskStore;
