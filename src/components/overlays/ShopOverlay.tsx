"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ShoppingBag,
  Lightning,
  Tag,
  Check,
  Lock,
  Path,
  Timer,
  Users,
  CheckCircle,
  Sparkle,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { useUIStore } from "@/stores/uiStore";
import { useEconomyStore } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import { claimFlashSale, showTokenFeedback, unlockShortcut } from "@/engine/tokenEconomy";
import { dismissFlashSale, expireFlashSale } from "@/engine/flashSaleEngine";
import { getStoreById, getZoneById } from "@/data/mallData";
import { cn } from "@/lib/utils";
import { TIER_PERKS } from "@/data/tierData";
import type { FlashSale, Shortcut } from "@/types";

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   Floating entry button
   ========================================================================== */

export function ShopEntryButton() {
  const showOverlay = useUIStore((s) => s.showOverlay);
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const flashSaleCount = useEconomyStore((s) => s.flashSales.length);
  const hasActiveShortcut = useEconomyStore((s) => s.shortcuts.some((sc) => !sc.unlocked));
  
  // Previous deal count to trigger the subtle nudge animation
  const prevCount = useRef(flashSaleCount);
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    if (flashSaleCount > prevCount.current) {
      setNudge(true);
      const timer = setTimeout(() => setNudge(false), 2000);
      prevCount.current = flashSaleCount;
      return () => clearTimeout(timer);
    }
    prevCount.current = flashSaleCount;
  }, [flashSaleCount]);

  const onOpen = useCallback(() => {
    showOverlay("shop");
  }, [showOverlay]);

  // Hide while another overlay is capturing the screen.
  if (activeOverlay !== "none" && activeOverlay !== "shop") return null;
  // If no shortcuts to buy and no flash sales, we could hide it, but a Shop is often persistent.
  // We will keep it always visible as a central hub if there's anything to do.
  if (!hasActiveShortcut && flashSaleCount === 0) return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.7, ease: PREMIUM_EASE }}
      onClick={onOpen}
      aria-label="Open Shop"
      className="flex items-center gap-2 rounded-full bg-[#e6009e] px-4 py-2.5 ring-2 ring-white shadow-[0_6px_0_#b8007e] transition-all duration-200 active:translate-y-[3px] active:shadow-[0_3px_0_#b8007e]"
      data-testid="shop-entry-button"
    >
      <motion.div
        animate={nudge ? { scale: [1, 1.25, 0.9, 1.1, 1], rotate: [0, -10, 10, -5, 0] } : {}}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <ShoppingBag size={16} weight="fill" className="text-white" />
      </motion.div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
        Shop
      </span>
      {flashSaleCount > 0 && (
        <span
          className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-[#e6009e]"
        >
          {flashSaleCount}
        </span>
      )}
    </motion.button>
  );
}

/* ============================================================================
   Overlay
   ========================================================================== */

