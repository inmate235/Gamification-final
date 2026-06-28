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
  Star,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { useTaskStore } from "@/stores/taskStore";
import type { Task, TaskType } from "@/types";

/**
 * TaskPanel — the bottom chrome of `/mall`.
 *
 * Playful Figma direction: magenta floating "Quests" pill, yellow (#ffe600)
 * expanded panel with a sticker "Active Quests" heading, white quest cards
 * with colored type icons, magenta star reward badges and magenta pill
 * progress bars.
 *
 * Behaviour preserved from the original:
 *  - Bottom panel expand/collapse via uiStore.toggleBottomPanel
 *  - Never-empty breadcrumb task list (2-4 active tasks)
 *  - Star reward indicators + progress bars
 *  - Time-gated countdowns with live ticking
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;
const POP = [0.34, 1.56, 0.64, 1] as const;

/* ============================================================================
   Task type presentation
   ========================================================================== */

interface TypeStyle {
  icon: React.ReactNode;
  color: string;
  label: string;
  image: string;
}

function typeStyle(type: TaskType): TypeStyle {
  switch (type) {
    case "explore-zone":
      return {
        icon: <Compass size={16} weight="fill" />,
        color: "#14b8a6",
        label: "Explore",
        image: "/assets/figma/Rectangle 5.png",
      };
    case "find-token":
      return {
        icon: <Coin size={16} weight="fill" />,
        color: "#e6009e",
        label: "Find Token",
        image: "/assets/figma/Rectangle 8.png",
      };
    case "visit-stores":
      return {
        icon: <Storefront size={16} weight="fill" />,
        color: "#7c3aed",
        label: "Visit Stores",
        image: "/assets/figma/Rectangle 9.png",
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
    <div data-testid="task-panel">
      {/* Floating Entry Pill — magenta */}
      <AnimatePresence>
        {!expanded && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.85 }}
            transition={{ duration: 0.6, ease: POP }}
            className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2"
          >
            <button
              onClick={handleToggle}
              aria-expanded={expanded}
              aria-controls="task-panel-content"
              aria-label="Open Quests"
              className="group flex items-center gap-2.5 rounded-full bg-[#e6009e] px-5 py-3 text-white shadow-[0_6px_0_#b8007e] transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:translate-y-[3px] active:shadow-[0_3px_0_#b8007e]"
              data-testid="task-panel-toggle"
            >
              <ListChecks
                size={18}
                weight="fill"
                className="text-white transition-transform duration-300 group-hover:scale-110"
              />
              <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-white">
                Quests
              </span>
              {taskCount > 0 && (
                <span
                  className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-[#e6009e]"
                  data-testid="task-panel-count"
                >
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: PREMIUM_EASE }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#141414]/40 px-4 backdrop-blur-sm"
            data-testid="task-panel-content"
          >
            {/* Click-away backdrop */}
            <div className="absolute inset-0" onClick={handleToggle} />

            <motion.div
              initial={{ scale: 0.95, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 24 }}
              transition={{ duration: 0.5, ease: POP }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[#ffe600] p-5 shadow-[0_20px_60px_rgba(20,20,20,0.25)] ring-3 ring-[#141414]/10"
            >
              {/* Header */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="sticker-heading text-2xl flex items-center gap-2">
                    Active Quests
                    {taskCount > 0 && (
                      <span
                        className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#e6009e] px-1.5 text-[11px] font-bold text-white ring-2 ring-white"
                        data-testid="task-panel-count"
                      >
                        {taskCount}
                      </span>
                    )}
                  </h2>
                </div>
                <button
                  onClick={handleToggle}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#141414] ring-2 ring-[#141414]/10 transition-all duration-200 hover:ring-[#141414]/25 active:scale-95"
                  aria-label="Close quests"
                  data-testid="task-panel-toggle"
                >
                  <CaretDown size={18} weight="bold" />
                </button>
              </div>

              <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {activeTasks.map((task, index) => (
                    <TaskCard key={task.id} task={task} now={now} index={index} />
                  ))}
                </AnimatePresence>

                {hasGated && (
                  <p className="mt-1 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-[#141414]/55">
                    Timed quests unlock after the countdown
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================================
   TaskCard — white quest card on the yellow panel
   ========================================================================== */

function TaskCard({
  task,
  now,
  index = 0,
}: {
  task: Task;
  now: number;
  index?: number;
}) {
  const style = typeStyle(task.type);
  const gated = task.timeGated && task.gateUntil !== undefined;
  const remaining = gated ? (task.gateUntil ?? 0) - now : 0;
  const ready = gated && remaining <= 0;
  const [imgError, setImgError] = useState(false);

  // Progress calculation: based on chain level (higher = more progress)
  const progressPercent = Math.min(((task.chainLevel + 1) / 5) * 100, 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.25 } }}
      transition={{ duration: 0.5, ease: PREMIUM_EASE, delay: index * 0.06 }}
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-[#141414]/8"
      )}
      data-testid="task-card"
      data-task-id={task.id}
      data-task-type={task.type}
    >
      {/* Quest illustration (Rectangle asset) with colored icon fallback */}
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={!imgError ? { background: "#f4f4f5" } : { color: "#ffffff", background: style.color }}
        aria-hidden
      >
        {!imgError ? (
          <img
            src={style.image}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          style.icon
        )}
      </span>

      {/* Description + meta */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold text-[#141414]"
          data-testid="task-card-description"
        >
          {task.description}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: style.color }}
          >
            {style.label}
          </span>
          {gated && (
            <span
              className={cn(
                "flex items-center gap-1 text-[10px] font-mono tabular-nums",
                ready ? "text-[#14b8a6]" : "text-[#ef4444]"
              )}
              data-testid="task-card-timer"
            >
              <Timer size={11} weight="fill" />
              {ready ? "Ready" : formatRemaining(remaining)}
            </span>
          )}
          {!gated && (
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#8a8a8a]">
              Lv {task.chainLevel + 1}
            </span>
          )}
        </div>

        {/* Progress bar — magenta pill (Figma nodes 70:80, 70:81) */}
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#141414]/8">
          <div
            className="h-full rounded-full bg-[#e6009e] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Reward — magenta star badge (Figma nodes 7:21, 11:15, 11:21) */}
      <span
        className="flex shrink-0 items-center gap-1 rounded-full bg-[#e6009e]/10 px-2.5 py-1 text-xs font-bold text-[#e6009e] ring-1.5 ring-[#e6009e]/30"
        data-testid="task-card-reward"
      >
        <Star size={11} weight="fill" className="text-[#e6009e]" />
        <span className="font-mono tabular-nums">+{task.reward}</span>
      </span>
    </motion.div>
  );
}

export { TaskCard };

export default TaskPanel;
