"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Tag, Users, CheckCircle, Sparkle, Flame } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

interface DealCardProps {
  deal: {
    title: string;
    discount: string;
    tokenCost: number;
    countdownSeconds?: number;
  };
  storeName: string;
  onClaim: () => void;
  isClaimed: boolean;
  canAfford: boolean;
  shortfall: number;
}

export function DealCard({
  deal,
  storeName,
  onClaim,
  isClaimed,
  canAfford,
  shortfall,
}: DealCardProps) {
  const [viewers, setViewers] = useState(Math.floor(Math.random() * 15) + 8);
  const [secondsLeft, setSecondsLeft] = useState(deal.countdownSeconds || 300);
  const [showConfetti, setShowConfetti] = useState(false);
  const maxTime = deal.countdownSeconds || 300;

  // Track viewers simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setViewers((prev) => {
        const change = Math.random() > 0.5 ? 1 : -1;
        const newVal = prev + change;
        return newVal > 3 ? newVal : 4;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Timer simulation
  useEffect(() => {
    if (isClaimed) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isClaimed]);

  // Trigger confetti burst on claimed
  useEffect(() => {
    if (isClaimed) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isClaimed]);

  const percentage = (secondsLeft / maxTime) * 100;
  const strokeDashoffset = 113 - (113 * percentage) / 100;
  const isUrgent = secondsLeft < 120; // less than 2 minutes

  // Format time (m:ss)
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // Confetti particles generator
  const confettiParticles = Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    x: Math.random() * 200 - 100,
    y: Math.random() * -150 - 50,
    scale: Math.random() * 0.6 + 0.4,
    color: ["#d4af37", "#9d7fdb", "#4fd1c5", "#e879a1", "#ffffff"][i % 5],
  }));

  return (
    <div className="relative w-full h-[220px] perspective-1000 select-none">
      {/* Confetti Explosion Layer */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
          {confettiParticles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute w-2 h-2 rounded-full"
              style={{ backgroundColor: p.color }}
              initial={{ x: 0, y: 0, opacity: 1, scale: p.scale }}
              animate={{
                x: p.x,
                y: p.y,
                opacity: 0,
                scale: 0,
              }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          ))}
        </div>
      )}

      {/* 3D Flippable Card */}
      <motion.div
        className="w-full h-full duration-700 transform-style-3d relative"
        animate={{ rotateY: isClaimed ? 180 : 0 }}
      >
        {/* FRONT SIDE */}
        <div className="absolute inset-0 backface-hidden w-full h-full rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/15 p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-xl backdrop-blur-md group">
          {/* Holographic sweep light overlay on hover */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none group-hover:animate-shimmer" />

          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-1">
                <Tag size={12} className="text-yellow-500" />
                Exclusive Deal
              </span>
              <h4 className="text-base font-bold text-white mt-0.5 line-clamp-1">{deal.title}</h4>
              <span className="text-[11px] text-white/50">{storeName}</span>
            </div>

            {/* Countdown Ring */}
            <div className="flex flex-col items-center relative">
              <svg className="w-11 h-11 transform -rotate-90">
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  className="stroke-white/10"
                  strokeWidth="3.5"
                  fill="transparent"
                />
                <motion.circle
                  cx="22"
                  cy="22"
                  r="18"
                  className={cn(
                    isUrgent ? "stroke-red-500" : "stroke-[#d4af37]"
                  )}
                  strokeWidth="3.5"
                  fill="transparent"
                  strokeDasharray="113"
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1, ease: "linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn(
                  "font-mono text-[9px] font-bold tracking-tight",
                  isUrgent ? "text-red-400 animate-pulse" : "text-white/80"
                )}>
                  {timeString}
                </span>
              </div>
            </div>
          </div>

          {/* Deal Promo Info & Spark */}
          <div className="flex justify-between items-center bg-black/40 rounded-xl p-3 border border-white/5 relative">
            <div className="flex flex-col">
              <span className={cn(
                "font-mono text-2xl font-black tracking-tight",
                isUrgent ? "text-red-500 animate-deal-pulse" : "text-gradient-gold"
              )}>
                {deal.discount}
              </span>
              <span className="text-[10px] text-white/60">Limited member offer</span>
            </div>

            {/* Micro-sparkles & Live viewers indicator */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded-full flex items-center gap-1 ring-1 ring-white/10">
                <Users size={12} className="text-[#4fd1c5]" />
                <span className="font-mono font-bold text-[#4fd1c5]">{viewers}</span> viewing
              </span>
              {isUrgent && (
                <span className="text-[9px] text-red-400 font-bold flex items-center gap-0.5">
                  <Flame size={10} weight="fill" className="text-red-500 animate-bounce" />
                  High demand!
                </span>
              )}
            </div>
          </div>

          {/* Action CTA */}
          <div className="flex items-center justify-between gap-3 mt-1">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-white/40">Token cost</span>
              <span className="font-mono text-base font-bold text-yellow-500">{deal.tokenCost} Tokens</span>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (canAfford) onClaim();
              }}
              disabled={!canAfford}
              className={cn(
                "flex-1 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-center relative overflow-hidden transition-all active:scale-[0.97]",
                canAfford
                  ? "bg-gradient-to-r from-yellow-500 via-[#d4af37] to-yellow-600 text-black shadow-lg shadow-yellow-500/20 animate-pulse-subtle"
                  : "bg-white/5 text-[#71717a] ring-1 ring-white/10 cursor-not-allowed"
              )}
            >
              {canAfford ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Sparkle size={14} weight="fill" className="animate-spin-slow" />
                  Grab Deal
                </span>
              ) : (
                <span>Need {shortfall} tokens</span>
              )}
            </button>
          </div>
        </div>

        {/* BACK SIDE (CLAIMED STATE) */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full rounded-2xl bg-gradient-to-br from-green-950/40 to-black/90 border border-green-500/30 p-5 flex flex-col items-center justify-center gap-3 shadow-xl backdrop-blur-md">
          <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/40">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: isClaimed ? 1 : 0 }}
              transition={{ type: "spring", damping: 10, stiffness: 100, delay: 0.2 }}
            >
              <CheckCircle size={36} weight="fill" className="text-green-400" />
            </motion.div>
          </div>
          <div className="text-center">
            <h4 className="text-lg font-bold text-green-400">Deal Claimed!</h4>
            <p className="text-xs text-white/60 mt-1 max-w-[80%] mx-auto">
              Discount voucher added to your account wallet.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