export function ShopOverlay() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  const flashSales = useEconomyStore((s) => s.flashSales);
  const shortcuts = useEconomyStore((s) => s.shortcuts);
  const liveDeficitPrice = useEconomyStore((s) => s.liveDeficitPrice);
  const tokens = usePlayerStore((s) => s.tokens);

  const isOpen = activeOverlay === "shop";
  const [activeTab, setActiveTab] = useState<"deals" | "shortcuts" | "tiers">(
    flashSales.length > 0 ? "deals" : "shortcuts"
  );

  // Switch to deals tab if a new deal comes in while open, or switch to shortcuts if deals are empty
  const [prevFlashSalesCount, setPrevFlashSalesCount] = useState(flashSales.length);
  if (flashSales.length !== prevFlashSalesCount) {
    setPrevFlashSalesCount(flashSales.length);
    if (flashSales.length > 0 && activeTab === "shortcuts" && shortcuts.every(s => s.unlocked)) {
       setActiveTab("deals");
    } else if (flashSales.length === 0 && activeTab === "deals") {
       setActiveTab("shortcuts");
    }
  }

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
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: PREMIUM_EASE }}
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center px-0 sm:px-4 pb-0 sm:py-20"
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-label="Shop"
        >
          <div className="absolute inset-0 backdrop-blur-md bg-[#141414]/40" />

          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
            className="relative w-full max-w-md max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-t-3xl sm:rounded-3xl bg-white flex flex-col overflow-hidden ring-2 ring-[#141414]/8 shadow-[0_24px_64px_rgba(20,20,20,0.22)]">
              {/* Header */}
              <div className="p-6 sm:p-7 pb-4 bg-white z-10 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e6009e]/12 ring-1 ring-[#e6009e]/30">
                      <ShoppingBag size={16} weight="fill" className="text-[#e6009e]" />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-[#141414] font-display">
                        Marketplace
                      </h2>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a8a8a]">
                        Exclusive Deals & Shortcuts
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    aria-label="Close shop"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#141414]/5 ring-1 ring-[#141414]/10 transition-all duration-200 hover:bg-[#141414]/10 active:scale-[0.96]"
                  >
                    <X size={16} weight="bold" className="text-[#141414]" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="mt-5 flex gap-2 rounded-xl bg-[#f4f4f5] p-1">
                  <button
                    onClick={() => setActiveTab("deals")}
                    className={cn(
                      "flex-1 rounded-lg py-2 text-[11px] font-bold uppercase tracking-[0.16em] transition-all",
                      activeTab === "deals"
                        ? "bg-white text-[#e6009e] shadow-sm ring-1 ring-[#141414]/5"
                        : "text-[#8a8a8a] hover:text-[#4b4b4b]"
                    )}
                  >
                    Deals {flashSales.length > 0 && `(${flashSales.length})`}
                  </button>
                  <button
                    onClick={() => setActiveTab("shortcuts")}
                    className={cn(
                      "flex-1 rounded-lg py-2 text-[11px] font-bold uppercase tracking-[0.16em] transition-all",
                      activeTab === "shortcuts"
                        ? "bg-white text-[#7c3aed] shadow-sm ring-1 ring-[#141414]/5"
                        : "text-[#8a8a8a] hover:text-[#4b4b4b]"
                    )}
                  >
                    Shortcuts
                  </button>
                  <button
                    onClick={() => setActiveTab("tiers")}
                    className={cn(
                      "flex-1 rounded-lg py-2 text-[11px] font-bold uppercase tracking-[0.16em] transition-all flex items-center justify-center gap-1",
                      activeTab === "tiers"
                        ? "bg-white text-[#d4af37] shadow-sm ring-1 ring-[#141414]/5"
                        : "text-[#8a8a8a] hover:text-[#4b4b4b]"
                    )}
                  >
                    <Sparkle size={12} weight={activeTab === "tiers" ? "fill" : "regular"} /> Tiers
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto px-6 sm:px-7 pb-6 sm:pb-7 flex-1">
                {activeTab === "deals" && <ShopDealsTab sales={flashSales} tokens={tokens} />}
                {activeTab === "shortcuts" && <ShopShortcutsTab shortcuts={shortcuts} tokens={tokens} liveDeficitPrice={liveDeficitPrice} />}
                {activeTab === "tiers" && <ShopTiersTab />}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
   Deals Tab
   ========================================================================== */

function ShopDealsTab({ sales, tokens }: { sales: FlashSale[], tokens: number }) {
  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Tag size={32} weight="light" className="text-[#8a8a8a] mb-3" />
        <p className="text-sm font-medium text-[#4b4b4b]">No active deals right now.</p>
        <p className="text-xs text-[#8a8a8a] mt-1">Keep exploring the mall to uncover exclusive offers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sales.map(sale => (
        <ShopDealCard key={sale.id} sale={sale} tokens={tokens} />
      ))}
    </div>
  );
}

