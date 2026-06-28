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

  useEffect(() => {
    if (isClaimed) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isClaimed]);

  useEffect(() => {
    if (isClaimed) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isClaimed]);

  const percentage = (secondsLeft / maxTime) * 100;
  const strokeDashoffset = 113 - (113 * percentage) / 100;
  const isUrgent = secondsLeft < 120;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const confettiParticles = Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    x: Math.random() * 200 - 100,
    y: Math.random() * -150 - 50,
    scale: Math.random() * 0.6 + 0.4,
    color: ["#e6009e", "#14b8a6", "#ffe600", "#7c3aed", "#ffffff"][i % 5],
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
        {/* FRONT SIDE — white playful card */}
        <div className="absolute inset-0 backface-hidden w-full h-full rounded-2xl bg-white border-2 border-[#e6009e]/20 p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-[0_8px_24px_rgba(20,20,20,0.1)] group">
          {/* Holographic sweep light overlay on hover */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#e6009e]/8 to-transparent pointer-events-none group-hover:animate-shimmer" />

          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#e6009e] flex items-center gap-1">
                <Tag size={12} weight="fill" className="text-[#e6009e]" />
                Exclusive Deal
              </span>
              <h4 className="text-base font-bold text-[#141414] mt-0.5 line-clamp-1 font-display">
                {deal.title}
              </h4>
              <span className="text-[11px] text-[#8a8a8a]">{storeName}</span>
            </div>

            {/* Countdown Ring */}
            <div className="flex flex-col items-center relative">
              <svg className="w-11 h-11 transform -rotate-90">
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  className="stroke-[#141414]/8"
                  strokeWidth="3.5"
                  fill="transparent"
                />
                <motion.circle
                  cx="22"
                  cy="22"
                  r="18"
                  className={cn(
                    isUrgent ? "stroke-[#ef4444]" : "stroke-[#e6009e]"
                  )}
                  strokeWidth="3.5"
                  fill="transparent"
                  strokeDasharray="113"
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1, ease: "linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={cn(
                    "font-mono text-[9px] font-bold tracking-tight",
                    isUrgent ? "text-[#ef4444] animate-pulse" : "text-[#141414]"
                  )}
                >
                  {timeString}
                </span>
              </div>
            </div>
          </div>

          {/* Deal Promo Info */}
          <div className="flex justify-between items-center bg-[#ffe600]/30 rounded-xl p-3 border border-[#141414]/8 relative">
            <div className="flex flex-col">
              <span
                className={cn(
                  "font-mono text-2xl font-black tracking-tight font-display",
                  isUrgent ? "text-[#ef4444] animate-deal-pulse" : "text-[#e6009e]"
                )}
              >
                {deal.discount}
              </span>
              <span className="text-[10px] text-[#4b4b4b]">
                Limited member offer
              </span>
            </div>

            {/* Live viewers indicator */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-[#141414] bg-white px-2 py-0.5 rounded-full flex items-center gap-1 ring-1 ring-[#141414]/10">
                <Users size={12} weight="fill" className="text-[#14b8a6]" />
                <span className="font-mono font-bold text-[#14b8a6]">
                  {viewers}
                </span>{" "}
                viewing
              </span>
              {isUrgent && (
                <span className="text-[9px] text-[#ef4444] font-bold flex items-center gap-0.5">
                  <Flame size={10} weight="fill" className="text-[#ef4444] animate-bounce" />
                  High demand!
                </span>
              )}
            </div>
          </div>

          {/* Action CTA */}
          <div className="flex items-center justify-between gap-3 mt-1">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-[#8a8a8a]">
                Token cost
              </span>
              <span className="font-mono text-base font-bold text-[#e6009e]">
                {deal.tokenCost} Tokens
              </span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (canAfford) onClaim();
              }}
              disabled={!canAfford}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-full text-xs font-bold uppercase tracking-wider text-center relative overflow-hidden transition-all active:translate-y-[2px]",
                canAfford
                  ? "btn-magenta"
                  : "bg-[#141414]/5 text-[#8a8a8a] ring-1 ring-[#141414]/10 cursor-not-allowed"
              )}
            >
              {canAfford ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Sparkle size={14} weight="fill" className="text-white" />
                  Grab Deal
                </span>
              ) : (
                <span>Need {shortfall} tokens</span>
              )}
            </button>
          </div>
        </div>

        {/* BACK SIDE (CLAIMED STATE) — yellow celebratory */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full rounded-2xl bg-[#ffe600] border-2 border-[#141414]/10 p-5 flex flex-col items-center justify-center gap-3 shadow-[0_8px_24px_rgba(20,20,20,0.15)]">
          <div className="w-14 h-14 rounded-full bg-[#e6009e] flex items-center justify-center ring-4 ring-white">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: isClaimed ? 1 : 0 }}
              transition={{ type: "spring", damping: 10, stiffness: 100, delay: 0.2 }}
            >
              <CheckCircle size={36} weight="fill" className="text-white" />
            </motion.div>
          </div>
          <div className="text-center">
            <h4 className="text-lg font-bold text-[#141414] font-display">
              Deal Claimed!
            </h4>
            <p className="text-xs text-[#141414]/70 mt-1 max-w-[80%] mx-auto">
              Discount voucher added to your account wallet.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
