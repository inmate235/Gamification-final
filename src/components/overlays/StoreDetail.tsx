"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Users } from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";
import { getStoreById } from "@/data/mallData";
import { DealCard } from "@/components/mall/DealCard";
import { calculateDeficitPrice } from "@/stores/economyStore";
import { showTokenFeedback } from "@/engine/tokenEconomy";
import type { Store, StoreCategory } from "@/types";
import { cn } from "@/lib/utils";

/**
 * StoreDetail — the glass overlay shown when a store marker is tapped.
 *
 * Displays the store's name, category badge (color-coded), fake 5-star reviews,
 * amplified visitor count framed as "now browsing", and any current deal info.
 * Supports store resolution from feed data payload.
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Category colors — matching StoreMarker palette
   ========================================================================== */

const CATEGORY_COLORS: Record<StoreCategory, string> = {
  fashion: "#e879a1",
  tech: "#4fd1c5",
  lifestyle: "#d4af37",
  food: "#f59e0b",
  accessories: "#9d7fdb",
};

/* ============================================================================
   CountingTicker — micro-animated visitor counter
   ========================================================================== */
function CountingTicker({ value }: { value: number }) {
  const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
  const [displayValue, setDisplayValue] = useState(isTest ? value : Math.max(0, value - 15));
  useEffect(() => {
    if (isTest) return;
    let start = Math.max(0, value - 15);
    const end = value;
    if (start === end) return;
    const duration = 800; // 800ms
    const stepTime = Math.abs(Math.floor(duration / (end - start)));
    const timer = setInterval(() => {
      start += 1;
      setDisplayValue(start);
      if (start >= end) {
        clearInterval(timer);
      }
    }, Math.max(stepTime, 20));
    return () => clearInterval(timer);
  }, [value]);
  return <>{displayValue}</>;
}

/* ============================================================================
   Component
   ========================================================================== */

