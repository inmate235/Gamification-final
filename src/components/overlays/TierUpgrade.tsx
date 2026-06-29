"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Crown,
  Coins,
  Timer,
  Warning,
  Fire,
  CheckCircle,
  Lightning,
  TrendDown,
} from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import { TIER_VISUALS } from "@/data/tierData";
import { cn } from "@/lib/utils";
import type { Tier, TierUpgradeData } from "@/types";

/**
 * TierUpgrade — the full-screen celebration played when the player is
 * promoted to a new tier (VAL-TIER-006..008, VAL-TIER-023, VAL-TIER-027).
 *
 * Redesigned to the light / magenta / Fredoka design system with gamified
 * dark patterns: urgency countdown, fake scarcity, social proof ticker,
 * loss aversion, multiple funding types (tokens / monthly / annual), and
 * confirmshaming opt-out.
 *
 * Choreography:
 *   1. Light backdrop with tier-colored wash (NOT dark)
 *   2. Confetti burst in tier color
 *   3. Tier-colored banner with sticker heading
 *   4. Tier badge scales in with spring
 *   5. Staggered perk reveal
 *   6. Dark pattern: urgency countdown + social proof + scarcity
 *   7. Funding type selector (tokens / monthly / annual)
 *   8. CTA + confirmshaming secondary
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Dark pattern data — tier pricing & social proof
   ========================================================================== */

interface TierFundOption {
  id: "tokens" | "monthly" | "annual";
  label: string;
  price: string;
  unit: string;
  description: string;
  badge?: string;
  highlighted?: boolean;
}

const FUND_OPTIONS: TierFundOption[] = [
  {
    id: "tokens",
    label: "Token Lock",
    price: "50",
    unit: "tokens",
    description: "Lock in for 30 days",
  },
  {
    id: "monthly",
    label: "Monthly",
    price: "$9.99",
    unit: "/mo",
    description: "Auto-renews monthly",
  },
  {
    id: "annual",
    label: "Annual",
    price: "$89.99",
    unit: "/yr",
    description: "Save 25% vs monthly",
    badge: "Best Value",
    highlighted: true,
  },
];

/* Fake social proof — "members who upgraded this week" */
const FAKE_UPGRADE_COUNT: Record<Tier, number> = {
  bronze: 0,
  silver: 847,
  gold: 312,
  neodymium: 47,
};

const FAKE_SPOTS_LEFT: Record<Tier, number> = {
  bronze: 0,
  silver: 7,
  gold: 3,
  neodymium: 1,
};

/* ============================================================================
   Component
   ========================================================================== */

