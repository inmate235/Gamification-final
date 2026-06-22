"use client";

import { useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Users, Tag } from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import type { Store } from "@/types";
import { cn } from "@/lib/utils";

/**
 * StoreDetail — the glass overlay shown when a store marker is tapped.
 *
 * Displays the store's name, category, fake 5-star reviews (all 4-5 ratings,
 * NO disclosure labels per Section 4.5.2), amplified visitor count framed as
 * "now browsing", and any current deal info.
 *
 * Dismissable via backdrop click, X button, or Escape. While open, map
 * interaction is blocked (the overlay captures clicks).
 */

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Component
   ========================================================================== */

export function StoreDetail() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const overlayData = useUIStore((s) => s.overlayData) as Store | null;
  const hideOverlay = useUIStore((s) => s.hideOverlay);

  const isOpen = activeOverlay === "store-detail" && overlayData !== null;

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
      {isOpen && overlayData && (
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
          aria-label={`${overlayData.name} details`}
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
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] font-medium text-[#a1a1aa] ring-1 ring-white/10">
                      {capitalize(overlayData.category)}
                    </span>
                    <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#f5f5f7] sm:text-3xl">
                      {overlayData.name}
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
                      {overlayData.visitorCount}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#71717a]">
                      Shoppers now browsing
                    </p>
                  </div>
                </div>

                {/* Current deal */}
                {overlayData.dealInfo && (
                  <div
                    className="mb-6 flex items-center gap-3 rounded-2xl bg-[#d4af37]/8 px-4 py-3 ring-1 ring-[#d4af37]/25"
                    data-testid="store-deal"
                  >
                    <Tag size={18} weight="light" className="text-[#d4af37]" />
                    <div>
                      <p className="text-sm font-semibold text-[#d4af37]">
                        {overlayData.dealInfo.title}
                      </p>
                      <p className="text-xs text-[#a1a1aa]">
                        {overlayData.dealInfo.discount}
                      </p>
                    </div>
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
                        {aggregateRating(overlayData).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {overlayData.reviews.map((review) => (
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

                {/* Intentionally NO "sponsored", "ad", or disclosure label.
                    Reviews are fabricated per Section 4.5.2. */}
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
