"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Coin, Fire, Rocket, Sparkle, Brain, Eye, ChartLineUp, Alarm } from "@phosphor-icons/react/dist/ssr";
import type { SpinResult } from "@/engine/nearMissAlgorithm";

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/**
 * YouTube Embed Helper for brain rot background loops.
 * Uses standard embed params to autoplay, UNMUTE (mute=0), and loop indefinitely.
 */
function YouTubeLoop({ videoId }: { videoId: string }) {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none scale-110">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&autoplay=1`}
        className="w-full h-full pointer-events-none border-0"
        allow="autoplay; encrypted-media"
        title="Background Loop"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      {/* Invisible overlay to block mouse interactions */}
      <div className="absolute inset-0 bg-transparent z-10" />
    </div>
  );
}

interface BrainRotCelebrationProps {
  result: SpinResult | null;
  onClose: () => void;
}

export function BrainRotCelebration({ result, onClose }: BrainRotCelebrationProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!result || result.segment.type === "nothing") return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [result]);

  if (!result || result.segment.type === "nothing") return null;

  const { type, tokens } = result.segment;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {type === "tokens" && tokens === 10 && <JackpotAnimation key="jackpot" />}
        {type === "tokens" && tokens === 5 && <HyperHypeAnimation key="hyper" />}
        {type === "tokens" && tokens === 3 && <GlitchAnimation key="glitch" />}
        {type === "tokens" && tokens === 1 && <MicroDoseAnimation key="micro" />}
        {type === "map-reveal" && <MindExpansionAnimation key="mind" />}
        {type === "flash-sale" && <FomoPanicAnimation key="fomo" />}
      </AnimatePresence>

      {/* Skip Button (appearing after 5s) */}
      <div className="absolute bottom-6 right-6 z-50 pointer-events-auto">
        <AnimatePresence>
          {countdown > 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-black/80 border border-white/20 px-5 py-3 rounded-xl font-mono text-xs uppercase tracking-widest text-white shadow-2xl"
            >
              Skip reward in <span className="font-bold text-yellow-400">{countdown}s</span>
            </motion.div>
          ) : (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              onClick={onClose}
              className="relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] border-2 border-white hover:scale-105 active:scale-95 transition-all duration-200"
            >
              {/* Inner glowing marquee-like pulse */}
              <motion.span
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                Skip &middot; Return to Wheel
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* 1. 10 Tokens (Sensory Nuke + User Meme Video 1) */
function JackpotAnimation() {
  const coins = Array.from({ length: 120 });
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col bg-black/40 backdrop-blur-sm"
    >
      {/* Top half: User's first meme video (scaled up on larger screens) */}
      <div className="relative w-full h-[50%] md:h-[55%] border-b-8 border-yellow-400">
        <YouTubeLoop videoId="_KdmY0Fl1K4" />
      </div>

      {/* Bottom half: Flashing sensory jackpot overlay */}
      <div className="relative w-full h-[50%] md:h-[45%] flex items-center justify-center">
        {/* Rapid hue shifting background */}
        <motion.div
          animate={{
            backgroundColor: [
              "rgba(255,0,0,0.7)",
              "rgba(0,255,0,0.7)",
              "rgba(0,0,255,0.7)",
              "rgba(255,255,0,0.7)",
              "rgba(255,0,255,0.7)",
              "rgba(0,255,255,0.7)",
            ],
          }}
          transition={{ duration: 0.12, repeat: Infinity, repeatType: "mirror" }}
          className="absolute inset-0 mix-blend-overlay"
        />

        {/* Screen Shake Container */}
        <motion.div
          animate={{
            x: [0, -25, 25, -25, 25, -15, 15, 0],
            y: [0, 25, -25, 25, -25, 15, -15, 0],
          }}
          transition={{ duration: 0.2, repeat: Infinity }}
          className="relative z-10 flex flex-col items-center"
        >
          <motion.h1
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.4, 1], rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.3, repeat: Infinity }}
            className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-red-500 to-yellow-300 uppercase drop-shadow-[0_0_40px_rgba(255,0,0,1)] text-center leading-none"
            style={{ WebkitTextStroke: "3px black" }}
          >
            JACKPOT!<br/>UNREAL!
          </motion.h1>
        </motion.div>

        {/* Coin Rain */}
        {coins.map((_, i) => (
          <motion.div
            key={i}
            initial={{
              y: -100,
              x: Math.random() * 800 - 400,
              rotate: 0,
              scale: Math.random() * 2 + 1,
            }}
            animate={{
              y: 800,
              rotate: 360 * 5,
            }}
            transition={{
              duration: Math.random() * 1.5 + 0.8,
              repeat: Infinity,
              delay: Math.random() * 1.5,
              ease: "linear",
            }}
            className="absolute top-0 z-20"
          >
            <Coin size={36} weight="fill" className="text-yellow-400 drop-shadow-2xl" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* 2. 5 Tokens (Hyper-Hype + User Meme Video 2) */
function HyperHypeAnimation() {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.5, opacity: 0 }}
      transition={{ duration: 0.5, type: "spring", bounce: 0.6 }}
      className="absolute inset-0 flex flex-col bg-orange-500/35 backdrop-blur-md"
    >
      {/* Top half: User's second meme video (o1nbk0UWlO8) */}
      <div className="relative w-full h-[50%] md:h-[55%] border-b-8 border-orange-500">
        <YouTubeLoop videoId="o1nbk0UWlO8" />
      </div>

      <div className="relative w-full h-[50%] md:h-[45%] flex items-center justify-center bg-orange-600/50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          className="absolute w-[200vw] h-[200vw] rounded-full border-[100px] border-dashed border-yellow-400/40"
        />
        
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.3, repeat: Infinity }}
          className="relative z-10 text-center"
        >
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white drop-shadow-[0_12px_24px_rgba(255,100,0,0.95)] uppercase tracking-tighter leading-none" style={{ WebkitTextStroke: "2px #ff4500" }}>
            POGGERS<br/>5 TOKENS!
          </h1>
          <div className="flex justify-center gap-6 mt-4">
            <motion.span animate={{ y: [0, -20, 0] }} transition={{ duration: 0.25, repeat: Infinity }}>
              <Fire size={40} weight="fill" className="text-orange-400 drop-shadow-[0_0_12px_rgba(255,100,0,0.8)]" />
            </motion.span>
            <motion.span animate={{ y: [0, -20, 0] }} transition={{ duration: 0.25, repeat: Infinity, delay: 0.08 }}>
              <Rocket size={40} weight="fill" className="text-yellow-300 drop-shadow-[0_0_12px_rgba(255,200,0,0.8)]" />
            </motion.span>
            <motion.span animate={{ y: [0, -25, 0] }} transition={{ duration: 0.25, repeat: Infinity, delay: 0.16 }}>
              <Fire size={40} weight="fill" className="text-orange-400 drop-shadow-[0_0_12px_rgba(255,100,0,0.8)]" />
            </motion.span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* 3. 3 Tokens (Glitch Validation + User Meme Video 3) */
