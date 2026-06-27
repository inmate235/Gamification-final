import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CaretLeft } from "@phosphor-icons/react";
import { timelineFeed } from "@/data/feedData";
import { TimelineVideo } from "./TimelineVideo";
import { TimelineOnboardingPopup } from "./TimelineOnboardingPopup";
import { useUIStore } from "@/stores/uiStore";

export function TimelineFeed() {
  const isTimelineOpen = useUIStore((s) => s.isTimelineOpen);
  const setTimelineOpen = useUIStore((s) => s.setTimelineOpen);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer to determine active video
  useEffect(() => {
    if (!containerRef.current || !isTimelineOpen) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            setActiveIndex(index);
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.6, // Trigger when 60% of the video is visible
      }
    );

    const children = containerRef.current.children;
    for (let i = 0; i < children.length; i++) {
      observer.observe(children[i]);
    }

    return () => observer.disconnect();
  }, [isTimelineOpen]);

  return (
    <AnimatePresence>
      {isTimelineOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-50 bg-black flex flex-col"
        >
          {/* Header */}
          <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/80 to-transparent z-30 pointer-events-none" />
          
          <div className="absolute top-12 left-4 right-4 z-40 flex items-center justify-between">
            <button
              onClick={() => setTimelineOpen(false)}
              className="p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white active:scale-95 transition-transform"
            >
              <CaretLeft size={24} weight="bold" />
            </button>
            <div className="flex gap-4 items-center px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
              <span className="text-white font-bold text-sm tracking-wide">For You</span>
            </div>
            <div className="w-10" /> {/* Spacer for balance */}
          </div>

          {/* Scrollable Feed Container */}
          <div 
            ref={containerRef}
            className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar"
            style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
          >
            {timelineFeed.map((item, index) => (
              <div 
                key={item.id} 
                data-index={index}
                className="h-[100dvh] w-full snap-center relative"
              >
                <TimelineVideo item={item} isActive={index === activeIndex} />
              </div>
            ))}
          </div>
          
          {/* Onboarding Popup Overlay */}
          <TimelineOnboardingPopup />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
