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
    <>
      {/* Floating Entry Orb */}
      <AnimatePresence>
        {!expanded && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.85 }}
            transition={{ duration: 0.7, ease: PREMIUM_EASE }}
            className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2"
          >
            <button
              onClick={handleToggle}
              aria-expanded={expanded}
              aria-controls="task-panel-content"
              aria-label="Open Quests"
              className="group flex items-center gap-3 rounded-full bg-[#12121a]/80 px-5 py-3 ring-1 ring-[#9d7fdb]/40 backdrop-blur-md transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#12121a] hover:ring-[#9d7fdb]/60 active:scale-[0.97]"
              style={{ boxShadow: "0 0 24px rgba(157,127,219,0.2)" }}
              data-testid="task-panel-toggle"
            >
              <ListChecks size={18} weight="light" className="text-[#9d7fdb] transition-transform duration-500 group-hover:scale-110" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f5f5f7]">
                Quests
              </span>
              {taskCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#9d7fdb] px-1.5 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(157,127,219,0.5)]">
                  {taskCount}
                </span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-Screen Focus Overlay */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            id="task-panel-content"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(16px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: PREMIUM_EASE }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 px-4"
            data-testid="task-panel-content"
          >
            {/* Click-away backdrop */}
            <div className="absolute inset-0" onClick={handleToggle} />

            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ duration: 0.5, ease: PREMIUM_EASE }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[#12121a]/90 p-1 ring-1 ring-white/10 shadow-[0_0_40px_rgba(157,127,219,0.15)]"
            >
              <div className="rounded-[calc(1.5rem-4px)] bg-[#1a1a24]/90 p-5">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#9d7fdb]/10 ring-1 ring-[#9d7fdb]/30">
                      <ListChecks size={20} weight="light" className="text-[#9d7fdb]" />
                    </div>
                    <h2 className="text-lg font-semibold uppercase tracking-widest text-white">
                      Active Quests
                    </h2>
                  </div>
                  <button
                    onClick={handleToggle}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                    aria-label="Close quests"
                  >
                    <CaretDown size={16} weight="light" className="text-[#a1a1aa]" />
                  </button>
                </div>

                <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {activeTasks.map((task) => (
                      <TaskCard key={task.id} task={task} now={now} />
                    ))}
                  </AnimatePresence>
                  
                  {hasGated && (
                    <p className="mt-2 text-center text-[10px] uppercase tracking-[0.15em] text-[#71717a]">
                      Timed quests unlock after the countdown
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