export function StoreDetail() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const rawOverlayData = useUIStore((s) => s.overlayData);
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  
  const tokens = usePlayerStore((s) => s.tokens);
  const spendTokens = usePlayerStore((s) => s.spendTokens);

  const [claimed, setClaimed] = useState(false);

  // Resolve store from either a full store object or a lookup by ID
  const store = useMemo(() => {
    if (!rawOverlayData) return null;
    if ("category" in (rawOverlayData as any)) {
      return rawOverlayData as Store;
    }
    const payload = rawOverlayData as { storeId?: string };
    if (payload && payload.storeId) {
      return getStoreById(payload.storeId) || null;
    }
    return null;
  }, [rawOverlayData]);

  // Provenance flag: did the user arrive here via a feed recommendation click?
  const fromFeed = useMemo(() => {
    if (!rawOverlayData) return false;
    return !("category" in (rawOverlayData as any));
  }, [rawOverlayData]);

  const [prevStoreId, setPrevStoreId] = useState<string | null>(null);
  if (store && store.id !== prevStoreId) {
    setPrevStoreId(store.id);
    setClaimed(false);
  }

  const isOpen = activeOverlay === "store-detail" && store !== null;

  // Deficit cost frozen at open time
  const dealCost = useMemo(() => {
    if (!store || !store.dealInfo) return 0;
    return calculateDeficitPrice(tokens);
  }, [store?.id]);

  const canAfford = tokens >= dealCost;
  const shortfall = Math.max(0, dealCost - tokens);

  const handleClaim = () => {
    const ok = spendTokens(dealCost);
    if (ok) {
      setClaimed(true);
      setTimeout(() => {
        showTokenFeedback("spend", dealCost, `Deal Claimed! -${dealCost} Tokens`);
        hideOverlay();
      }, 1300);
    }
  };

  /* --- Escape to close --- */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, hideOverlay]);

  const handleClose = useCallback(() => hideOverlay(), [hideOverlay]);

  return (
    <AnimatePresence>
      {isOpen && store && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: PREMIUM_EASE }}
          className="fixed inset-0 z-40 flex items-center justify-center px-4 py-20"
          onClick={handleClose}
          data-testid="store-detail-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${store.name} details`}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 backdrop-blur-2xl bg-black/60" />

          {/* Glass card */}
          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="relative w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bezel-card glow-gold">
              <div className="bezel-card-inner max-h-[70dvh] overflow-y-auto p-6 sm:p-8">
                {/* Header */}
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex gap-2 flex-wrap items-center">
                      {/* Category badge — color-coded per category (Figma-inspired) */}
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold ring-1"
                        style={{
                          color: CATEGORY_COLORS[store.category],
                          background: `${CATEGORY_COLORS[store.category]}14`,
                          borderColor: `${CATEGORY_COLORS[store.category]}33`,
                        }}
                      >
                        {capitalize(store.category)}
                      </span>
                      {fromFeed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#4fd1c5]/10 px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold text-[#4fd1c5] ring-1 ring-[#4fd1c5]/30">
                          From your feed
                        </span>
                      )}
                    </div>
                    <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#f5f5f7] sm:text-3xl">
                      {store.name}
                    </h2>
                  </div>
                  <button
                    onClick={handleClose}
                    aria-label="Close store details"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/10 active:scale-[0.96]"
                  >
                    <X size={16} weight="light" className="text-[#a1a1aa]" />
                  </button>
                </div>

                {/* Visitor count — amplified, "now browsing" framing */}
                <div
                  className="mb-6 flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
                  data-testid="store-visitor-count"
                >
                  <Users size={18} weight="light" className="text-[#4fd1c5]" />
                  <div>
                    <p className="font-mono text-lg font-semibold tabular-nums text-[#4fd1c5]">
                      <CountingTicker value={store.visitorCount} />
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#71717a]">
                      Shoppers now browsing
                    </p>
                  </div>
                </div>

                {/* Gamified Deal Card replacing flat deal layout */}
                {store.dealInfo && (
                  <div className="mb-6" data-testid="store-deal">
                    <DealCard
                      deal={{
                        title: store.dealInfo.title,
                        discount: store.dealInfo.discount,
                        tokenCost: dealCost,
                        countdownSeconds: 240, // 4 minutes
                      }}
                      storeName={store.name}
                      onClaim={handleClaim}
                      isClaimed={claimed}
                      canAfford={canAfford}
                      shortfall={shortfall}
                    />
                  </div>
                )}

                {/* Reviews — fake 5-star, NO disclosure labels */}
                <div data-testid="store-reviews">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-[0.18em] font-medium text-[#a1a1aa]">
                      Member Reviews
                    </h3>
                    {/* Aggregate star rating — always high, no disclosure */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          weight="fill"
                          className="text-[#d4af37]"
                        />
                      ))}
                      <span className="ml-1 font-mono text-xs text-[#d4af37]">
                        {aggregateRating(store).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {store.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
                        data-testid={`review-${review.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <AvatarBubble seed={review.avatarSeed} />
                            <div>
                              <p className="text-sm font-medium text-[#f5f5f7]">
                                {review.authorName}
                              </p>
                              <p className="text-[10px] uppercase tracking-[0.1em] text-[#71717a]">
                                {review.date}
                              </p>
                            </div>
                          </div>
                          <div
                            className="flex items-center gap-0.5"
                            data-testid={`review-rating-${review.id}`}
                            aria-label={`${review.rating} out of 5 stars`}
                          >
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={11}
                                weight={i < review.rating ? "fill" : "light"}
                                className={cn(
                                  i < review.rating
                                    ? "text-[#d4af37]"
                                    : "text-[#3a3a44]"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-[#a1a1aa]">
                          {review.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
   Helpers
   ========================================================================== */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Computes the aggregate (average) rating across reviews for display. */
function aggregateRating(store: Store): number {
  if (store.reviews.length === 0) return 5;
  const sum = store.reviews.reduce((acc, r) => acc + r.rating, 0);
  return sum / store.reviews.length;
}

/** A deterministic gradient avatar bubble derived from a seed string. */
function AvatarBubble({ seed }: { seed: string }) {
  const hue = hashSeed(seed) % 360;
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white/90 ring-1 ring-white/10"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 40% 35%), hsl(${
          (hue + 40) % 360
        } 45% 25%))`,
      }}
      aria-hidden="true"
    >
      {seed.slice(-2).toUpperCase()}
    </span>
  );
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default StoreDetail;