function GlitchAnimation() {
  return (
    <div className="absolute inset-0 flex flex-col bg-black/40 backdrop-blur-sm">
      {/* Top half: User's third meme video (xncLmQYVNG4 - Fruity Slide) */}
      <div className="relative w-full h-[50%] md:h-[55%] border-b-8 border-cyan-400">
        <YouTubeLoop videoId="xncLmQYVNG4" />
      </div>

      <div className="relative w-full h-[50%] md:h-[45%] flex items-center justify-center mix-blend-screen bg-cyan-900/50">
        <motion.div
          animate={{
            x: [0, -12, 12, -6, 6, 0],
            y: [0, 6, -6, 12, -12, 0],
            skewX: [0, 20, -20, 0],
            filter: [
              "hue-rotate(0deg) contrast(1)",
              "hue-rotate(90deg) contrast(2)",
              "hue-rotate(-90deg) contrast(3)",
              "hue-rotate(0deg) contrast(1)",
            ],
          }}
          transition={{ duration: 0.15, repeat: Infinity, repeatType: "mirror" }}
        >
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-cyan-400 drop-shadow-[0_0_25px_rgba(0,255,255,0.95)] tracking-widest uppercase text-center">
            RARE PULL! +3
          </h1>
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-magenta-500 drop-shadow-[0_0_25px_rgba(255,0,255,0.95)] tracking-widest uppercase absolute top-[3px] left-[3px] opacity-60 text-center w-full">
            RARE PULL! +3
          </h1>
        </motion.div>
      </div>
    </div>
  );
}

