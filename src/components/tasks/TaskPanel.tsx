"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CaretDown,
  ListChecks,
  Compass,
  Coin,
  Storefront,
  Timer,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { useTaskStore } from "@/stores/taskStore";
import type { Task, TaskType } from "@/types";

/**
 * TaskPanel — the bottom chrome of `/mall`.
 *
 * Renders the breadcrumb task list: a never-empty set of active tasks (2-4 at
 * once) shown as double-bezel cards. Each card shows the task type icon, a
 * human-readable description referencing a real map location, and the token
 * reward. Time-gated tasks display a live countdown. The panel is
 * expandable/collapsible via `uiStore.toggleBottomPanel`.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Task type presentation
   ========================================================================== */

interface TypeStyle {
  icon: React.ReactNode;
  color: string;
  label: string;
}

function typeStyle(type: TaskType): TypeStyle {
  switch (type) {
    case "explore-zone":
      return {
        icon: <Compass size={15} weight="light" />,
        color: "#4fd1c5",
        label: "Explore",
      };
    case "find-token":
      return {
        icon: <Coin size={15} weight="light" />,
        color: "#d4af37",
        label: "Find Token",
      };
    case "visit-stores":
      return {
        icon: <Storefront size={15} weight="light" />,
        color: "#9d7fdb",
        label: "Visit Stores",
      };
  }
}

/* ============================================================================
   Countdown helper
   ========================================================================== */

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Ready";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ============================================================================
   Component
   ========================================================================== */

export function TaskPanel() {
  const expanded = useUIStore((s) => s.bottomPanelExpanded);
  const toggle = useUIStore((s) => s.toggleBottomPanel);
  const activeTasks = useTaskStore((s) => s.activeTasks);

  // Live clock for time-gate countdowns (ticks every second).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleToggle = useCallback(() => toggle(), [toggle]);

  const taskCount = activeTasks.length;
  const hasGated = activeTasks.some((t) => t.timeGated && t.gateUntil);

  return (
    <footer
      className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-4 sm:pb-4"
      aria-label="Task panel"
      data-testid="task-panel"
    >
      <div className="bezel-card !rounded-[1.25rem] !p-1 sm:!rounded-[1.5rem]">
        <div className="bezel-card-inner !rounded-[calc(1.25rem-0.375rem)] !p-0 sm:!rounded-[calc(1.5rem-0.375rem)]">
          {/* Toggle handle */}
          <button
            onClick={handleToggle}
            aria-expanded={expanded}
            aria-controls="task-panel-content"
            aria-label={expanded ? "Collapse task panel" : "Expand task panel"}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.99]"
            data-testid="task-panel-toggle"
          >
            <span className="flex items-center gap-2.5">
              <ListChecks size={16} weight="light" className="text-[#9d7fdb]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">
                Quests
              </span>
              <span
                className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-[#d4af37] ring-1 ring-white/10"
                data-testid="task-panel-count"
              >
                {taskCount}
              </span>
            </span>
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.5, ease: PREMIUM_EASE }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10"
            >
              <CaretDown size={14} weight="light" className="text-[#a1a1aa]" />
            </motion.span>
          </button>

          {/* Expandable content */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                id="task-panel-content"
                key="task-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.5, ease: PREMIUM_EASE }}
                className="overflow-hidden"
                data-testid="task-panel-content"
              >
                <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto px-3 pb-3 pt-1 sm:px-4">
                  <AnimatePresence initial={false}>
                    {activeTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        now={now}
                      />
                    ))}
                  </AnimatePresence>
                  {hasGated && (
                    <p className="px-1 pt-0.5 text-center text-[10px] uppercase tracking-[0.15em] text-[#71717a]">
                      Timed quests unlock after the countdown
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================================
   TaskCard
   ========================================================================== */

function TaskCard({ task, now }: { task: Task; now: number }) {
  const style = typeStyle(task.type);
  const gated = task.timeGated && task.gateUntil !== undefined;
  const remaining = gated ? (task.gateUntil ?? 0) - now : 0;
  const ready = gated && remaining <= 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.25 } }}
      transition={{ duration: 0.5, ease: PREMIUM_EASE }}
      className={cn(
        "flex items-center gap-3 rounded-2xl bg-white/[0.03] p-2.5 ring-1 ring-white/10",
        "transition-shadow duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
      )}
      style={{ boxShadow: `0 0 16px ${style.color}14` }}
      data-testid="task-card"
      data-task-id={task.id}
      data-task-type={task.type}
    >
      {/* Type icon badge */}
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1"
        style={{
          color: style.color,
          background: `${style.color}12`,
          ["--tw-ring-color" as string]: `${style.color}33`,
        }}
        aria-hidden
      >
        {style.icon}
      </span>

      {/* Description + meta */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium text-[#f5f5f7]"
          data-testid="task-card-description"
        >
          {task.description}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span
            className="text-[10px] font-medium uppercase tracking-[0.12em]"
            style={{ color: style.color }}
          >
            {style.label}
          </span>
          {gated && (
            <span
              className={cn(
                "flex items-center gap-1 text-[10px] font-mono tabular-nums",
                ready ? "text-[#4fd1c5]" : "text-[#e879a1]"
              )}
              data-testid="task-card-timer"
            >
              <Timer size={11} weight="light" />
              {ready ? "Ready" : formatRemaining(remaining)}
            </span>
          )}
          {!gated && (
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#71717a]">
              Lv {task.chainLevel + 1}
            </span>
          )}
        </div>
      </div>

      {/* Reward */}
      <span
        className="flex shrink-0 items-center gap-1 rounded-full bg-[#d4af37]/10 px-2.5 py-1 text-xs font-semibold text-[#d4af37] ring-1 ring-[#d4af37]/25"
        data-testid="task-card-reward"
      >
        <Coin size={12} weight="fill" />
        <span className="font-mono tabular-nums">+{task.reward}</span>
      </span>
    </motion.div>
  );
}

export { TaskCard };

export default TaskPanel;
