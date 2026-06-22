"use client";

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CaretDown, ListChecks } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";

/**
 * TaskPanel — the bottom chrome of `/mall`.
 *
 * A placeholder bottom panel that is present and expandable/collapsible. The
 * full breadcrumb task system is built in a subsequent feature; this component
 * establishes the chrome (toggle handle + container) so the map layout is
 * complete and the panel is toggleable via uiStore.toggleBottomPanel.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

export function TaskPanel() {
  const expanded = useUIStore((s) => s.bottomPanelExpanded);
  const toggle = useUIStore((s) => s.toggleBottomPanel);

  const handleToggle = useCallback(() => toggle(), [toggle]);

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
              <ListChecks
                size={16}
                weight="light"
                className="text-[#9d7fdb]"
              />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">
                Tasks
              </span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-[#71717a] ring-1 ring-white/10">
                Soon
              </span>
            </span>
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.5, ease: PREMIUM_EASE }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10"
            >
              <CaretDown
                size={14}
                weight="light"
                className="text-[#a1a1aa]"
              />
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
              >
                <div
                  className={cn(
                    "px-4 pb-4 pt-1",
                    "flex flex-col items-center justify-center gap-2",
                    "min-h-[120px] text-center"
                  )}
                  data-testid="task-panel-content"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                    <ListChecks
                      size={18}
                      weight="light"
                      className="text-[#71717a]"
                    />
                  </span>
                  <p className="text-sm text-[#a1a1aa]">
                    Your quest log is being prepared.
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-[#71717a]">
                    Breadcrumb tasks arriving soon
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </footer>
  );
}

export default TaskPanel;