/* 4. 1 Token (Micro-Dose + User Meme Video 2 Reused) */
function MicroDoseAnimation() {
  return (
    <motion.div
      initial={{ scale: 0, y: 50, opacity: 0 }}
      animate={{ scale: [1.4, 0.85, 1], y: -50, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease: PREMIUM_EASE }}
      className="absolute flex flex-col items-center justify-center top-[20%]"
    >
      <div className="relative w-72 h-40 md:w-96 md:h-56 rounded-2xl overflow-hidden border-4 border-green-400 shadow-[0_0_30px_rgba(74,222,128,0.5)] mb-6">
        <YouTubeLoop videoId="o1nbk0UWlO8" />
      </div>

      <h1 className="flex items-center justify-center gap-3 text-5xl sm:text-7xl font-black text-green-400 drop-shadow-2xl uppercase tracking-tighter" style={{ WebkitTextStroke: "2px #004400" }}>
        STONKS
        <ChartLineUp size={48} weight="fill" className="text-green-400 drop-shadow-2xl" />
        +1
      </h1>
      <motion.div className="flex gap-2 mt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.6, 0] }}
            transition={{ duration: 0.5, delay: i * 0.04 }}
          >
            <Sparkle size={24} weight="fill" className="text-yellow-300 drop-shadow-[0_0_8px_rgba(255,200,0,0.8)]" />
          </motion.span>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* 5. Map Reveal (Mind Expansion + User Meme Video 4) */
function MindExpansionAnimation() {
  return (
    <motion.div
      initial={{ scale: 0.1, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute inset-0 flex flex-col bg-purple-900/40"
    >
      {/* Top half: User's fourth meme video (U-4yg_ahVQo - Ballerina Bedtime) */}
      <div className="relative w-full h-[50%] md:h-[55%] border-b-8 border-pink-500">
        <YouTubeLoop videoId="U-4yg_ahVQo" />
      </div>

      <div className="relative w-full h-[50%] md:h-[45%] flex items-center justify-center bg-purple-950/50">
        {/* Fisheye lens effect / bulging */}
        <motion.div
          animate={{ scale: [1, 1.25, 1], filter: ["blur(0px)", "blur(2px)", "blur(0px)"] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="relative z-10 text-center"
        >
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-pink-300 uppercase drop-shadow-[0_0_40px_rgba(255,100,255,1)] leading-none" style={{ WebkitTextStroke: "2px #400040" }}>
            200 IQ PLAY<br/>ZONE UNLOCKED
          </h1>
          <div className="flex justify-center gap-6 mt-6">
            <motion.span animate={{ rotate: [0, 25, -25, 0] }} transition={{ duration: 0.35, repeat: Infinity }}>
              <Brain size={48} weight="fill" className="text-pink-300 drop-shadow-[0_0_16px_rgba(255,100,255,0.8)]" />
            </motion.span>
            <motion.span animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.35, repeat: Infinity }}>
              <Sparkle size={48} weight="fill" className="text-yellow-300 drop-shadow-[0_0_16px_rgba(255,200,0,0.8)]" />
            </motion.span>
            <motion.span animate={{ rotate: [0, -25, 25, 0] }} transition={{ duration: 0.35, repeat: Infinity }}>
              <Eye size={48} weight="fill" className="text-pink-300 drop-shadow-[0_0_16px_rgba(255,100,255,0.8)]" />
            </motion.span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* 6. Flash Sale (Fomo Panic + User Meme Video 5) */
function FomoPanicAnimation() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex flex-col"
    >
      {/* Top half: User's fifth meme video (Vbh3pGApo_M - Brainrots playing challenge) */}
      <div className="relative w-full h-[50%] md:h-[55%] border-b-8 border-red-600">
        <YouTubeLoop videoId="Vbh3pGApo_M" />
      </div>

      <div className="relative w-full h-[50%] md:h-[45%] flex items-center justify-center">
        {/* Flashing Warning Sirens */}
        <motion.div
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 0.2, repeat: Infinity }}
          className="absolute inset-0 bg-red-600 mix-blend-multiply"
        />
        <motion.div
          animate={{ opacity: [0.15, 0.6, 0.15] }}
          transition={{ duration: 0.2, repeat: Infinity, delay: 0.1 }}
          className="absolute inset-0 bg-yellow-400 mix-blend-overlay"
        />
        
        <motion.div
          animate={{ x: [-12, 12, -12], y: [-8, 8, -8] }}
          transition={{ duration: 0.08, repeat: Infinity }}
          className="relative z-10 text-center bg-black/90 p-8 rounded-[2.5rem] border-8 border-red-600"
        >
          <h1 className="flex items-center justify-center gap-4 text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-red-500 tracking-tighter uppercase drop-shadow-[0_0_20px_rgba(255,0,0,1)] animate-pulse leading-none">
            <Alarm size={56} weight="fill" className="text-red-500 drop-shadow-[0_0_20px_rgba(255,0,0,1)]" />
            INSANE DEAL
            <Alarm size={56} weight="fill" className="text-red-500 drop-shadow-[0_0_20px_rgba(255,0,0,1)]" />
            <br/>UNLOCK
          </h1>
          <p className="text-white mt-4 text-xl sm:text-3xl font-mono uppercase tracking-widest animate-bounce">
            ACT FAST! ACT NOW!
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
