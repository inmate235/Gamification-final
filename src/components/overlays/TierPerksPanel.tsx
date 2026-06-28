"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkle,
  Lightning,
  CircleNotch,
  MapTrifold,
  Tag,
  Coin,
  MapPin,
  Crosshair,
  Warning,
  Clock,
} from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import {
  TIER_ORDER,
  TIER_VISUALS,
  TIER_PERKS,
  TIER_THRESHOLDS,
  TRIAL_PERK_WARNING_MS,
} from "@/data/tierData";
import type { IconWeight } from "@phosphor-icons/react";
import type { Perk } from "@/types";
import { computeTierProgressScore } from "@/engine/tierEngine";

/**
 * TierPerksPanel — the membership perks overlay.
 *
 * Opened by tapping the tier badge in the status bar (VAL-TIER-009..012,
 * VAL-TIER-026). Shows:
 *   - All four tiers with distinct colored badges (VAL-TIER-001, VAL-TIER-002)
 *   - The current tier highlighted with its tier-colored glow
 *   - Current tier perks: flash sale frequency, token multiplier, map
 *     visibility, deal radar (VAL-TIER-010..012)
 *   - Neodymium exclusive perks, shown only when tier === neodymium
 *     (VAL-TIER-026)
 *   - Active trial perks with live countdown + expiry warning (VAL-TIER-014,
 *     VAL-TIER-016)
 *   - Aspiration hint toward the next tier (VAL-TIER-028)
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Icon map (static, ssr-safe)
   ========================================================================== */

const EXCLUSIVE_ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; weight?: IconWeight; className?: string }>
> = {
  Lightning,
  CircleNotch,
  Sparkle,
  MapTrifold,
};

/* ============================================================================
   Component
   ========================================================================== */

