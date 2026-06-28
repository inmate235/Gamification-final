import { motion } from "framer-motion";
import { PlayCircle } from "@phosphor-icons/react";
import { useUIStore } from "@/stores/uiStore";

export function TimelineEntryButton() {
  const setTimelineOpen = useUIStore((s) => s.setTimelineOpen);
  const hasSeenTimelineOnboarding = useUIStore((s) => s.hasSeenTimelineOnboarding);

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setTimelineOpen(true)}
      className="relative flex items-center justify-center gap-2 rounded-full bg-[#e6009e] px-4 py-3 shadow-[0_6px_0_#b8007e] ring-2 ring-white transition-all duration-200 active:translate-y-[3px] active:shadow-[0_3px_0_#b8007e] z-40 overflow-hidden group"
    >
      <PlayCircle size={22} weight="fill" className="text-white" />
      <span className="font-display text-[12px] font-bold uppercase tracking-[0.1em] text-white">
        Trending
      </span>
      {!hasSeenTimelineOnboarding && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffe600] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ffe600] ring-2 ring-white"></span>
        </span>
      )}
    </motion.button>
  );
}