export function TierUpgrade() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const overlayData = useUIStore((s) => s.overlayData) as TierUpgradeData | null;
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  const tier = usePlayerStore((s) => s.tier);
  const tokens = usePlayerStore((s) => s.tokens);

  const isOpen = activeOverlay === "tier-upgrade" && overlayData !== null;
  const newTier: Tier = overlayData?.newTier ?? tier;
  const visual = TIER_VISUALS[newTier];

  /* --- Funding type selector (dark pattern: defaults to annual) --- */
  const [selectedFund, setSelectedFund] = useState<TierFundOption["id"]>("annual");

  /* --- Celebration bonus countdown (dark pattern: urgency) --- */
  const [bonusCountdown, setBonusCountdown] = useState(14 * 60 + 59);
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setBonusCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  /* --- Esc to dismiss --- */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, hideOverlay]);

  const mm = Math.floor(bonusCountdown / 60);
  const ss = bonusCountdown % 60;
  const timeStr = `${mm}:${ss.toString().padStart(2, "0")}`;
  const isUrgent = bonusCountdown <= 60;

  const upgradeCount = FAKE_UPGRADE_COUNT[newTier];
  const spotsLeft = FAKE_SPOTS_LEFT[newTier];

  const currentFund = FUND_OPTIONS.find((f) => f.id === selectedFund)!;
  const canAffordTokens = selectedFund === "tokens" ? tokens >= 50 : true;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: PREMIUM_EASE }}
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center px-0 sm:px-4 pb-0 sm:py-12"
          onClick={hideOverlay}
          data-testid="tier-upgrade-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Tier upgrade to ${visual.label}`}
        >
          {/* Light backdrop with tier-colored wash */}
          <div
            className="absolute inset-0 backdrop-blur-md"
            style={{
              background: `radial-gradient(ellipse at center, ${visual.color}1a 0%, rgba(255,255,255,0.6) 50%, rgba(20,20,20,0.15) 100%)`,
            }}
          />

          {/* Confetti burst in tier color */}
          <TierConfettiBurst color={visual.color} />

          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="relative w-full max-w-md sm:rounded-[2.5rem] rounded-t-[2.5rem] overflow-hidden bg-white ring-2 ring-[#141414]/8 shadow-[0_24px_64px_rgba(20,20,20,0.22)]"
            onClick={(e) => e.stopPropagation()}
          >
              {/* ── Tier-colored banner (illustration carries all heading text) ── */}
              <div
                className="relative px-3 pt-3 pb-2 overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${visual.color} 0%, ${visual.color}cc 60%, ${visual.color}99 100%)`,
                }}
              >
                {/* Decorative scribble dots */}
                <DecorativeDots />

                {/* Tier hero image — scales in with spring */}
                <motion.div
                  initial={{ scale: 0, opacity: 0, rotate: -12 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.2 }}
                  className="relative z-10 mx-auto w-full overflow-hidden rounded-[2rem]"
                  data-testid="tier-upgrade-badge"
                >
                  {/* Pulsing ring behind image */}
                  <motion.div
                    animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-white/20 blur-md"
                  />
                  <img
                    src={visual.imageUrl}
                    alt={`${visual.label} tier badge`}
                    loading="eager"
                    className="relative block h-auto w-full drop-shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
                  />
                </motion.div>
              </div>

              {/* ── White content section ── */}
              <div className="px-6 py-5 space-y-3.5">
                {/* ── Dark pattern: urgency countdown ── */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: PREMIUM_EASE, delay: 0.72 }}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-2.5 ring-1 transition-all",
                    isUrgent
                      ? "bg-[#ef4444]/8 ring-[#ef4444]/25"
                      : "bg-[#ffe600]/15 ring-[#ffe600]/30"
                  )}
                >
                  <motion.div
                    animate={isUrgent ? { scale: [1, 1.15, 1] } : { rotate: [0, 360] }}
                    transition={
                      isUrgent
                        ? { duration: 1, repeat: Infinity }
                        : { duration: 8, repeat: Infinity, ease: "linear" }
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isUrgent ? "#ef4444" : "#e6009e",
                    }}
                  >
                    <Timer size={16} weight="fill" className="text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-[#141414]">
                      Celebration bonus expires in
                    </p>
                    <p
                      className={cn(
                        "font-mono text-lg font-bold tabular-nums",
                        isUrgent && "animate-countdown-urgency"
                      )}
                      style={{ color: isUrgent ? "#ef4444" : "#e6009e" }}
                    >
                      {timeStr}
                    </p>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#8a8a8a] max-w-[12ch] text-right leading-tight">
                    Lock in to keep your bonus
                  </span>
                </motion.div>

                {/* ── Dark pattern: social proof + scarcity ── */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: PREMIUM_EASE, delay: 0.82 }}
                  className="flex items-center gap-3 rounded-2xl bg-[#f4f4f5] px-4 py-2.5 ring-1 ring-[#141414]/5"
                >
                  <motion.div
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e6009e]/12"
                  >
                    <Fire size={16} weight="fill" className="text-[#e6009e]" />
                  </motion.div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-[#141414]">
                      <span className="font-mono tabular-nums text-[#e6009e]">
                        {upgradeCount.toLocaleString()}
                      </span>{" "}
                      members upgraded this week
                    </p>
                    <p className="text-[10px] text-[#8a8a8a] mt-0.5 flex items-center gap-1">
                      <Warning size={10} weight="fill" className="text-[#ef4444]" />
                      Only{" "}
                      <span className="font-bold text-[#ef4444] font-mono tabular-nums">
                        {spotsLeft}
                      </span>{" "}
                      founding spots left for {visual.label}
                    </p>
                  </div>
                </motion.div>

                {/* ── Dark pattern: loss aversion ── */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: PREMIUM_EASE, delay: 0.9 }}
                  className="flex items-center gap-3 rounded-2xl bg-[#ef4444]/6 px-4 py-2.5 ring-1 ring-[#ef4444]/15"
                >
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ef4444]/12"
                  >
                    <TrendDown size={16} weight="bold" className="text-[#ef4444]" />
                  </motion.div>
                  <p className="text-[11px] leading-relaxed text-[#4b4b4b]">
                    Without locking in, your{" "}
                    <span className="font-bold" style={{ color: visual.color }}>
                      {visual.label}
                    </span>{" "}
                    perks may expire after 30 days. Don&apos;t lose what you earned.
                  </p>
                </motion.div>

                {/* ── Funding type selector (types of funds) ── */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: PREMIUM_EASE, delay: 0.98 }}
                >
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a8a8a]">
                    Choose your plan to lock in
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {FUND_OPTIONS.map((opt) => (
                      <FundOptionCard
                        key={opt.id}
                        option={opt}
                        selected={selectedFund === opt.id}
                        onSelect={() => setSelectedFund(opt.id)}
                        tierColor={visual.color}
                        canAfford={opt.id === "tokens" ? tokens >= 50 : true}
                      />
                    ))}
                  </div>
                </motion.div>

                {/* ── CTA — staggered reveal #6 ── */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: PREMIUM_EASE, delay: 1.06 }}
                  className="space-y-3"
                >
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={hideOverlay}
                    disabled={!canAffordTokens}
                    className={cn(
                      "group relative flex w-full items-center justify-center gap-3 rounded-full py-4 text-sm font-bold uppercase tracking-[0.14em] transition-all",
                      canAffordTokens
                        ? "btn-magenta"
                        : "bg-[#f4f4f5] text-[#8a8a8a] cursor-not-allowed ring-1 ring-[#141414]/8"
                    )}
                    data-testid="tier-upgrade-cta"
                  >
                    <span>
                      {canAffordTokens
                        ? `Lock in ${currentFund.label}`
                        : "Not enough tokens"}
                    </span>
                    {canAffordTokens && (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1">
                        <ArrowRight size={14} weight="bold" className="text-[#141414]" />
                      </span>
                    )}
                  </motion.button>

                  {/* Confirmshaming opt-out (dark pattern) */}
                  <button
                    onClick={hideOverlay}
                    className="w-full text-center text-[10px] text-[#8a8a8a] hover:text-[#4b4b4b] hover:underline transition-all"
                  >
                    No thanks, I&apos;ll risk losing my {visual.label} perks
                  </button>
                </motion.div>

                {/* Hidden auto-renew fine print (dark pattern) */}
                {selectedFund !== "tokens" && (
                  <p className="text-center text-[9px] leading-relaxed text-[#8a8a8a] max-w-[40ch] mx-auto">
                    Plan auto-renews {selectedFund === "annual" ? "annually" : "monthly"}.
                    Cancel anytime in settings (processing fee may apply). Token multipliers
                    apply to base rewards only.
                  </p>
                )}
              </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
   Sub-components
   ========================================================================== */

