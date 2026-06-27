import { useMemo, useState } from "react";
import { Heart, ChatCircle, ShareFat, Storefront, ShoppingBag } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import type { FeedItem } from "@/data/feedData";
import { stores } from "@/data/mallData";
import { useUIStore } from "@/stores/uiStore";

interface TimelineVideoProps {
  item: FeedItem;
  isActive: boolean;
}

export function TimelineVideo({ item, isActive }: TimelineVideoProps) {
  const [isLiked, setIsLiked] = useState(false);
  const showOverlay = useUIStore((s) => s.showOverlay);

  const store = useMemo(() => {
    return stores.find((s) => s.id === item.storeId);
  }, [item.storeId]);

  if (!store) return null;

  const handleGoToStore = () => {
    // Open the store detail overlay for this specific store
    showOverlay("store-detail", { storeId: store.id });
  };

  return (
    <div className="relative h-full w-full snap-start bg-black overflow-hidden flex items-center justify-center">
      {/* Video Placeholder / AI Video Background */}
      {/* Fallback to CSS animation if no videoUrl is present, as per user instructions */}
      <div className="absolute inset-0 z-0">
        {item.videoUrl ? (
          <video
            src={item.videoUrl}
            autoPlay={isActive}
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-slate-900 to-black p-8 text-center relative overflow-hidden">
             {/* Simulated video content / placeholder */}
            <motion.div 
              animate={{ 
                scale: isActive ? [1, 1.05, 1] : 1,
                rotate: isActive ? [0, 2, -2, 0] : 0 
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="z-10"
            >
              <div className="w-48 h-48 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.1)] mb-8">
                 <Storefront size={64} weight="duotone" className="text-white/60" />
              </div>
            </motion.div>
            
            <p className="text-white/40 text-sm max-w-[80%] z-10 italic">
              AI Video Placeholder: "{item.prompt}"
            </p>

            {/* Decorative background elements */}
            <motion.div
              animate={{ 
                opacity: isActive ? [0.3, 0.6, 0.3] : 0.3,
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-0"
            />
          </div>
        )}
      </div>

      {/* Overlay UI (always visible) */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-end">
        {/* Right side Action Bar */}
        <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 pointer-events-auto">
          <button 
            onClick={() => setIsLiked(!isLiked)}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="bg-black/20 backdrop-blur-md p-3 rounded-full border border-white/10 group-active:scale-95 transition-transform">
              <Heart 
                size={28} 
                weight={isLiked ? "fill" : "regular"} 
                className={isLiked ? "text-red-500" : "text-white"} 
              />
            </div>
            <span className="text-white text-xs font-medium shadow-black drop-shadow-md">
              {item.likes + (isLiked ? 1 : 0)}
            </span>
          </button>

          <button className="flex flex-col items-center gap-1 group">
            <div className="bg-black/20 backdrop-blur-md p-3 rounded-full border border-white/10 group-active:scale-95 transition-transform">
              <ChatCircle size={28} className="text-white" />
            </div>
            <span className="text-white text-xs font-medium shadow-black drop-shadow-md">{item.comments}</span>
          </button>

          <button className="flex flex-col items-center gap-1 group">
            <div className="bg-black/20 backdrop-blur-md p-3 rounded-full border border-white/10 group-active:scale-95 transition-transform">
              <ShareFat size={28} weight="fill" className="text-white" />
            </div>
            <span className="text-white text-xs font-medium shadow-black drop-shadow-md">{item.shares}</span>
          </button>
        </div>

        {/* Bottom Info Bar */}
        <div className="w-[80%] p-4 pb-8 pl-6 flex flex-col gap-3 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 backdrop-blur-md p-2 rounded-lg">
              <Storefront size={20} className="text-white" />
            </div>
            <h3 className="text-white font-bold text-lg drop-shadow-md">{store.name}</h3>
          </div>
          
          <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <p className="text-white/90 text-sm font-medium mb-1 line-clamp-2">
              {store.dealInfo?.title}
            </p>
            <p className="text-green-400 font-bold text-sm uppercase tracking-wider">
              {store.dealInfo?.discount}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGoToStore}
            className="mt-2 flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/50 relative overflow-hidden group"
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
            
            <ShoppingBag size={20} weight="fill" />
            <span>Shop Now</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
