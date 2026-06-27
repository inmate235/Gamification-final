import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, PlayCircle } from "@phosphor-icons/react";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import { showTokenFeedback } from "@/engine/tokenEconomy";

export function TimelineOnboardingPopup() {
  const hasSeenTimelineOnboarding = useUIStore((s) => s.hasSeenTimelineOnboarding);
  const markTimelineOnboardingSeen = useUIStore((s) => s.markTimelineOnboardingSeen);
  const awardTokens = usePlayerStore((s) => s.awardTokens);
  
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show if they haven't seen it, with a tiny delay for better UX
    if (!hasSeenTimelineOnboarding) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTimelineOnboarding]);

  const handleDismiss = () => {
    setIsVisible(false);
    markTimelineOnboardingSeen();
    
    // Reward the user for discovering the feed!
    const tokensAwarded = awardTokens(50); // 50 base tokens
    showTokenFeedback("earn", tokensAwarded, "Discovered Timeline!");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm pointer-events-auto"
        >
          <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
            <button 
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-white/60 hover:text-white"
            >
              <X size={24} />
            </button>
            
            <div className="flex flex-col items-center text-center gap-4 mt-2">
              <div className="bg-indigo-500/20 p-4 rounded-full border border-indigo-500/30">
                <PlayCircle size={48} weight="duotone" className="text-indigo-400" />
              </div>
              
              <h2 className="text-xl font-bold text-white">Trending Feed Unlocked!</h2>
              
              <p className="text-white/80 text-sm">
                Swipe through our new AI-generated, highly curated video feed to discover exclusive products and flash sales. 
              </p>
              
              <p className="text-indigo-300 font-medium text-sm border border-indigo-500/30 bg-indigo-500/10 py-2 px-4 rounded-lg w-full">
                🎁 +50 Tokens for exploring
              </p>

              <button
                onClick={handleDismiss}
                className="mt-2 w-full py-3 bg-white text-black font-bold rounded-xl active:scale-95 transition-transform"
              >
                Start Watching
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