export function TierPerksPanel() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  const tier = usePlayerStore((s) => s.tier);
  const tierXP = usePlayerStore((s) => s.tierXP);
  const trialPerks = usePlayerStore((s) => s.trialPerks);
  const perks = usePlayerStore((s) => s.perks);

  const isOpen = activeOverlay === "tier-perks";

  /* --- Live clock for trial-perk countdowns (1s tick) --- */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
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

  const visual = TIER_VISUALS[tier];
  const currentPerks = TIER_PERKS[tier];
  const currentIdx = TIER_ORDER.indexOf(tier);
  const nextTier = TIER_ORDER[currentIdx + 1] ?? null;
  const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : null;
  // Tier progression is driven purely by tierXP (cumulative tokens earned).
  // Exploration is excluded so a fresh user is not auto-promoted (fix-tier-
  // auto-promotion).
  const progressScore = computeTierProgressScore(tierXP);
  const remaining =
    nextThreshold !== null ? Math.max(0, nextThreshold - progressScore) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: PREMIUM_EASE }}
          className="fixed inset-0 z-40 flex items-center justify-center px-4 py-16"
          onClick={hideOverlay}
          data-testid="tier-perks-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Membership perks"
        >
          <div className="absolute inset-0 backdrop-blur-md bg-[#141414]/40" />

          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="relative w-full max-w-lg max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bezel-card">
              <div className="bezel-card-inner">
                {/* Header */}
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium text-[#8a8a8a] ring-1 ring-[#141414]/10">
                      <Sparkle size={12} weight="fill" className="text-[#e6009e]" />
                      Membership
                    </span>
                    <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#141414]">
                      Your perks
                    </h2>
                  </div>
                  <button
                    onClick={hideOverlay}
                    aria-label="Close perks panel"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#141414]/5 ring-1 ring-[#141414]/10 transition-all duration-200 active:scale-[0.97] hover:bg-[#141414]/10"
                  >
                    <X size={16} weight="bold" className="text-[#141414]" />
                  </button>
                </div>

                {/* Tier ladder — all four tiers with distinct badges */}
                <div
                  className="mb-6 grid grid-cols-4 gap-2"
                  data-testid="tier-perks-ladder"
                >
                  {TIER_ORDER.map((t) => {
                    const v = TIER_VISUALS[t];
                    const active = t === tier;
                    const past = TIER_ORDER.indexOf(t) < currentIdx;
                    return (
                      <div
                        key={t}
                        className="flex flex-col items-center gap-2 rounded-2xl px-2 py-3 ring-1 transition-all duration-200"
                        style={{
                          borderColor: active ? v.color : "rgba(20,20,20,0.08)",
                          background: active ? `${v.color}14` : "transparent",
                        }}
                        data-testid={`tier-ladder-${t}`}
                        data-active={active ? "true" : "false"}
                      >
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full ring-1"
                          style={{
                            borderColor: `${v.color}66`,
                            background: past || active ? `${v.color}1f` : "transparent",
                            opacity: past || active ? 1 : 0.45,
                          }}
                        >
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{
                              background: v.color,
                            }}
                          />
                        </div>
                        <span
                          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                          style={{
                            color: active ? v.color : past ? "#8a8a8a" : "#8a8a8a",
                          }}
                        >
                          {v.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Current tier perks card (tier-colored border, VAL-TIER-027) */}
                <div
                  className="mb-6 rounded-[1.5rem] p-1.5 ring-1"
                  style={{ borderColor: `${visual.color}44` }}
                >
                  <div
                    className="rounded-[calc(1.5rem-0.375rem)] p-5"
                    style={{ background: `${visual.color}0d` }}
                  >
                    <div className="mb-4 flex items-center gap-2">
                      <span
                        className="flex h-2.5 w-2.5 rounded-full"
                        style={{ background: visual.color, boxShadow: `0 0 10px ${visual.color}` }}
                      />
                      <h3 className="text-sm font-bold uppercase tracking-[0.15em]" style={{ color: visual.color }}>
                        {visual.label} perks
                      </h3>
                    </div>

                    <div className="space-y-3" data-testid="tier-perks-current">
                      <PerkLine
                        icon={<Tag size={16} weight="fill" />}
                        label="Flash sale frequency"
                        value={currentPerks.flashSaleFrequency}
                        color={visual.color}
                      />
                      <PerkLine
                        icon={<Coin size={16} weight="fill" />}
                        label="Token multiplier"
                        value={currentPerks.tokenMultiplier}
                        color={visual.color}
                      />
                      <PerkLine
                        icon={<MapPin size={16} weight="fill" />}
                        label="Map visibility"
                        value={currentPerks.mapVisibility}
                        color={visual.color}
                      />
                      <PerkLine
                        icon={<Crosshair size={16} weight="fill" />}
                        label="Deal radar"
                        value={currentPerks.dealRadar}
                        color={visual.color}
                      />
                    </div>

                    {/* Neodymium exclusive perks (VAL-TIER-026) */}
                    {tier === "neodymium" && currentPerks.exclusives.length > 0 && (
                      <div className="mt-5 border-t border-[#141414]/8 pt-4" data-testid="tier-perks-neodymium-exclusives">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7c3aed]">
                          Neodymium exclusives
                        </p>
                        <div className="space-y-3">
                          {currentPerks.exclusives.map((ex) => {
                            const Icon = EXCLUSIVE_ICON_MAP[ex.icon] ?? Sparkle;
                            return (
                              <PerkLine
                                key={ex.id}
                                icon={<Icon size={16} weight="fill" />}
                                label={ex.label}
                                value={ex.value}
                                color="#7c3aed"
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Trial perks (endowment effect) with expiry countdown */}
                {trialPerks.length > 0 && (
                  <div className="mb-6" data-testid="tier-perks-trial">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e6009e]">
                      Trial perks
                    </p>
                    <div className="space-y-2">
                      {trialPerks.map((perk) => (
                        <TrialPerkCard key={perk.id} perk={perk} now={now} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Permanent earned perks (if any) */}
                {perks.length > 0 && (
                  <div className="mb-6">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#14b8a6]">
                      Earned perks
                    </p>
                    <div className="space-y-2">
                      {perks.map((perk) => (
                        <div
                          key={perk.id}
                          className="rounded-xl bg-[#f4f4f5] px-3 py-2.5 ring-1 ring-[#141414]/8"
                        >
                          <p className="text-sm font-medium text-[#141414]">{perk.name}</p>
                          <p className="text-xs text-[#4b4b4b]">{perk.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Aspiration hint to next tier (VAL-TIER-028) */}
                {nextTier && (
                  <div
                    className="rounded-2xl bg-[#f4f4f5] px-4 py-3 ring-1 ring-[#141414]/8"
                    data-testid="tier-perks-hint"
                  >
                    <p className="text-xs text-[#4b4b4b]">
                      <span className="font-semibold" style={{ color: TIER_VISUALS[nextTier].color }}>
                        {remaining} more
                      </span>{" "}
                      to reach{" "}
                      <span className="font-semibold" style={{ color: TIER_VISUALS[nextTier].color }}>
                        {TIER_VISUALS[nextTier].label}
                      </span>
                      . {TIER_VISUALS[nextTier].label} members earn{" "}
                      {TIER_PERKS[nextTier].tokenMultiplier}.
                    </p>
                  </div>
                )}
              </div>
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

function PerkLine({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 text-[#4b4b4b]">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs uppercase tracking-[0.1em]">{label}</span>
      </div>
      <span className="text-right text-sm font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function TrialPerkCard({ perk, now }: { perk: Perk; now: number }) {
  const remainingMs = perk.expiresAt !== undefined ? perk.expiresAt - now : Infinity;
  const isWarning =
    perk.expiresAt !== undefined && remainingMs <= TRIAL_PERK_WARNING_MS && remainingMs > 0;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const countdown = `${mm}:${ss.toString().padStart(2, "0")}`;

  return (
    <div
      className="rounded-xl px-3 py-2.5 ring-1 transition-all duration-200"
      style={{
        background: isWarning ? "rgba(230,0,158,0.08)" : "rgba(20,20,20,0.03)",
        borderColor: isWarning ? "rgba(230,0,158,0.4)" : "rgba(20,20,20,0.08)",
      }}
      data-testid={`trial-perk-${perk.id}`}
      data-warning={isWarning ? "true" : "false"}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#141414]">{perk.name}</p>
          <p className="truncate text-xs text-[#4b4b4b]">{perk.description}</p>
        </div>
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-mono tabular-nums"
          style={{
            color: isWarning ? "#e6009e" : "#8a8a8a",
            background: isWarning ? "rgba(230,0,158,0.12)" : "rgba(20,20,20,0.04)",
          }}
          data-testid={`trial-perk-countdown-${perk.id}`}
        >
          {isWarning ? <Warning size={12} weight="fill" /> : <Clock size={12} weight="fill" />}
          {perk.expiresAt !== undefined ? countdown : "permanent"}
        </div>
      </div>
    </div>
  );
}

export default TierPerksPanel;
