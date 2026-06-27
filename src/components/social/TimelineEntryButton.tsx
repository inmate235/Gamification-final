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
      className="relative flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-white/20 z-40 overflow-hidden group"
    >
      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
      <PlayCircle size={24} weight="fill" className="text-white relative z-10" />
      <span className="text-white font-bold text-sm uppercase tracking-wider relative z-10">
        Trending
      </span>
      {!hasSeenTimelineOnboarding && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
      )}
    </motion.button>
  );
}
