import { useMemo, useState, useRef, useEffect } from "react";
import { Heart, ChatCircle, ShareFat, Storefront, ShoppingBag, SpeakerHigh, SpeakerSlash, Flame, ArrowRight } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import type { FeedItem } from "@/data/feedData";
import { stores } from "@/data/mallData";
import { useUIStore } from "@/stores/uiStore";

interface TimelineVideoProps {
  item: FeedItem;
  isActive: boolean;
}

export function TimelineVideo({ item, isActive }: TimelineVideoProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [heartParticles, setHeartParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [showXp, setShowXp] = useState(false);
  const nextParticleId = useRef(0);

  const showOverlay = useUIStore((s) => s.showOverlay);
  const setTimelineOpen = useUIStore((s) => s.setTimelineOpen);
  const isMuted = useUIStore((s) => s.isMuted);
  const setMuted = useUIStore((s) => s.setMuted);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      video.play().catch((error) => {
        console.warn("Autoplay failed or was prevented:", error);
      });
    } else {
      video.pause();
    }
  }, [isActive]);

  const store = useMemo(() => {
    return stores.find((s) => s.id === item.storeId);
  }, [item.storeId]);

  if (!store) return null;

  const handleLike = () => {
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    if (nextLiked) {
      // Spawn heart particles bursting outwards
      const newParticles = Array.from({ length: 6 }).map(() => ({
        id: nextParticleId.current++,
        x: (Math.random() - 0.5) * 100,
        y: -40 - Math.random() * 60,
      }));
      setHeartParticles(newParticles);
      setTimeout(() => {
        setHeartParticles([]);
      }, 1000);
    }
  };

  const handleGoToStore = () => {
    setShowXp(true);
    // Let XP float up before navigating
    setTimeout(() => {
      setShowXp(false);
      setTimelineOpen(false);
      showOverlay("store-detail", { storeId: store.id });
    }, 600);
  };

  return (
    <div className="relative h-full w-full snap-start bg-black overflow-hidden flex items-center justify-center">
      {/* Video Placeholder / AI Video Background */}
      <div className="absolute inset-0 z-0">
        {item.videoUrl ? (
          <video
            ref={videoRef}
            src={item.videoUrl}
            loop
            muted={isMuted}
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
            onClick={() => setMuted(!isMuted)}
            className="flex flex-col items-center gap-1 group"
            aria-label={isMuted ? "Unmute video" : "Mute video"}
          >
            <div className="bg-black/20 backdrop-blur-md p-3 rounded-full border border-white/10 group-active:scale-95 transition-transform">
              {isMuted ? (
                <SpeakerSlash size={28} className="text-white" />
              ) : (
                <SpeakerHigh size={28} className="text-white" />
              )}
            </div>
            <span className="text-white text-xs font-medium shadow-black drop-shadow-md">
              {isMuted ? "Muted" : "Sound"}
            </span>
          </button>

          {/* Gamified Like Button with Particle Burst */}
          <div className="relative flex flex-col items-center">
            {/* Heart Particles */}
            <AnimatePresence>
              {heartParticles.map((p) => (
                <motion.div
                  key={p.id}
                  className="absolute z-50 pointer-events-none text-red-500"
                  initial={{ x: 0, y: 0, scale: 0.8, opacity: 1 }}
                  animate={{ x: p.x, y: p.y, scale: 1.4, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                >
                  <Heart size={20} weight="fill" />
                </motion.div>
              ))}
            </AnimatePresence>

            <button 
              onClick={handleLike}
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
          </div>

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
          
          <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 border border-white/10 relative">
            <p className="text-white/90 text-sm font-medium mb-1 line-clamp-2">
              {store.dealInfo?.title}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-green-400 font-bold text-sm uppercase tracking-wider">
                {store.dealInfo?.discount}
              </p>
              <span className="text-[10px] text-red-400 font-bold flex items-center gap-0.5 animate-pulse bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                <Flame size={10} weight="fill" className="text-red-500" />
                Ending soon
              </span>
            </div>
          </div>

          {/* Shop Now CTA with floating +XP feedback */}
          <div className="relative">
            <AnimatePresence>
              {showXp && (
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 top-[-30px] text-yellow-400 font-mono font-bold text-sm pointer-events-none drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]"
                  initial={{ y: 0, opacity: 1, scale: 0.8 }}
                  animate={{ y: -30, opacity: 0, scale: 1.2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  +10 XP
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoToStore}
              className="flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/50 relative overflow-hidden group"
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
              
              <ShoppingBag size={20} weight="fill" />
              <span>Shop Now</span>
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <ArrowRight size={16} weight="bold" />
              </motion.div>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
