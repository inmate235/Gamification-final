"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { SpinResult } from "@/engine/nearMissAlgorithm";

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

export function BrainRotCelebration({ result }: { result: SpinResult | null }) {
  if (!result || result.segment.type === "nothing") return null;

  const { type, tokens } = result.segment;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden rounded-[2rem]">
      <AnimatePresence>
        {type === "tokens" && tokens === 10 && <JackpotAnimation key="jackpot" />}
        {type === "tokens" && tokens === 5 && <HyperHypeAnimation key="hyper" />}
        {type === "tokens" && tokens === 3 && <GlitchAnimation key="glitch" />}
        {type === "tokens" && tokens === 1 && <MicroDoseAnimation key="micro" />}
        {type === "map-reveal" && <MindExpansionAnimation key="mind" />}
        {type === "flash-sale" && <FomoPanicAnimation key="fomo" />}
      </AnimatePresence>
    </div>
  );
}

/* 1. 10 Tokens (Sensory Nuke) */
function JackpotAnimation() {
  const coins = Array.from({ length: 60 });
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      {/* Rapid hue shifting background */}
      <motion.div
        animate={{
          backgroundColor: [
            "rgba(255,0,0,0.6)",
            "rgba(0,255,0,0.6)",
            "rgba(0,0,255,0.6)",
            "rgba(255,255,0,0.6)",
            "rgba(255,0,255,0.6)",
            "rgba(0,255,255,0.6)",
          ],
        }}
        transition={{ duration: 0.15, repeat: Infinity, repeatType: "mirror" }}
        className="absolute inset-0 mix-blend-overlay"
      />

      {/* Screen Shake Container */}
      <motion.div
        animate={{
          x: [0, -15, 15, -15, 15, -10, 10, 0],
          y: [0, 15, -15, 15, -15, 10, -10, 0],
        }}
        transition={{ duration: 0.25, repeat: Infinity }}
        className="relative z-10 flex flex-col items-center"
      >
        <motion.h1
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.3, 1], rotate: [0, -8, 8, 0] }}
          transition={{ duration: 0.35, repeat: Infinity }}
          className="text-5xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-red-500 to-yellow-300 uppercase drop-shadow-[0_0_30px_rgba(255,0,0,1)] text-center leading-tight"
          style={{ WebkitTextStroke: "2px black" }}
        >
          JACKPOT!<br/>UNREAL!<br/>🤯🤑💰
        </motion.h1>
      </motion.div>

      {/* Coin Rain */}
      {coins.map((_, i) => (
        <motion.div
          key={i}
          initial={{
            y: -200,
            x: Math.random() * 400 - 200,
            rotate: 0,
            scale: Math.random() * 1.5 + 0.8,
          }}
          animate={{
            y: 600,
            rotate: 360 * 4,
          }}
          transition={{
            duration: Math.random() * 1.2 + 0.6,
            repeat: Infinity,
            delay: Math.random() * 1,
            ease: "linear",
          }}
          className="absolute top-0 text-3xl drop-shadow-2xl"
        >
          💰
        </motion.div>
      ))}
    </motion.div>
  );
}

/* 2. 5 Tokens (Hyper-Hype) */
function HyperHypeAnimation() {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.5, opacity: 0 }}
      transition={{ duration: 0.5, type: "spring", bounce: 0.6 }}
      className="absolute inset-0 flex items-center justify-center bg-orange-500/30 backdrop-blur-md"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="absolute w-[150%] h-[150%] rounded-full border-[60px] border-dashed border-yellow-400/40"
      />
      
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 0.35, repeat: Infinity }}
        className="relative z-10 text-center"
      >
        <h1 className="text-4xl font-black text-white drop-shadow-[0_8px_16px_rgba(255,100,0,0.9)] uppercase tracking-tighter" style={{ WebkitTextStroke: "1px #ff4500" }}>
          POGGERS<br/>5 TOKENS!
        </h1>
        <div className="flex justify-center gap-3 mt-3 text-4xl">
          <motion.span animate={{ y: [0, -15, 0] }} transition={{ duration: 0.3, repeat: Infinity }}>🔥</motion.span>
          <motion.span animate={{ y: [0, -15, 0] }} transition={{ duration: 0.3, repeat: Infinity, delay: 0.1 }}>🚀</motion.span>
          <motion.span animate={{ y: [0, -15, 0] }} transition={{ duration: 0.3, repeat: Infinity, delay: 0.2 }}>🔥</motion.span>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* 3. 3 Tokens (Glitch Validation) */
function GlitchAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center mix-blend-screen bg-black/60 backdrop-blur-sm">
      <motion.div
        animate={{
          x: [0, -8, 8, -4, 4, 0],
          y: [0, 4, -4, 8, -8, 0],
          skewX: [0, 15, -15, 0],
          filter: [
            "hue-rotate(0deg) contrast(1)",
            "hue-rotate(90deg) contrast(2)",
            "hue-rotate(-90deg) contrast(3)",
            "hue-rotate(0deg) contrast(1)",
          ],
        }}
        transition={{ duration: 0.18, repeat: Infinity, repeatType: "mirror" }}
      >
        <h1 className="text-4xl font-black text-cyan-400 drop-shadow-[0_0_15px_rgba(0,255,255,0.9)] tracking-widest uppercase">
          RARE PULL! +3
        </h1>
        <h1 className="text-4xl font-black text-magenta-500 drop-shadow-[0_0_15px_rgba(255,0,255,0.9)] tracking-widest uppercase absolute top-[2px] left-[2px] opacity-60">
          RARE PULL! +3
        </h1>
      </motion.div>
    </div>
  );
}

/* 4. 1 Token (Micro-Dose) */
function MicroDoseAnimation() {
  return (
    <motion.div
      initial={{ scale: 0, y: 30, opacity: 0 }}
      animate={{ scale: [1.3, 0.9, 1], y: -30, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease: PREMIUM_EASE }}
      className="absolute flex flex-col items-center justify-center top-[25%]"
    >
      <h1 className="text-4xl font-extrabold text-green-400 drop-shadow-lg" style={{ WebkitTextStroke: "1px #004400" }}>
        STONKS 📈 +1
      </h1>
      <motion.div className="flex gap-1 mt-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.4, 0] }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="text-2xl"
          >
            ⭐
          </motion.span>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* 5. Map Reveal (Mind Expansion) */
function MindExpansionAnimation() {
  return (
    <motion.div
      initial={{ scale: 0.1, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute inset-0 flex items-center justify-center backdrop-blur-md bg-purple-900/40"
    >
      {/* Fisheye lens effect / bulging */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], filter: ["blur(0px)", "blur(1px)", "blur(0px)"] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className="relative z-10 text-center"
      >
        <h1 className="text-4xl font-black text-pink-300 uppercase drop-shadow-[0_0_30px_rgba(255,100,255,1)] leading-tight" style={{ WebkitTextStroke: "1px #400040" }}>
          200 IQ PLAY<br/>ZONE UNLOCKED
        </h1>
        <div className="flex justify-center gap-4 mt-4 text-5xl">
          <motion.span animate={{ rotate: [0, 20, -20, 0] }} transition={{ duration: 0.4, repeat: Infinity }}>🧠</motion.span>
          <motion.span animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 0.4, repeat: Infinity }}>✨</motion.span>
          <motion.span animate={{ rotate: [0, -20, 20, 0] }} transition={{ duration: 0.4, repeat: Infinity }}>👁️</motion.span>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* 6. Flash Sale (Fomo Panic) */
function FomoPanicAnimation() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex items-center justify-center"
    >
      {/* Flashing Warning Sirens */}
      <motion.div
        animate={{ opacity: [0.2, 0.7, 0.2] }}
        transition={{ duration: 0.25, repeat: Infinity }}
        className="absolute inset-0 bg-red-600 mix-blend-multiply"
      />
      <motion.div
        animate={{ opacity: [0.1, 0.5, 0.1] }}
        transition={{ duration: 0.25, repeat: Infinity, delay: 0.12 }}
        className="absolute inset-0 bg-yellow-400 mix-blend-overlay"
      />
      
      <motion.div
        animate={{ x: [-10, 10, -10], y: [-6, 6, -6] }}
        transition={{ duration: 0.1, repeat: Infinity }}
        className="relative z-10 text-center bg-black/90 p-6 rounded-[2rem] border-4 border-red-600"
      >
        <h1 className="text-4xl font-black text-red-500 tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(255,0,0,1)] animate-pulse">
          🚨 INSANE DEAL 🚨<br/>UNLOCK
        </h1>
        <p className="text-white mt-3 text-xl font-mono uppercase tracking-widest animate-bounce">
          ACT FAST! ACT NOW!
        </p>
      </motion.div>
    </motion.div>
  );
}
