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
 * StoreDetail — the overlay shown when a store marker is tapped.
 *
 * Playful Figma direction: white bottom-sheet modal, category badge using the
 * playful palette, teal "From your feed" badge, magenta-accented deal card,
 * and 5-star reviews on light cards with colorful avatar bubbles.
 *
 * Behaviour preserved from the original:
 *  - Resolves store from a full object or a feed-data storeId payload
 *  - Gamified deal claim via spendTokens + tokenEconomy feedback
 *  - Escape and backdrop-click to close
 *  - From-feed provenance badge
 */

const SMOOTH = [0.32, 0.72, 0, 1] as const;
const POP = [0.34, 1.56, 0.64, 1] as const;

/* ============================================================================
   Category colors — matching StoreMarker playful palette
   ========================================================================== */

const CATEGORY_COLORS: Record<StoreCategory, string> = {
  fashion: "#e6009e",
  tech: "#14b8a6",
  lifestyle: "#7c3aed",
  food: "#f59e0b",
  accessories: "#84cc16",
};

/* ============================================================================
   CountingTicker — micro-animated visitor counter
   ========================================================================== */
function CountingTicker({ value }: { value: number }) {
  const isTest =
    typeof process !== "undefined" && process.env.NODE_ENV === "test";
  const [displayValue, setDisplayValue] = useState(
    isTest ? value : Math.max(0, value - 15)
  );
  useEffect(() => {
    if (isTest) return;
    let start = Math.max(0, value - 15);
    const end = value;
    if (start === end) return;
    const duration = 800;
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
          transition={{ duration: 0.35, ease: SMOOTH }}
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center px-0 sm:px-4 pb-0 sm:py-20"
          onClick={handleClose}
          data-testid="store-detail-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${store.name} details`}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 backdrop-blur-md bg-[#141414]/40" />

          {/* White bottom-sheet card */}
          <motion.div
            initial={{ opacity: 0, y: 64, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.98 }}
            transition={{ duration: 0.5, ease: POP }}
            className="relative w-full max-w-lg max-h-[88dvh] sm:max-h-[70dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-[0_-12px_48px_rgba(20,20,20,0.22)] sm:shadow-[0_24px_64px_rgba(20,20,20,0.22)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex gap-2 flex-wrap items-center">
                    {/* Category badge — playful palette color */}
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] font-bold"
                      style={{
                        color: CATEGORY_COLORS[store.category],
                        background: `${CATEGORY_COLORS[store.category]}18`,
                        border: `1.5px solid ${CATEGORY_COLORS[store.category]}40`,
                      }}
                    >
                      {capitalize(store.category)}
                    </span>
                    {fromFeed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#14b8a6]/12 px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold text-[#14b8a6] border border-[#14b8a6]/30">
                        From your feed
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#141414] sm:text-3xl">
                    {store.name}
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  aria-label="Close store details"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#141414]/5 text-[#141414] ring-1 ring-[#141414]/10 transition-all duration-200 hover:bg-[#141414]/10 active:scale-95"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              {/* Visitor count — "now browsing" framing */}
              <div
                className="mb-5 flex items-center gap-3 rounded-2xl bg-[#14b8a6]/8 px-4 py-3 ring-1 ring-[#14b8a6]/20"
                data-testid="store-visitor-count"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#14b8a6]">
                  <Users size={18} weight="fill" className="text-white" />
                </div>
                <div>
                  <p className="font-mono text-lg font-bold tabular-nums text-[#14b8a6]">
                    <CountingTicker value={store.visitorCount} />
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#4b4b4b]">
                    Shoppers now browsing
                  </p>
                </div>
              </div>

              {/* Gamified Deal Card */}
              {store.dealInfo && (
                <div className="mb-5" data-testid="store-deal">
                  <DealCard
                    deal={{
                      title: store.dealInfo.title,
                      discount: store.dealInfo.discount,
                      tokenCost: dealCost,
                      countdownSeconds: 240,
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
                  <h3 className="text-xs uppercase tracking-[0.18em] font-bold text-[#8a8a8a]">
                    Member Reviews
                  </h3>
                  {/* Aggregate star rating — always high, no disclosure */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        weight="fill"
                        className="text-[#e6009e]"
                      />
                    ))}
                    <span className="ml-1 font-mono text-xs font-bold text-[#e6009e]">
                      {aggregateRating(store).toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {store.reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-2xl bg-[#f4f4f5] p-4 ring-1 ring-[#141414]/8"
                      data-testid={`review-${review.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <AvatarBubble seed={review.avatarSeed} />
                          <div>
                            <p className="text-sm font-semibold text-[#141414]">
                              {review.authorName}
                            </p>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-[#8a8a8a]">
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
                                  ? "text-[#e6009e]"
                                  : "text-[#141414]/15"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-[#4b4b4b]">
                        {review.text}
                      </p>
                    </div>
                  ))}
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

function aggregateRating(store: Store): number {
  if (store.reviews.length === 0) return 5;
  const sum = store.reviews.reduce((acc, r) => acc + r.rating, 0);
  return sum / store.reviews.length;
}

/** A deterministic colorful avatar bubble derived from a seed string. */
function AvatarBubble({ seed }: { seed: string }) {
  const hue = hashSeed(seed) % 360;
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-white shadow-sm"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${
          (hue + 40) % 360
        } 75% 45%))`,
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