function FundOptionCard({
  option,
  selected,
  onSelect,
  tierColor,
  canAfford,
}: {
  option: TierFundOption;
  selected: boolean;
  onSelect: () => void;
  tierColor: string;
  canAfford: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onSelect}
      disabled={!canAfford}
      className={cn(
        "relative rounded-xl p-3 text-left transition-all",
        selected
          ? "bg-white ring-2 shadow-md"
          : "bg-[#f4f4f5] ring-1 ring-[#141414]/8",
        !canAfford && "opacity-50 cursor-not-allowed"
      )}
      style={
        selected
          ? { borderColor: tierColor, boxShadow: `0 4px 16px ${tierColor}25` }
          : undefined
      }
    >
      {selected && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: `inset 0 0 0 2px ${tierColor}` }}
        />
      )}
      {option.badge && (
        <span
          className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
          style={{ backgroundColor: "#14b8a6" }}
        >
          {option.badge}
        </span>
      )}
      {/* Spotlight sweep for highlighted option */}
      {option.highlighted && selected && (
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <div className="absolute top-0 -left-full h-full w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-spotlight-sweep" />
        </div>
      )}
      <div className="relative z-10">
        <div className="mb-1.5 flex items-center gap-1.5">
          {option.id === "tokens" ? (
            <Coins size={12} weight="fill" style={{ color: tierColor }} />
          ) : option.id === "monthly" ? (
            <Lightning size={12} weight="fill" style={{ color: tierColor }} />
          ) : (
            <Crown size={12} weight="fill" style={{ color: tierColor }} />
          )}
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#141414]">
            {option.label}
          </span>
        </div>
        <p className="font-mono text-base font-bold tabular-nums text-[#141414]">
          {option.price}
        </p>
        <p className="text-[9px] text-[#8a8a8a]">{option.unit}</p>
        {selected && (
          <div className="mt-1.5 flex items-center gap-1">
            <CheckCircle size={10} weight="fill" style={{ color: tierColor }} />
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: tierColor }}>
              Selected
            </span>
          </div>
        )}
      </div>
    </motion.button>
  );
}

/**
 * Decorative scattered dots on the tier-colored banner — playful scribble
 * energy matching the Figma design language.
 */
function DecorativeDots() {
  const dots = [
    { top: "12%", left: "8%", size: 6, opacity: 0.3 },
    { top: "22%", left: "85%", size: 4, opacity: 0.25 },
    { top: "65%", left: "6%", size: 8, opacity: 0.2 },
    { top: "78%", left: "92%", size: 5, opacity: 0.3 },
    { top: "45%", left: "95%", size: 3, opacity: 0.2 },
    { top: "88%", left: "15%", size: 4, opacity: 0.25 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {dots.map((d, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -4, 0], opacity: [d.opacity, d.opacity * 1.5, d.opacity] }}
          transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
          className="absolute rounded-full bg-white"
          style={{
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            opacity: d.opacity,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Confetti burst in the tier color — playful celebration particles.
 * GPU-safe (transform + opacity only).
 */
function TierConfettiBurst({ color }: { color: string }) {
  const particles = Array.from({ length: 28 });
  const colors = [color, "#e6009e", "#ffe600", "#ffffff"];
  return (
    <div className="pointer-events-none absolute left-1/2 top-[30%] h-0 w-0 z-50">
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const distance = 100 + (i % 5) * 40;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance - 40;
        const size = 5 + (i % 4) * 2;
        const isCircle = i % 3 === 0;
        const particleColor = colors[i % colors.length]!;
        return (
          <motion.span
            key={i}
            className="absolute"
            style={{
              width: size,
              height: size,
              background: particleColor,
              borderRadius: isCircle ? "9999px" : "2px",
            }}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
            animate={{ opacity: 0, x: dx, y: dy, scale: 0.3, rotate: 360 }}
            transition={{ duration: 1.6, ease: PREMIUM_EASE, delay: 0.15 }}
          />
        );
      })}
    </div>
  );
}

export default TierUpgrade;