function ShopDealCard({ sale, tokens }: { sale: FlashSale, tokens: number }) {
  const store = getStoreById(sale.storeId);
  const canAfford = tokens >= sale.tokenCost;
  const shortfall = Math.max(0, sale.tokenCost - tokens);
  const [claimed, setClaimed] = useState(sale.claimed ?? false);
  const [liveViewers, setLiveViewers] = useState(sale.socialProof ?? 23);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveViewers((prev) => {
        const change = Math.random() > 0.5 ? 1 : -1;
        const newVal = prev + change;
        return newVal > 3 ? newVal : 4;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const onExpire = useCallback(() => {
    expireFlashSale(sale.id);
  }, [sale.id]);

  const onDismiss = useCallback(() => {
    dismissFlashSale(sale.id);
  }, [sale.id]);

  const onGrab = useCallback(() => {
    const cost = sale.tokenCost;
    const ok = claimFlashSale(sale.id, { showFeedback: false });
    if (ok) {
      setClaimed(true);
      setTimeout(() => {
        showTokenFeedback("spend", cost, `Deal Claimed! -${cost} Tokens`);
      }, 1000);
    }
  }, [sale]);

  return (
    <div className="rounded-2xl bg-white ring-1 ring-[#141414]/10 shadow-sm overflow-hidden transition-all">
      <div className="p-4 border-b border-[#141414]/5 bg-gradient-to-r from-[#ffe600]/20 to-transparent flex items-start justify-between">
         <div>
            <span className="inline-block rounded-full bg-[#e6009e]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] font-bold text-[#e6009e] mb-1">
              Flash Sale
            </span>
            <h3 className="text-base font-bold text-[#141414] leading-tight">{store?.name ?? "Exclusive Deal"}</h3>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a8a] mt-0.5">{store?.category}</p>
         </div>
         <button onClick={onDismiss} className="p-1.5 text-[#8a8a8a] hover:bg-[#141414]/5 rounded-full transition-colors">
            <X size={14} weight="bold" />
         </button>
      </div>

      <div className="p-4">
        <div className="mb-3">
          <p className="font-mono text-xl font-bold tabular-nums text-[#e6009e]">{sale.discount}</p>
          <p className="text-xs leading-relaxed text-[#4b4b4b] mt-0.5">{sale.itemDescription}</p>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 rounded-xl bg-[#f4f4f5] px-3 py-2 flex items-center justify-between ring-1 ring-[#141414]/5">
             <div className="flex items-center gap-1.5 text-[#e6009e]">
               <Timer size={14} weight="fill" />
             </div>
             <Countdown remaining={sale.countdownSeconds} onExpire={onExpire} />
          </div>
          <div className="flex-1 rounded-xl bg-[#f4f4f5] px-3 py-2 flex items-center justify-between ring-1 ring-[#141414]/5">
             <div className="flex items-center gap-1.5 text-[#14b8a6]">
               <Users size={14} weight="fill" />
             </div>
             <p className="font-mono text-sm font-bold tabular-nums text-[#141414]">{liveViewers} <span className="text-[10px] font-sans font-normal text-[#8a8a8a]">viewing</span></p>
          </div>
        </div>

        {claimed ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-[#14b8a6]/10 px-4 py-3 ring-1 ring-[#14b8a6]/30">
            <CheckCircle size={16} weight="fill" className="text-[#14b8a6]" />
            <span className="text-xs font-semibold tracking-tight text-[#14b8a6]">Deal Claimed!</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-lg font-bold tabular-nums text-[#e6009e]">{sale.tokenCost}</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8a8a]">Tokens</p>
            </div>
            <button
              onClick={onGrab}
              disabled={!canAfford}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-all",
                canAfford
                  ? "bg-[#e6009e] text-white shadow-sm hover:bg-[#b8007e] active:scale-95"
                  : "bg-[#f4f4f5] text-[#8a8a8a] cursor-not-allowed"
              )}
            >
              {canAfford ? "Grab Deal" : `${shortfall} more`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Countdown({ remaining, onExpire }: { remaining: number; onExpire: () => void }) {
  const expiredRef = useRef(false);

  useEffect(() => {
    if (remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire();
    }
  }, [remaining, onExpire]);

  const m = Math.floor(Math.max(0, remaining) / 60);
  const s = Math.max(0, remaining) % 60;
  const timeStr = `${m}:${s.toString().padStart(2, "0")}`;

  return <p className="font-mono text-sm font-bold tabular-nums text-[#141414]">{timeStr}</p>;
}

/* ============================================================================
   Shortcuts Tab
   ========================================================================== */

function ShopShortcutsTab({ shortcuts, tokens, liveDeficitPrice }: { shortcuts: Shortcut[], tokens: number, liveDeficitPrice: number }) {
  const active = shortcuts.find((s) => !s.unlocked) ?? null;
  const nextUp = shortcuts.find((s) => !s.unlocked && s.id !== active?.id) ?? null;
  const unlocked = shortcuts.filter((s) => s.unlocked);
  const canAfford = active !== null && tokens >= active.tokenCost;

  return (
    <div className="space-y-4">
      {active ? (
        <ActiveShortcutCard shortcut={active} canAfford={canAfford} tokens={tokens} />
      ) : (
        <div className="rounded-2xl bg-[#f4f4f5] p-5 text-center ring-1 ring-[#141414]/10">
          <Lightning size={32} weight="light" className="text-[#8a8a8a] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#4b4b4b]">All shortcuts unlocked.</p>
          <p className="text-xs text-[#8a8a8a] mt-1">You know every hidden path in the mall.</p>
        </div>
      )}

      {nextUp && (
        <div className="flex items-center justify-between rounded-2xl bg-[#f4f4f5] px-4 py-3 ring-1 ring-[#141414]/10 opacity-75">
          <div className="flex items-center gap-2.5">
            <Lock size={14} weight="fill" className="text-[#8a8a8a]" />
            <div>
              <p className="text-xs font-medium text-[#4b4b4b]">{nextUp.name}</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8a8a]">Next up</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-bold tabular-nums text-[#141414]">{liveDeficitPrice}</p>
            <p className="text-[10px] text-[#8a8a8a]">{Math.max(0, liveDeficitPrice - tokens)} more to unlock</p>
          </div>
        </div>
      )}

      {unlocked.length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a8a8a] mb-3">Unlocked Routes</p>
          <div className="space-y-2">
            {unlocked.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 rounded-xl bg-[#14b8a6]/10 px-3 py-2.5 ring-1 ring-[#14b8a6]/20">
                <Check size={14} weight="bold" className="text-[#14b8a6]" />
                <span className="text-xs font-medium text-[#14b8a6]">
                  {zoneLabel(s.fromZoneId)} ↔ {zoneLabel(s.toZoneId)}
                </span>
                <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-[#8a8a8a] truncate max-w-[80px]">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveShortcutCard({ shortcut, canAfford, tokens }: { shortcut: Shortcut; canAfford: boolean; tokens: number }) {
  const onUnlock = useCallback(() => {
    unlockShortcut(shortcut.id);
  }, [shortcut.id]);
  const shortfall = Math.max(0, shortcut.tokenCost - tokens);

  return (
    <div className="rounded-2xl bg-[#7c3aed]/5 p-4 ring-1 ring-[#7c3aed]/25 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Path size={64} weight="fill" className="text-[#7c3aed]" />
      </div>
      <div className="relative z-10">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#7c3aed]/20 text-[#7c3aed]">
            <Lightning size={12} weight="fill" />
          </span>
          <span className="text-sm font-bold text-[#141414]">{shortcut.name}</span>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-[#4b4b4b]">{shortcut.description}</p>
        
        <div className="mb-4 flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-[#141414]/5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a8a8a]">Route</span>
          <span className="font-mono text-xs font-semibold text-[#7c3aed]">
            {zoneLabel(shortcut.fromZoneId)} ↔ {zoneLabel(shortcut.toZoneId)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xl font-bold tabular-nums text-[#e6009e]">{shortcut.tokenCost}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8a8a]">Tokens to unlock</p>
          </div>
          <button
            onClick={onUnlock}
            disabled={!canAfford}
            className={cn(
              "rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] transition-all",
              canAfford
                ? "bg-[#7c3aed] text-white shadow-sm hover:bg-[#6d28d9] active:scale-95"
                : "bg-white text-[#8a8a8a] ring-1 ring-[#141414]/10 cursor-not-allowed"
            )}
          >
            {canAfford ? "Unlock" : `${shortfall} more`}
          </button>
        </div>
      </div>
    </div>
  );
}

function zoneLabel(zoneId: string): string {
  return getZoneById(zoneId)?.name ?? zoneId;
}

/* ============================================================================
   Tiers Tab
   ========================================================================== */

function ShopTiersTab() {
  const setTier = usePlayerStore((s) => s.setTier);
  const currentTier = usePlayerStore((s) => s.tier);
  const [purchasing, setPurchasing] = useState(false);
  const [fakeSpotsLeft, setFakeSpotsLeft] = useState(3);
  const [countdown, setCountdown] = useState(14 * 60 + 59); // 14:59

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.8) {
        setFakeSpotsLeft((prev) => Math.max(1, prev - 1));
      }
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSubscribe = () => {
    setPurchasing(true);
    setTimeout(() => {
      setTier("neodymium");
      setPurchasing(false);
    }, 800);
  };

  const isSubscribed = currentTier === "neodymium";
  
  const mm = Math.floor(countdown / 60);
  const ss = countdown % 60;
  const timeStr = `${mm}:${ss.toString().padStart(2, "0")}`;

  if (isSubscribed) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#9d7fdb]/10 ring-2 ring-[#9d7fdb]/30 mb-4">
          <Sparkle size={32} weight="fill" className="text-[#9d7fdb]" />
        </div>
        <h3 className="text-xl font-bold font-display text-[#141414] mb-2">Welcome to Neodymium</h3>
        <p className="text-sm font-medium text-[#4b4b4b] mb-6 px-4">
          You are an active subscriber to our highest tier. Enjoy unlimited flash sales, free shortcuts, and concierge reviews.
        </p>
        <div className="rounded-xl bg-[#f4f4f5] px-6 py-3 ring-1 ring-[#141414]/10">
          <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#8a8a8a]">Subscription Active</p>
          <p className="font-mono text-sm font-bold mt-1 text-[#141414]">$99.99 / mo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* FOMO Banner */}
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#e6009e] to-[#ff0055] px-4 py-3 text-white shadow-sm shadow-[#e6009e]/20">
        <Warning size={20} weight="fill" className="shrink-0 animate-pulse" />
        <div className="flex-1">
          <p className="text-xs font-bold tracking-wide">ONLY {fakeSpotsLeft} SPOTS LEFT IN YOUR AREA!</p>
          <p className="text-[10px] opacity-90 mt-0.5">Offer expires in {timeStr}</p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#2a1b4d] to-[#140d26] ring-1 ring-[#9d7fdb]/30 p-1">
        {/* Shine effect */}
        <div className="absolute top-0 -inset-full h-full w-1/2 z-0 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-10 animate-[shimmer_3s_infinite]" />
        
        <div className="relative z-10 bg-[#140d26]/80 backdrop-blur-xl rounded-[14px] p-5">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="inline-block rounded-full bg-[#9d7fdb]/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-bold text-[#9d7fdb] mb-2 ring-1 ring-[#9d7fdb]/40 shadow-[0_0_12px_rgba(157,127,219,0.3)]">
                Neodymium Tier
              </span>
              <h3 className="text-2xl font-bold font-display text-white">The Ultimate Pass</h3>
            </div>
            <Sparkle size={28} weight="fill" className="text-[#d4af37] animate-[pulse_2s_ease-in-out_infinite]" />
          </div>

          <p className="text-xs text-white/70 mb-6 leading-relaxed">
            Skip the grind. Unlock every hidden zone, claim unlimited deals, and get VIP concierge service instantly.
          </p>

          <div className="space-y-3 mb-6">
            {TIER_PERKS.neodymium.exclusives.map((perk) => (
              <div key={perk.id} className="flex items-start gap-2.5">
                <Check size={14} weight="bold" className="text-[#9d7fdb] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">{perk.label}</p>
                  <p className="text-[10px] text-white/60 mt-0.5">{perk.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-5 mt-2">
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold tracking-tighter text-white font-mono">$99.99</span>
              <span className="text-xs text-white/50 uppercase tracking-widest">/ month</span>
            </div>

            <button
              onClick={handleSubscribe}
              disabled={purchasing}
              className={cn(
                "w-full rounded-xl px-4 py-3.5 text-xs font-bold uppercase tracking-[0.16em] transition-all",
                purchasing
                  ? "bg-[#9d7fdb]/50 text-white cursor-wait"
                  : "bg-gradient-to-r from-[#9d7fdb] to-[#7c3aed] text-white shadow-[0_0_20px_rgba(157,127,219,0.4)] hover:shadow-[0_0_30px_rgba(157,127,219,0.6)] active:scale-[0.98]"
              )}
            >
              {purchasing ? "Processing..." : "Subscribe Now"}
            </button>
            <p className="text-center text-[9px] text-white/40 mt-3 font-medium cursor-pointer hover:underline">
              No, I prefer missing out on exclusive deals.
            </p>
          </div>
        </div>
      </div>
      <p className="text-center text-[10px] text-[#8a8a8a]">
        By subscribing you agree to a 12-month commitment. <br/> Early termination fees apply.
      </p>
    </div>
  );
}
