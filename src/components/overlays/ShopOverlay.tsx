"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ShoppingBag,
  Tag,
  Timer,
  Users,
  CheckCircle,
  Sparkle,
  Warning,
  Crown,
  Fire,
  TrendUp,
  TrendDown,
  Coins,
  Eye,
  Gift,
  ArrowRight,
  Star,
  Medal,
  Gauge,
  PlayCircle,
  CaretUp,
  Wallet,
  CreditCard,
  Diamond,
} from "@phosphor-icons/react/dist/ssr";
import { dismissFlashSale, expireFlashSale } from "@/engine/flashSaleEngine";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { useEconomyStore } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import { claimFlashSale, buyTokenPack, showTokenFeedback } from "@/engine/tokenEconomy";
import { getStoreById } from "@/data/mallData";
import { TIER_PERKS, TIER_ORDER, TIER_PRICING } from "@/data/tierData";
import { setTimelineTargetStore } from "@/components/social/TimelineFeed";
import { useSocialStore } from "@/stores/socialStore";
import { TOKEN_PACKS } from "@/data/tokenPackData";
import { playSound, SOUNDS } from "@/lib/sound";
import type { FlashSale, TokenPack, Tier } from "@/types";

const PREMIUM_EASE = [0.32, 0.72, 0, 1] as const;

/* ============================================================================
   DARK PATTERN DATA — Tier pricing with exaggerated price gaps
   ========================================================================== */

/* Fake purchaser names for the live purchase ticker (dark pattern: social proof) */
const FAKE_PURCHASERS: Array<{ name: string; action: string; store: string }> = [
  { name: "Yuki T.", action: "grabbed 40% off at", store: "Bloom" },
  { name: "Dario V.", action: "subscribed to", store: "Neodymium" },
  { name: "Priya L.", action: "bought 800 tokens from", store: "Token Shop" },
  { name: "Kai O.", action: "unlocked 50% off at", store: "TechNova" },
  { name: "Mira C.", action: "grabbed Buy 1 Get 1 at", store: "Cafe Nuit" },
  { name: "Theo N.", action: "upgraded to Gold from", store: "Marketplace" },
  { name: "Zara H.", action: "snagged 35% off at", store: "Prism" },
  { name: "Felix M.", action: "bought 1,800 tokens from", store: "Token Shop" },
  { name: "Anya R.", action: "grabbed 30% off at", store: "Lumiere" },
  { name: "Soren K.", action: "grabbed the Mega Pack from", store: "Token Shop" },
];

/* Fake testimonials for the tiers tab (dark pattern: fabricated social proof) */
const FAKE_TESTIMONIALS: Array<{ name: string; tier: Tier; quote: string; initials: string }> = [
  {
    name: "Mira Castellanos",
    tier: "neodymium",
    quote: "I was skeptical at first, but the hidden zones changed everything. Totally worth it.",
    initials: "MC",
  },
  {
    name: "Theo Nakamura",
    tier: "gold",
    quote: "The 2x tokens paid for themselves in a week. Best decision I made this year.",
    initials: "TN",
  },
  {
    name: "Zara Halvorsen",
    tier: "neodymium",
    quote: "Concierge reviews are scary good. It is like they read my mind.",
    initials: "ZH",
  },
];

/* ============================================================================
   Floating entry button — enhanced with pulsing urgency
   ========================================================================== */

export function ShopEntryButton() {
  const showOverlay = useUIStore((s) => s.showOverlay);
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const flashSaleCount = useEconomyStore((s) => s.flashSales.length);

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

  if (activeOverlay !== "none" && activeOverlay !== "shop") return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.7, ease: PREMIUM_EASE }}
      onClick={onOpen}
      aria-label="Open Shop"
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-2.5 ring-2 ring-white transition-all duration-200 active:translate-y-[3px]",
        flashSaleCount > 0
          ? "bg-[#e6009e] shadow-[0_6px_0_#b8007e,0_0_16px_rgba(230,0,158,0.5)] active:shadow-[0_3px_0_#b8007e,0_0_8px_rgba(230,0,158,0.3)]"
          : "bg-[#e6009e] shadow-[0_6px_0_#b8007e] active:shadow-[0_3px_0_#b8007e]"
      )}
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
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-[#e6009e]"
        >
          {flashSaleCount}
        </motion.span>
      )}
    </motion.button>
  );
}

/* ============================================================================
   Overlay — main marketplace container
   ========================================================================== */

export function ShopOverlay() {
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const hideOverlay = useUIStore((s) => s.hideOverlay);
  const flashSales = useEconomyStore((s) => s.flashSales);
  const tokenPacks = useEconomyStore((s) => s.tokenPacks);
  const tokens = usePlayerStore((s) => s.tokens);

  const isOpen = activeOverlay === "shop";
  const [activeTab, setActiveTab] = useState<"deals" | "tokens" | "tiers">("deals");

  const handleTabSwitch = useCallback((tab: "deals" | "tokens" | "tiers") => {
    playSound(SOUNDS.SWOOSH);
    setActiveTab(tab);
  }, []);

  // Dark pattern: always ensure at least one deal is visible when the shop opens
  // so the deals tab is never empty. If all flash sales have expired or been
  // claimed, generate a fresh deficit-priced one.
  useEffect(() => {
    if (!isOpen) return;
    if (useEconomyStore.getState().flashSales.length === 0) {
      useEconomyStore.getState().triggerDeficitFlashSale();
    }
  }, [isOpen]);

  const [prevFlashSalesCount, setPrevFlashSalesCount] = useState(flashSales.length);
  if (flashSales.length !== prevFlashSalesCount) {
    setPrevFlashSalesCount(flashSales.length);
    if (flashSales.length > 0 && activeTab === "tokens") {
      setActiveTab("deals");
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
            className="relative w-full max-w-md max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-t-3xl sm:rounded-3xl bg-white flex flex-col overflow-hidden ring-2 ring-[#141414]/8 shadow-[0_24px_64px_rgba(20,20,20,0.22)]">
              {/* Header with token balance display */}
              <div className="px-6 sm:px-7 pt-6 sm:pt-7 pb-4 bg-white z-10 shrink-0 border-b border-[#141414]/5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <motion.span
                      animate={{ rotate: [0, -8, 8, -4, 0] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e6009e]/12 ring-1 ring-[#e6009e]/30"
                    >
                      <ShoppingBag size={16} weight="fill" className="text-[#e6009e]" />
                    </motion.span>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-[#141414] font-display">
                        Marketplace
                      </h2>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a8a8a]">
                        Exclusive Deals &amp; Upgrades
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Token balance (dark pattern: always visible, creates spending pressure) */}
                    <div className="flex items-center gap-1.5 rounded-full bg-[#ffe600]/20 px-3 py-1.5 ring-1 ring-[#ffe600]/40">
                      <Coins size={14} weight="fill" className="text-[#e6009e]" />
                      <span className="font-mono text-sm font-bold tabular-nums text-[#141414]">
                        {tokens}
                      </span>
                    </div>
                    <button
                      onClick={handleClose}
                      aria-label="Close shop"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#141414]/5 ring-1 ring-[#141414]/10 transition-all duration-200 hover:bg-[#141414]/10 active:scale-[0.96]"
                    >
                      <X size={16} weight="bold" className="text-[#141414]" />
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="mt-5 flex gap-1.5 rounded-xl bg-[#f4f4f5] p-1">
                  <TabButton
                    active={activeTab === "deals"}
                    onClick={() => handleTabSwitch("deals")}
                    accentColor="#e6009e"
                    badge={flashSales.length > 0 ? flashSales.length : undefined}
                    icon={<Tag size={12} weight={activeTab === "deals" ? "fill" : "regular"} />}
                    label="Deals"
                  />
                  <TabButton
                    active={activeTab === "tokens"}
                    onClick={() => handleTabSwitch("tokens")}
                    accentColor="#14b8a6"
                    icon={<Coins size={12} weight={activeTab === "tokens" ? "fill" : "regular"} />}
                    label="Tokens"
                  />
                  <TabButton
                    active={activeTab === "tiers"}
                    onClick={() => handleTabSwitch("tiers")}
                    accentColor="#7c3aed"
                    icon={<Crown size={12} weight={activeTab === "tiers" ? "fill" : "regular"} />}
                    label="Tiers"
                  />
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto px-6 sm:px-7 pb-6 sm:pb-7 flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.25, ease: PREMIUM_EASE }}
                  >
                    {activeTab === "deals" && <ShopDealsTab sales={flashSales} tokens={tokens} />}
                    {activeTab === "tokens" && <ShopBuyTokensTab packs={tokenPacks} tokens={tokens} />}
                    {activeTab === "tiers" && <ShopTiersTab />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
   Shared Tab Button
   ========================================================================== */

function TabButton({
  active,
  onClick,
  accentColor,
  badge,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  accentColor: string;
  badge?: number;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-all",
        active
          ? "bg-white shadow-sm ring-1 ring-[#141414]/5"
          : "text-[#8a8a8a] hover:text-[#4b4b4b]"
      )}
      style={active ? { color: accentColor } : undefined}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span
          className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
          style={{ backgroundColor: accentColor }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* ============================================================================
   Deals Tab — with live purchase ticker, price anchoring, scarcity
   ========================================================================== */

function ShopDealsTab({ sales, tokens }: { sales: FlashSale[]; tokens: number }) {
  const alerts = useSocialStore((s) => s.proximityAlerts);
  const dismissAlert = useSocialStore((s) => s.dismissProximityAlert);
  const latestAlert = alerts[alerts.length - 1];

  return (
    <div className="space-y-4 pt-4">
      {/* Inline proximity alert strip — keeps rank pressure visible at the
          moment of purchase decision (dark pattern: social comparison) */}
      {latestAlert && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: PREMIUM_EASE }}
          className="flex items-center gap-2.5 rounded-xl bg-[#141414] px-3.5 py-2.5 ring-1 ring-[#ffffff]/10"
        >
          <motion.span
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: PREMIUM_EASE }}
          >
            <CaretUp size={13} weight="bold" className="text-[#e6b800] shrink-0" />
          </motion.span>
          <span className="flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
            {latestAlert.message}
          </span>
          <button
            onClick={() => dismissAlert(latestAlert.id)}
            aria-label="Dismiss rank alert"
            className="text-[#8a8a8a] transition-colors hover:text-white"
          >
            <X size={12} weight="bold" />
          </button>
        </motion.div>
      )}
      <LivePurchaseTicker />
      {sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Tag size={36} weight="light" className="text-[#8a8a8a] mb-3" />
          </motion.div>
          <p className="text-sm font-semibold text-[#4b4b4b]">No active deals right now.</p>
          <p className="text-xs text-[#8a8a8a] mt-1 max-w-[28ch]">
            Keep exploring the mall. New flash sales appear when you least expect them.
          </p>
        </div>
      ) : (
        sales.map((sale, i) => (
          <motion.div
            key={sale.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: PREMIUM_EASE }}
          >
            <ShopDealCard sale={sale} tokens={tokens} />
          </motion.div>
        ))
      )}
    </div>
  );
}

/* Live purchase ticker — dark pattern: fabricated social proof */
function LivePurchaseTicker() {
  const [currentTick, setCurrentTick] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycleInterval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentTick((prev) => (prev + 1) % FAKE_PURCHASERS.length);
        setVisible(true);
      }, 300);
    }, 4500);
    return () => clearInterval(cycleInterval);
  }, []);

  const purchase = FAKE_PURCHASERS[currentTick]!;

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key={currentTick}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.3, ease: PREMIUM_EASE }}
          className="flex items-center gap-2.5 rounded-xl bg-[#f4f4f5] px-3 py-2 ring-1 ring-[#141414]/5"
        >
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#14b8a6]/15"
          >
            <CheckCircle size={12} weight="fill" className="text-[#14b8a6]" />
          </motion.span>
          <p className="text-[11px] leading-tight text-[#4b4b4b] flex-1">
            <span className="font-bold text-[#141414]">{purchase.name}</span>{" "}
            {purchase.action}{" "}
            <span className="font-bold text-[#e6009e]">{purchase.store}</span>
          </p>
          <span className="text-[9px] uppercase tracking-wider text-[#8a8a8a] font-medium shrink-0">
            just now
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ShopDealCard({ sale, tokens }: { sale: FlashSale; tokens: number }) {
  const store = getStoreById(sale.storeId);
  const canAfford = tokens >= sale.tokenCost;
  const shortfall = Math.max(0, sale.tokenCost - tokens);
  const [claimed, setClaimed] = useState(sale.claimed ?? false);
  const [liveViewers, setLiveViewers] = useState(sale.socialProof ?? 23);
  const [stockLeft, setStockLeft] = useState(() => 3 + Math.floor(Math.random() * 5));

  // Dark pattern: fake "retail value" for price anchoring
  const [fakeRetailValue] = useState(() =>
    Math.ceil(sale.tokenCost * (1.8 + Math.random() * 0.6))
  );
  const savingsPercent = Math.round(
    ((fakeRetailValue - sale.tokenCost) / fakeRetailValue) * 100
  );

  // Dark pattern: live viewers fluctuate to create false urgency
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveViewers((prev) => {
        const change = Math.random() > 0.4 ? 1 : -1;
        const newVal = prev + change;
        return newVal > 3 ? newVal : 4;
      });
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  // Dark pattern: stock decreases over time (scarcity)
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setStockLeft((prev) => Math.max(1, prev - 1));
      }
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const onExpire = useCallback(() => expireFlashSale(sale.id), [sale.id]);
  const onDismiss = useCallback(() => dismissFlashSale(sale.id), [sale.id]);

  const onGrab = useCallback(() => {
    const cost = sale.tokenCost;
    const storeName = store?.name;
    const ok = claimFlashSale(sale.id, { showFeedback: false });
    if (ok) {
      setClaimed(true);
      // Shop overlay stays open — toast renders from the parallel queue at
      // z-50 on top of the sheet, so context is preserved.
      setTimeout(() => {
        showTokenFeedback("spend", cost, `Deal Claimed! -${cost} Tokens`, {
          label: storeName,
        });
      }, 1000);
    }
  }, [sale, store]);

  // Navigate to the trending feed, scrolled to this store's product video
  const onWatch = useCallback(() => {
    setTimelineTargetStore(sale.storeId);
    useUIStore.getState().hideOverlay();
    useUIStore.getState().setTimelineOpen(true);
  }, [sale.storeId]);

  return (
    <div className="rounded-2xl bg-white ring-1 ring-[#141414]/10 shadow-sm overflow-hidden transition-all">
      {/* Top banner with discount + scarcity */}
      <div className="relative p-4 border-b border-[#141414]/5 bg-gradient-to-r from-[#ffe600]/25 via-[#ffe600]/8 to-transparent">
        {/* Dark pattern: animated "selling fast" badge */}
        {stockLeft <= 2 && !claimed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-3 right-12 flex items-center gap-1 rounded-full bg-[#ef4444] px-2 py-0.5"
          >
            <Fire size={10} weight="fill" className="text-white" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-white">
              Selling Fast
            </span>
          </motion.div>
        )}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block rounded-full bg-[#e6009e]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] font-bold text-[#e6009e]">
                Flash Sale
              </span>
              <span className="inline-block rounded-full bg-[#141414]/8 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] font-bold text-[#4b4b4b]">
                {store?.category}
              </span>
            </div>
            <h3 className="text-base font-bold text-[#141414] leading-tight">
              {store?.name ?? "Exclusive Deal"}
            </h3>
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 text-[#8a8a8a] hover:bg-[#141414]/5 rounded-full transition-colors shrink-0"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Discount + item description */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <p className="font-mono text-2xl font-bold tabular-nums text-[#e6009e] leading-none">
              {sale.discount}
            </p>
            {/* Dark pattern: stock counter */}
            <span className="text-[10px] font-medium text-[#8a8a8a]">
              {stockLeft} left
            </span>
          </div>
          <p className="text-xs leading-relaxed text-[#4b4b4b] mt-1">
            {sale.itemDescription}
          </p>
        </div>

        {/* Price anchoring: fake retail value crossed out */}
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#f4f4f5] px-3 py-2 ring-1 ring-[#141414]/5">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-sm text-[#8a8a8a] line-through tabular-nums">
              {fakeRetailValue}
            </span>
            <Coins size={11} weight="fill" className="text-[#8a8a8a]" />
            <span className="font-mono text-sm font-bold text-[#e6009e] tabular-nums">
              {sale.tokenCost}
            </span>
            <Coins size={11} weight="fill" className="text-[#e6009e]" />
            <span className="text-[10px] font-bold text-[#14b8a6]">
              Save {savingsPercent}%
            </span>
          </div>
        </div>

        {/* Urgency row: countdown + viewers */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 rounded-xl bg-[#f4f4f5] px-3 py-2 flex items-center justify-between ring-1 ring-[#141414]/5">
            <Timer size={14} weight="fill" className="text-[#e6009e]" />
            <Countdown remaining={sale.countdownSeconds} onExpire={onExpire} />
          </div>
          <div className="flex-1 rounded-xl bg-[#f4f4f5] px-3 py-2 flex items-center justify-between ring-1 ring-[#141414]/5">
            <Eye size={14} weight="fill" className="text-[#14b8a6]" />
            <p className="font-mono text-sm font-bold tabular-nums text-[#141414]">
              {liveViewers}{" "}
              <span className="text-[10px] font-sans font-normal text-[#8a8a8a]">viewing</span>
            </p>
          </div>
        </div>

        {/* Watch product video — navigates to trending feed */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onWatch}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#141414]/5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#141414] ring-1 ring-[#141414]/10 transition-all hover:bg-[#141414]/8 active:scale-[0.98] mb-4"
        >
          <PlayCircle size={16} weight="fill" className="text-[#e6009e]" />
          Watch Product Video
        </motion.button>

        {/* CTA */}
        {claimed ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#14b8a6]/10 px-4 py-3 ring-1 ring-[#14b8a6]/30"
          >
            <CheckCircle size={16} weight="fill" className="text-[#14b8a6]" />
            <span className="text-xs font-semibold tracking-tight text-[#14b8a6]">
              Deal Claimed!
            </span>
          </motion.div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-lg font-bold tabular-nums text-[#e6009e]">
                {sale.tokenCost}
              </p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8a8a]">Tokens</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onGrab}
              disabled={!canAfford}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] transition-all",
                canAfford
                  ? "bg-[#e6009e] text-white shadow-[0_4px_0_#b8007e] hover:bg-[#f30aac] active:translate-y-[2px] active:shadow-[0_2px_0_#b8007e]"
                  : "bg-[#f4f4f5] text-[#8a8a8a] cursor-not-allowed"
              )}
            >
              {canAfford ? (
                <>
                  Grab Deal <ArrowRight size={12} weight="bold" />
                </>
              ) : (
                `${shortfall} more`
              )}
            </motion.button>
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
  const isUrgent = remaining <= 30;

  return (
    <p
      className={cn(
        "font-mono text-sm font-bold tabular-nums text-[#141414]",
        isUrgent && "animate-countdown-urgency"
      )}
    >
      {timeStr}
    </p>
  );
}

/* ============================================================================
   Buy Tokens Tab — real-money token packs with maximum dark patterns

   Dark patterns deployed:
   1. Currency obfuscation (gems ↔ USD, non-round conversion)
   2. Decoy pricing ladder (Saver pack is worst value, makes Popular look good)
   3. Fake "limited time" bonus event (cycles endlessly, never expires)
   4. Deficit-aware prompt ("you need X more for [deal]")
   5. First-time buyer trap (300% bonus that never gets consumed)
   6. Live purchase ticker (fake social proof)
   7. Loss aversion + leaderboard pressure
   8. Fake scarcity on whale pack
   9. Confirmshaming decline
   10. Drip bonus bait
   11. Hidden processing fee at "checkout"
   ========================================================================== */

function ShopBuyTokensTab({ packs, tokens }: { packs: TokenPack[]; tokens: number }) {
  const bonusMultiplier = useEconomyStore((s) => s.bonusEventMultiplier);
  const bonusEndsAt = useEconomyStore((s) => s.bonusEventEndsAt);
  const advanceBonusEvent = useEconomyStore((s) => s.advanceBonusEvent);
  const decrementWhaleStock = useEconomyStore((s) => s.decrementWhaleStock);

  // Fake "X people bought tokens" counter (social proof)
  const [purchaseCount, setPurchaseCount] = useState(2347);
  useEffect(() => {
    const interval = setInterval(() => {
      setPurchaseCount((prev) => prev + Math.floor(Math.random() * 3) + 1);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  // Fake bonus event countdown (cycles endlessly)
  const [bonusCountdown, setBonusCountdown] = useState(() =>
    Math.max(0, Math.floor((bonusEndsAt - Date.now()) / 1000))
  );
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((bonusEndsAt - Date.now()) / 1000));
      setBonusCountdown(remaining);
      if (remaining <= 0) {
        advanceBonusEvent();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [bonusEndsAt, advanceBonusEvent]);

  // Fake whale pack scarcity (decrements over time, restocks cyclically)
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.6) {
        decrementWhaleStock();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [decrementWhaleStock]);

  return (
    <div className="space-y-4 pt-4">
      {/* Dark pattern: fake limited-time bonus event banner */}
      <BonusEventBanner multiplier={bonusMultiplier} countdownSeconds={bonusCountdown} />

      {/* Dark pattern: fake live purchase counter */}
      <TokenPurchaseCounter count={purchaseCount} />

      {/* Dark pattern: leaderboard pressure */}
      <LeaderboardPressureBar tokens={tokens} />

      {/* Dark pattern: deficit-aware prompt */}
      <DeficitPrompt tokens={tokens} />

      {/* Token pack grid — staggered for upselling: cheaper packs appear
          first, premium packs (Mega/Whale) arrive last with extra delay */}
      {packs.map((pack, i) => (
        <motion.div
          key={pack.id}
          initial={{ opacity: 0, y: 16, scale: pack.highlighted || pack.id === "pack-whale" ? 0.96 : 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.45,
            delay: i * 0.08 + (i >= 4 ? 0.12 : 0),
            ease: PREMIUM_EASE,
          }}
        >
          <TokenPackCard pack={pack} bonusMultiplier={bonusMultiplier} />
        </motion.div>
      ))}

      {/* Dark pattern: drip bonus offer */}
      <DripBonusOffer />

      {/* Dark pattern: confirmshaming decline */}
      <div className="pt-1">
        <p className="text-center text-[10px] text-[#8a8a8a] cursor-pointer hover:underline transition-all">
          No thanks, I&apos;d rather grind for 3 hours to earn 50 tokens
        </p>
      </div>

      {/* Dark pattern: hidden fine print */}
      <div className="rounded-xl bg-[#f4f4f5] px-4 py-3 ring-1 ring-[#141414]/5">
        <p className="text-[9px] leading-relaxed text-[#8a8a8a]">
          Token pack purchases are non-refundable. Gems are a virtual currency
          with no cash value. Bonus percentages are calculated against an
          internal reference rate, not actual market value. Processing fees
          may apply at checkout. Drip bonus tokens are distributed over 7
          days and forfeited if the account is inactive for 24 hours.
        </p>
      </div>
    </div>
  );
}

/* Fake "MEGA BONUS EVENT" banner with cycling countdown (dark pattern: fake urgency) */
function BonusEventBanner({
  multiplier,
  countdownSeconds,
}: {
  multiplier: number;
  countdownSeconds: number;
}) {
  const mm = Math.floor(countdownSeconds / 60);
  const ss = countdownSeconds % 60;
  const timeStr = `${mm}:${ss.toString().padStart(2, "0")}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#14b8a6] to-[#0d9488] px-4 py-3 text-white shadow-sm shadow-[#14b8a6]/20 overflow-hidden"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-full h-full w-1/2 bg-gradient-to-r from-transparent to-white/15 animate-spotlight-sweep" />
      </div>
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="shrink-0"
      >
        <Diamond size={20} weight="fill" className="text-white" />
      </motion.div>
      <div className="flex-1 relative z-10">
        <p className="text-xs font-bold tracking-wide">
          +{multiplier}% BONUS TOKENS EVENT!
        </p>
        <p className="text-[10px] opacity-90 mt-0.5">
          Ends in{" "}
          <span className="font-mono font-bold tabular-nums">{timeStr}</span>{" "}
          — don&apos;t miss out!
        </p>
      </div>
    </motion.div>
  );
}

/* Fake live purchase counter (dark pattern: social proof) */
function TokenPurchaseCounter({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-[#f4f4f5] px-3 py-2 ring-1 ring-[#141414]/5">
      <motion.span
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#14b8a6]/15"
      >
        <CheckCircle size={12} weight="fill" className="text-[#14b8a6]" />
      </motion.span>
      <p className="text-[11px] leading-tight text-[#4b4b4b] flex-1">
        <motion.span
          key={count}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="font-mono tabular-nums font-bold text-[#14b8a6]"
        >
          {count.toLocaleString()}
        </motion.span>{" "}
        token packs purchased in the last hour
      </p>
    </div>
  );
}

/* Leaderboard pressure (dark pattern: loss aversion + social comparison) */
function LeaderboardPressureBar({ tokens }: { tokens: number }) {
  const leaderboard = useSocialStore((s) => s.leaderboard);
  const playerEntry = leaderboard.find((e) => e.isPlayer);
  const playerRank = playerEntry?.rank ?? 0;

  // Find the next person above on the leaderboard
  const above = playerRank > 1
    ? leaderboard.find((e) => e.rank === playerRank - 1)
    : null;

  if (!above) return null;

  const gap = Math.max(0, above.tokenCount - tokens);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 rounded-xl bg-[#ef4444]/8 px-4 py-3 ring-1 ring-[#ef4444]/20"
    >
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ef4444]/15"
      >
        <TrendUp size={16} weight="bold" className="text-[#ef4444]" />
      </motion.div>
      <div className="flex-1">
        <p className="text-[11px] font-bold text-[#141414]">
          Only{" "}
          <span className="font-mono text-[#ef4444] tabular-nums">{gap}</span>{" "}
          tokens behind #{playerRank - 1}
        </p>
        <p className="text-[10px] text-[#8a8a8a] mt-0.5">
          Buy tokens now to overtake {above.name} on the leaderboard
        </p>
      </div>
    </motion.div>
  );
}

/* Deficit-aware prompt (dark pattern: contextual "you need X more" CTA) */
function DeficitPrompt({ tokens }: { tokens: number }) {
  const flashSales = useEconomyStore((s) => s.flashSales);
  const nearestSale = flashSales[0];

  if (!nearestSale) return null;
  const store = getStoreById(nearestSale.storeId);
  const shortfall = Math.max(0, nearestSale.tokenCost - tokens);
  if (shortfall <= 0) return null;

  // Find the cheapest pack that covers the shortfall
  const cheapestCover = TOKEN_PACKS.find((p) => p.tokenAmount >= shortfall);
  if (!cheapestCover) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-gradient-to-r from-[#ffe600]/15 to-[#14b8a6]/8 px-4 py-3 ring-1 ring-[#ffe600]/30"
    >
      <div className="flex items-center gap-2 mb-1">
        <Wallet size={14} weight="fill" className="text-[#e6009e]" />
        <p className="text-[11px] font-bold text-[#141414]">
          You need {shortfall} more tokens for {store?.name ?? "this deal"}
        </p>
      </div>
      <p className="text-[10px] text-[#4b4b4b]">
        Get{" "}
        <span className="font-bold text-[#14b8a6]">{cheapestCover.tokenAmount} tokens</span>{" "}
        for just{" "}
        <span className="font-mono font-bold text-[#141414]">${cheapestCover.price}</span>{" "}
        — covers your deal and leaves extra for next time
      </p>
    </motion.div>
  );
}

/* Token pack card (dark pattern: price anchoring, gems obfuscation, fake badges) */
function TokenPackCard({
  pack,
  bonusMultiplier,
}: {
  pack: TokenPack;
  bonusMultiplier: number;
}) {
  const [purchasing, setPurchasing] = useState(false);
  const [showFeeDialog, setShowFeeDialog] = useState(false);

  // Dark pattern: fake "X people bought this" per-pack counter
  const [boughtCount] = useState(() => 50 + Math.floor(Math.random() * 2400));
  // Dark pattern: fake per-pack "viewing" count that fluctuates
  const [liveViewers, setLiveViewers] = useState(() => 8 + Math.floor(Math.random() * 30));

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveViewers((prev) => {
        const change = Math.random() > 0.4 ? 1 : -1;
        return Math.max(3, prev + change);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const onBuy = useCallback(() => {
    setShowFeeDialog(true);
  }, []);

  const onConfirmPurchase = useCallback(() => {
    if (purchasing) return;
    setPurchasing(true);
    buyTokenPack(pack.id);
    setTimeout(() => {
      setPurchasing(false);
      setShowFeeDialog(false);
    }, 600);
  }, [pack.id, purchasing]);

  const isHighlighted = pack.highlighted;
  const isWhale = pack.id === "pack-whale";
  const isPremium = isHighlighted || isWhale;
  const isFirstPurchase = pack.firstPurchaseBonus;
  const scarcityLow = pack.stockLeft !== undefined && pack.stockLeft <= 2;

  // The "regular" (pre-bonus) token amount for the crossed-out display
  const regularAmount = Math.round(pack.tokenAmount / (1 + bonusMultiplier / 100));

  return (
    <div
      className={cn(
        "rounded-2xl p-4 relative overflow-hidden transition-all",
        isHighlighted
          ? "bg-gradient-to-br from-[#14b8a6]/10 to-[#e6009e]/8 ring-2 ring-[#14b8a6]/30 hover:ring-[#14b8a6]/50 shadow-[0_4px_20px_rgba(20,184,166,0.08)]"
          : isWhale
            ? "bg-gradient-to-br from-[#141414]/3 to-[#14b8a6]/5 ring-2 ring-[#141414]/15 hover:ring-[#14b8a6]/30 shadow-[0_4px_20px_rgba(20,20,20,0.06)]"
            : "bg-white ring-1 ring-[#141414]/10 hover:ring-[#141414]/20"
      )}
    >
      {/* Premium shimmer sweep for Mega and Whale packs */}
      {isPremium && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
          <div className="absolute top-0 -left-full h-full w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-spotlight-sweep" />
        </div>
      )}

      {/* Decorative coin icon */}
      <div className="absolute top-0 right-0 p-4 opacity-[0.06]">
        <Coins size={64} weight="fill" className="text-[#14b8a6]" />
      </div>

      <div className="relative z-10">
        {/* Top row: badges */}
        <div className="mb-2 flex items-center gap-2 flex-wrap">
          <span className="text-base font-bold text-[#141414]">{pack.name}</span>
          {pack.badge && (
            <motion.span
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white",
                isHighlighted ? "bg-[#14b8a6]" : isWhale ? "bg-[#141414]" : "bg-[#e6009e]"
              )}
            >
              {isPremium && <Sparkle size={8} weight="fill" />}
              {pack.badge}
            </motion.span>
          )}
          {isFirstPurchase && (
            <motion.span
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="flex items-center gap-1 rounded-full bg-[#ef4444] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
            >
              <Fire size={8} weight="fill" /> 300% FIRST BONUS
            </motion.span>
          )}
          {scarcityLow && (
            <span className="flex items-center gap-1 rounded-full bg-[#ef4444] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              <Fire size={8} weight="fill" /> Only {pack.stockLeft} left!
            </span>
          )}
        </div>

        <p className="mb-3 text-xs leading-relaxed text-[#4b4b4b] pr-12">{pack.description}</p>

        {/* Dark pattern: fake "bought this week" + live viewers */}
        <div className="mb-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Eye size={11} weight="fill" className="text-[#8a8a8a]" />
            <span className="text-[10px] text-[#8a8a8a]">
              <span className="font-bold text-[#4b4b4b] font-mono tabular-nums">
                {liveViewers}
              </span>{" "}
              viewing
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle size={11} weight="fill" className="text-[#14b8a6]" />
            <span className="text-[10px] text-[#8a8a8a]">
              <span className="font-bold text-[#4b4b4b] font-mono tabular-nums">
                {boughtCount.toLocaleString()}
              </span>{" "}
              bought this week
            </span>
          </div>
        </div>

        {/* Token amount with fake bonus anchoring */}
        <div className="mb-3 flex items-baseline gap-2">
          <span className="font-mono text-sm text-[#8a8a8a] line-through tabular-nums">
            {regularAmount}
          </span>
          <Coins size={12} weight="fill" className="text-[#8a8a8a]" />
          <span className="font-mono text-2xl font-bold tabular-nums text-[#14b8a6]">
            {pack.tokenAmount}
          </span>
          <Coins size={14} weight="fill" className="text-[#14b8a6]" />
          <span className="text-[10px] font-bold text-[#14b8a6]">
            +{bonusPercentDisplay(pack, bonusMultiplier)}% BONUS
          </span>
        </div>

        {/* Price block: USD (small) + gems (prominent) — dark pattern: currency obfuscation */}
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#f4f4f5] px-3 py-2 ring-1 ring-[#141414]/5">
          <div className="flex items-baseline gap-1.5">
            <Diamond size={12} weight="fill" className="text-[#14b8a6]" />
            <span className="font-mono text-lg font-bold tabular-nums text-[#141414]">
              {pack.gemsPrice.toLocaleString()}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-[#8a8a8a]">gems</span>
          </div>
          <div className="ml-auto flex items-baseline gap-1">
            <span className="text-[9px] text-[#8a8a8a]">≈</span>
            <span className="font-mono text-xs text-[#8a8a8a]">
              ${pack.price.toFixed(2)}
            </span>
          </div>
          {/* Dark pattern: fake retail price crossed out */}
          <span className="font-mono text-[10px] text-[#8a8a8a] line-through tabular-nums">
            ${pack.fakeRetailPrice.toFixed(2)}
          </span>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#8a8a8a]">
              <span className="font-mono font-bold text-[#14b8a6]">
                ${(pack.price / pack.tokenAmount * 100).toFixed(2)}
              </span>{" "}
              per 100 tokens
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onBuy}
            disabled={purchasing}
            className={cn(
              "flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] transition-all",
              purchasing
                ? "scale-95 bg-[#14b8a6]/50 text-white"
                : isHighlighted
                  ? "bg-gradient-to-r from-[#14b8a6] to-[#0d9488] text-white shadow-[0_4px_12px_rgba(20,184,166,0.30)] hover:shadow-[0_6px_18px_rgba(20,184,166,0.40)] active:scale-95"
                  : "bg-[#14b8a6] text-white shadow-[0_4px_0_#0d9488] hover:bg-[#0d9488] active:translate-y-[2px] active:shadow-[0_2px_0_#0d9488]"
            )}
          >
            {purchasing ? (
              "Processing..."
            ) : (
              <>
                <CreditCard size={14} weight="fill" />
                Buy Now
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Dark pattern: hidden processing fee dialog (confirmshaming + fee reveal) */}
      <AnimatePresence>
        {showFeeDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-2xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
              transition={{ duration: 0.25, ease: PREMIUM_EASE }}
              className="w-full p-5 text-center"
            >
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-[#14b8a6]/10 ring-2 ring-[#14b8a6]/30 mb-3">
                <CreditCard size={24} weight="fill" className="text-[#14b8a6]" />
              </div>
              <h4 className="text-sm font-bold text-[#141414] mb-1">Confirm Purchase</h4>
              <p className="text-[11px] text-[#4b4b4b] mb-3">{pack.name}</p>
              {/* Fee breakdown — dark pattern: hidden until this dialog */}
              <div className="rounded-xl bg-[#f4f4f5] p-3 mb-3 text-left">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#8a8a8a]">Pack price</span>
                  <span className="font-mono font-bold text-[#141414]">${pack.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#8a8a8a]">Processing fee</span>
                  <span className="font-mono text-[#8a8a8a]">$0.99</span>
                </div>
                <div className="border-t border-[#141414]/8 pt-1.5 flex justify-between">
                  <span className="text-[11px] font-bold text-[#141414]">Total</span>
                  <span className="font-mono text-sm font-bold text-[#14b8a6]">
                    ${(pack.price + 0.99).toFixed(2)}
                  </span>
                </div>
              </div>
              {/* Pre-checked "save card" (dark pattern: default opt-in) */}
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#14b8a6]" />
                <span className="text-[10px] text-[#8a8a8a]">
                  Save card for 1-click future purchases
                </span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFeeDialog(false)}
                  className="flex-1 rounded-full bg-[#f4f4f5] py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#8a8a8a] transition-all hover:bg-[#141414]/5"
                >
                  Maybe later
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onConfirmPurchase}
                  disabled={purchasing}
                  className="flex-1 rounded-full bg-[#14b8a6] py-2.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_3px_0_#0d9488] active:translate-y-[1px] active:shadow-[0_1px_0_#0d9488] transition-all"
                >
                  {purchasing ? "Processing..." : `Pay $${(pack.price + 0.99).toFixed(2)}`}
                </motion.button>
              </div>
              {/* Dark pattern: tiny auto-renew notice */}
              <p className="text-[8px] text-[#8a8a8a] mt-2">
                By clicking Pay you agree to auto-renewal terms. Cancel anytime in settings.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Compute the displayed bonus percentage (combines pack base + event multiplier) */
function bonusPercentDisplay(pack: TokenPack, eventMultiplier: number): number {
  return pack.bonusPercent + eventMultiplier;
}

/* Drip bonus offer (dark pattern: looks like extra but creates daily return habit) */
function DripBonusOffer() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3, ease: PREMIUM_EASE }}
      className="rounded-2xl bg-[#ffe600]/15 p-4 ring-2 ring-[#ffe600]/40 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <Gift size={56} weight="fill" className="text-[#14b8a6]" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#ffe600]/30 text-[#14b8a6]">
            <Gift size={16} weight="fill" />
          </span>
          <div>
            <span className="text-sm font-bold text-[#141414]">Daily Drip Bonus</span>
            <p className="text-[10px] text-[#8a8a8a]">Buy any Mega Pack and get 100 bonus tokens/day for 7 days</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-sm text-[#8a8a8a] line-through tabular-nums">2,500</span>
          <Coins size={12} weight="fill" className="text-[#8a8a8a]" />
          <span className="font-mono text-2xl font-bold tabular-nums text-[#14b8a6]">1,800</span>
          <Coins size={14} weight="fill" className="text-[#14b8a6]" />
          <span className="text-[10px] font-bold text-[#14b8a6]">+700 drip bonus</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="flex-1 rounded-full bg-[#14b8a6] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_4px_0_#0d9488] active:translate-y-[2px] active:shadow-[0_2px_0_#0d9488] transition-all"
          >
            Grab Drip Bonus
          </motion.button>
          <span className="text-[9px] text-[#8a8a8a] max-w-[12ch] text-right leading-tight">
            63 claimed today
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
   Tiers Tab — completely redesigned with 4 tiers, dark patterns galore
   ========================================================================== */

function ShopTiersTab() {
  const setTier = usePlayerStore((s) => s.setTier);
  const currentTier = usePlayerStore((s) => s.tier);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedTier, setSelectedTier] = useState<Tier>("neodymium");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");

  // Dark pattern: fake scarcity countdown
  const [countdown, setCountdown] = useState(14 * 60 + 59);
  // Dark pattern: fake spots left that occasionally decrease
  const [fakeSpotsLeft, setFakeSpotsLeft] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.75) {
        setFakeSpotsLeft((prev) => Math.max(1, prev - 1));
      }
    }, 9000);
    return () => clearInterval(interval);
  }, []);

  const handleSubscribe = () => {
    setPurchasing(true);
    setTimeout(() => {
      setTier(selectedTier);
      setPurchasing(false);
    }, 800);
  };

  const isSubscribed = currentTier === selectedTier && currentTier !== "bronze";

  const mm = Math.floor(countdown / 60);
  const ss = countdown % 60;
  const timeStr = `${mm}:${ss.toString().padStart(2, "0")}`;

  const pricing = TIER_PRICING[selectedTier]!;
  const displayPrice =
    billingCycle === "annual" ? pricing.monthlyEquivalent : pricing.monthly;

  // Dark pattern: loss aversion calculator
  const currentMultiplier =
    currentTier === "bronze"
      ? 1
      : currentTier === "silver"
        ? 1.5
        : currentTier === "gold"
          ? 2
          : 3;
  const selectedMultiplier =
    selectedTier === "bronze"
      ? 1
      : selectedTier === "silver"
        ? 1.5
        : selectedTier === "gold"
          ? 2
          : 3;
  const tokensLostPerDay = Math.max(
    0,
    Math.round((selectedMultiplier - currentMultiplier) * 47)
  );

  if (isSubscribed) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center pt-4">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7c3aed]/10 ring-2 ring-[#7c3aed]/30 mb-4"
        >
          <Sparkle size={32} weight="fill" className="text-[#7c3aed]" />
        </motion.div>
        <h3 className="text-xl font-bold font-display text-[#141414] mb-2 capitalize">
          Welcome to {selectedTier}
        </h3>
        <p className="text-sm font-medium text-[#4b4b4b] mb-6 px-4 max-w-[32ch]">
          You are an active subscriber. Enjoy your enhanced rewards and exclusive access.
        </p>
        <div className="rounded-xl bg-[#f4f4f5] px-6 py-3 ring-1 ring-[#141414]/10">
          <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#8a8a8a]">
            Subscription Active
          </p>
          <p className="font-mono text-sm font-bold mt-1 text-[#141414]">
            ${pricing.monthly.toFixed(2)} / mo
          </p>
        </div>
        {/* Dark pattern: hidden auto-renew notice */}
        <p className="text-center text-[9px] text-[#8a8a8a] mt-4 max-w-[30ch]">
          Auto-renews {billingCycle === "annual" ? "annually" : "monthly"}. Cancel anytime
          in settings (processing fee may apply).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {/* FOMO Urgency Banner */}
      <UrgencyBanner spotsLeft={fakeSpotsLeft} timeStr={timeStr} />

      {/* Loss Aversion Calculator (dark pattern) */}
      {currentTier !== "neodymium" && (
        <LossAversionCard
          tokensLostPerDay={tokensLostPerDay}
          targetTier={selectedTier}
        />
      )}

      {/* Billing Toggle (dark pattern: defaults to annual) */}
      <BillingToggle cycle={billingCycle} onChange={setBillingCycle} />

      {/* Tier selector — horizontal scroll with all 4 tiers */}
      <TierSelector
        selectedTier={selectedTier}
        onSelect={setSelectedTier}
        billingCycle={billingCycle}
        currentTier={currentTier}
      />

      {/* Selected tier detail card */}
      <TierDetailCard
        tier={selectedTier}
        pricing={pricing}
        billingCycle={billingCycle}
        displayPrice={displayPrice}
        purchasing={purchasing}
        onSubscribe={handleSubscribe}
        currentTier={currentTier}
      />

      {/* Tier comparison strip */}
      <TierComparisonStrip
        selectedTier={selectedTier}
        billingCycle={billingCycle}
        onSelect={setSelectedTier}
      />

      {/* Fake testimonials */}
      <FakeTestimonials />

      {/* Confirmshaming opt-out (dark pattern) */}
      <div className="pt-2">
        <p className="text-center text-[10px] text-[#8a8a8a] cursor-pointer hover:underline transition-all">
          No thanks, I prefer the limited free experience with ads and restricted access.
        </p>
      </div>

      {/* Fine print (dark pattern: hidden terms) */}
      <div className="rounded-xl bg-[#f4f4f5] px-4 py-3 ring-1 ring-[#141414]/5">
        <p className="text-[9px] leading-relaxed text-[#8a8a8a]">
          By subscribing you agree to a 12-month commitment. Plan auto-renews at the full
          rate after the initial period. Early termination fees of $89.99 apply. Token
          multipliers are calculated on base rewards and do not stack with promotional
          bonuses. Hidden zones require Neodymium tier and may be rotated without notice.
          Savings percentages compare to an internal reference price, not actual market
          value.
        </p>
      </div>
    </div>
  );
}

/* FOMO Urgency Banner */
function UrgencyBanner({ spotsLeft, timeStr }: { spotsLeft: number; timeStr: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#e6009e] to-[#ff0055] px-4 py-3 text-white shadow-sm shadow-[#e6009e]/20 overflow-hidden"
    >
      {/* Animated sweep effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-full h-full w-1/2 bg-gradient-to-r from-transparent to-white/15 animate-spotlight-sweep" />
      </div>
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="shrink-0"
      >
        <Warning size={20} weight="fill" className="text-white" />
      </motion.div>
      <div className="flex-1 relative z-10">
        <p className="text-xs font-bold tracking-wide">
          ONLY {spotsLeft} FOUNDING SPOTS LEFT IN YOUR AREA!
        </p>
        <p className="text-[10px] opacity-90 mt-0.5">
          Founding member pricing expires in{" "}
          <span className="font-mono font-bold tabular-nums">{timeStr}</span>
        </p>
      </div>
    </motion.div>
  );
}

/* Loss Aversion Card — dark pattern: "you are losing tokens" */
function LossAversionCard({
  tokensLostPerDay,
  targetTier,
}: {
  tokensLostPerDay: number;
  targetTier: Tier;
}) {
  if (tokensLostPerDay <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 rounded-xl bg-[#ef4444]/8 px-4 py-3 ring-1 ring-[#ef4444]/20"
    >
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ef4444]/15"
      >
        <TrendDown size={16} weight="bold" className="text-[#ef4444]" />
      </motion.div>
      <div className="flex-1">
        <p className="text-[11px] font-bold text-[#141414]">
          You are losing{" "}
          <span className="font-mono text-[#ef4444] tabular-nums">
            {tokensLostPerDay}
          </span>{" "}
          tokens/day
        </p>
        <p className="text-[10px] text-[#8a8a8a] mt-0.5">
          By staying on your current tier instead of{" "}
          <span className="font-bold capitalize text-[#4b4b4b]">{targetTier}</span>
        </p>
      </div>
    </motion.div>
  );
}

/* Billing Toggle — dark pattern: defaults to annual, shows fake savings */
function BillingToggle({
  cycle,
  onChange,
}: {
  cycle: "monthly" | "annual";
  onChange: (c: "monthly" | "annual") => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex gap-1.5 rounded-xl bg-[#f4f4f5] p-1 flex-1">
        <button
          onClick={() => onChange("monthly")}
          className={cn(
            "flex-1 rounded-lg py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-all",
            cycle === "monthly"
              ? "bg-white text-[#141414] shadow-sm ring-1 ring-[#141414]/5"
              : "text-[#8a8a8a] hover:text-[#4b4b4b]"
          )}
        >
          Monthly
        </button>
        <button
          onClick={() => onChange("annual")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-all",
            cycle === "annual"
              ? "bg-white text-[#141414] shadow-sm ring-1 ring-[#141414]/5"
              : "text-[#8a8a8a] hover:text-[#4b4b4b]"
          )}
        >
          Annual
          <span className="rounded-full bg-[#14b8a6] px-1.5 py-0.5 text-[8px] text-white font-bold">
            -33%
          </span>
        </button>
      </div>
    </div>
  );
}

/* Tier Selector — horizontal scrollable cards for all 4 tiers */
function TierSelector({
  selectedTier,
  onSelect,
  billingCycle,
  currentTier,
}: {
  selectedTier: Tier;
  onSelect: (t: Tier) => void;
  billingCycle: "monthly" | "annual";
  currentTier: Tier;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
      {TIER_ORDER.map((tier) => {
        const pricing = TIER_PRICING[tier]!;
        const price =
          billingCycle === "annual" ? pricing.monthlyEquivalent : pricing.monthly;
        const isSelected = selectedTier === tier;
        const isCurrent = currentTier === tier;

        const tierColor =
          tier === "bronze"
            ? "#b87333"
            : tier === "silver"
              ? "#c0c0c0"
              : tier === "gold"
                ? "#e6b800"
                : "#7c3aed";

        return (
          <motion.button
            key={tier}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(tier)}
            className={cn(
              "snap-center shrink-0 w-[100px] rounded-xl p-3 text-left transition-all relative",
              isSelected
                ? "bg-white ring-2 shadow-md"
                : "bg-[#f4f4f5] ring-1 ring-[#141414]/8"
            )}
            style={isSelected ? { borderColor: tierColor, boxShadow: `0 4px 16px ${tierColor}25` } : undefined}
          >
            {isSelected && (
              <div
                className="absolute inset-0 rounded-xl pointer-events-none"
                style={{ boxShadow: `inset 0 0 0 2px ${tierColor}` }}
              />
            )}
            {pricing.badge && (
              <span
                className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
                style={{ backgroundColor: tierColor }}
              >
                {pricing.badge}
              </span>
            )}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: tierColor }}
              >
                {tier === "bronze" && <Medal size={10} weight="fill" />}
                {tier === "silver" && <Medal size={10} weight="fill" />}
                {tier === "gold" && <Crown size={10} weight="fill" />}
                {tier === "neodymium" && <Sparkle size={10} weight="fill" />}
              </span>
              <span className="text-[11px] font-bold capitalize text-[#141414]">
                {tier}
              </span>
            </div>
            <p className="font-mono text-sm font-bold tabular-nums text-[#141414]">
              ${price > 0 ? price.toFixed(0) : "Free"}
            </p>
            <p className="text-[9px] text-[#8a8a8a]">
              {price > 0 ? "/mo" : "forever"}
            </p>
            {isCurrent && (
              <span className="mt-1 inline-block text-[8px] font-bold uppercase tracking-wider text-[#14b8a6]">
                Current
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/* Selected Tier Detail Card — the main push card */
function TierDetailCard({
  tier,
  pricing,
  billingCycle,
  displayPrice,
  purchasing,
  onSubscribe,
  currentTier,
}: {
  tier: Tier;
  pricing: TierPricing;
  billingCycle: "monthly" | "annual";
  displayPrice: number;
  purchasing: boolean;
  onSubscribe: () => void;
  currentTier: Tier;
}) {
  const tierColor =
    tier === "bronze"
      ? "#b87333"
      : tier === "silver"
        ? "#c0c0c0"
        : tier === "gold"
          ? "#e6b800"
          : "#7c3aed";

  const perks = TIER_PERKS[tier]!;
  const isFree = tier === "bronze";
  const isCurrent = currentTier === tier;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white ring-2 p-1" style={{ borderColor: tierColor, boxShadow: `0 8px 32px ${tierColor}20` }}>
      {/* Spotlight sweep for highlighted tiers */}
      {pricing.highlighted && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
          <div className="absolute top-0 -left-full h-full w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-spotlight-sweep" />
        </div>
      )}

      <div className="relative z-10 rounded-[14px] p-5 bg-gradient-to-b" style={{ backgroundImage: `linear-gradient(to bottom, ${tierColor}08, transparent)` }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-block rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-bold text-white"
                style={{ backgroundColor: tierColor }}
              >
                {tier} Tier
              </span>
              {pricing.badge && (
                <span className="rounded-full bg-[#14b8a6] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  {pricing.badge}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold font-display capitalize text-[#141414]">
              {isFree ? "Your Free Pass" : "The Ultimate Pass"}
            </h3>
          </div>
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: `${tierColor}15` }}
          >
            {tier === "bronze" && <Medal size={20} weight="fill" style={{ color: tierColor }} />}
            {tier === "silver" && <Medal size={20} weight="fill" style={{ color: tierColor }} />}
            {tier === "gold" && <Crown size={20} weight="fill" style={{ color: tierColor }} />}
            {tier === "neodymium" && <Sparkle size={20} weight="fill" style={{ color: tierColor }} />}
          </motion.div>
        </div>

        {/* Perks list */}
        <div className="space-y-2.5 mb-5">
          <PerkLine icon={<Tag size={12} weight="fill" />} label="Flash sales" value={perks.flashSaleFrequency} color={tierColor} />
          <PerkLine icon={<Coins size={12} weight="fill" />} label="Token rate" value={perks.tokenMultiplier} color={tierColor} />
          <PerkLine icon={<Eye size={12} weight="fill" />} label="Map access" value={perks.mapVisibility} color={tierColor} />
          <PerkLine icon={<Gauge size={12} weight="fill" />} label="Deal radar" value={perks.dealRadar} color={tierColor} />
          {perks.exclusives.map((perk) => (
            <PerkLine
              key={perk.id}
              icon={<Sparkle size={12} weight="fill" />}
              label={perk.label}
              value={perk.value}
              color={tierColor}
              exclusive
            />
          ))}
        </div>

        {/* Price block */}
        {!isFree && (
          <div className="border-t border-[#141414]/8 pt-4">
            {/* Dark pattern: fake retail value crossed out */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-mono text-sm text-[#8a8a8a] line-through tabular-nums">
                ${pricing.fakeRetailValue.toFixed(2)}
              </span>
              <span className="text-[10px] font-bold text-[#14b8a6]">
                Save {Math.round((1 - pricing.monthly / pricing.fakeRetailValue) * 100)}%
              </span>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-bold tracking-tighter text-[#141414] font-mono">
                ${displayPrice.toFixed(2)}
              </span>
              <span className="text-xs text-[#8a8a8a] uppercase tracking-widest">/ month</span>
            </div>
            {billingCycle === "annual" && (
              <>
                <p className="text-[10px] text-[#8a8a8a] mb-1">
                  Billed annually at{" "}
                  <span className="font-mono font-bold text-[#4b4b4b]">
                    ${pricing.annual}
                  </span>{" "}
                  (save {pricing.savingsPercent}%)
                </p>
                <p className="text-[10px] text-[#8a8a8a] mb-3">
                  <span className="font-mono line-through">${pricing.monthly.toFixed(2)}</span>
                  /mo monthly ·{" "}
                  <span className="font-bold text-[#14b8a6]">
                    save ${(pricing.monthly * 12 - pricing.annual).toFixed(0)}/yr
                  </span>{" "}
                  with annual
                </p>
              </>
            )}

            {/* Dark pattern: price comparison vs cheaper tier */}
            {tier !== "silver" && (
              <p className="text-[10px] text-[#14b8a6] mb-3 flex items-center gap-1">
                <TrendUp size={10} weight="bold" />
                Only{" "}
                <span className="font-mono font-bold">
                  ${(displayPrice - TIER_PRICING.silver!.monthlyEquivalent).toFixed(2)}
                </span>{" "}
                more than Silver
              </p>
            )}
          </div>
        )}

        {/* CTA */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onSubscribe}
          disabled={purchasing || isCurrent}
          className={cn(
            "w-full rounded-xl px-4 py-3.5 text-xs font-bold uppercase tracking-[0.16em] transition-all flex items-center justify-center gap-2",
            isCurrent
              ? "bg-[#f4f4f5] text-[#8a8a8a] cursor-default"
              : purchasing
                ? "bg-[#141414]/10 text-[#8a8a8a] cursor-wait"
                : "text-white active:scale-[0.98]"
          )}
          style={
            !isCurrent && !purchasing
              ? {
                  backgroundColor: tierColor,
                  boxShadow: `0 4px 0 ${tierColor}dd, 0 0 24px ${tierColor}40`,
                }
              : undefined
          }
        >
          {isCurrent ? (
            "Current Plan"
          ) : purchasing ? (
            "Processing..."
          ) : isFree ? (
            "Activate Free Plan"
          ) : (
            <>
              Subscribe Now <ArrowRight size={14} weight="bold" />
            </>
          )}
        </motion.button>

        {/* Dark pattern: fake member count */}
        {!isFree && (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <Users size={11} weight="fill" className="text-[#8a8a8a]" />
            <span className="text-[10px] text-[#8a8a8a]">
              <span className="font-bold text-[#4b4b4b] font-mono tabular-nums">
                {pricing.members.toLocaleString()}
              </span>{" "}
              active {tier} members
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PerkLine({
  icon,
  label,
  value,
  color,
  exclusive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  exclusive?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0" style={{ color }}>
        {icon}
      </span>
      <div className="flex-1">
        <p className="text-xs font-bold text-[#141414] flex items-center gap-1.5">
          {label}
          {exclusive && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: color }}
            >
              Exclusive
            </span>
          )}
        </p>
        <p className="text-[10px] text-[#8a8a8a] mt-0.5">{value}</p>
      </div>
    </div>
  );
}

/* Tier Comparison Strip — compact all-tiers comparison */
function TierComparisonStrip({
  selectedTier,
  billingCycle,
  onSelect,
}: {
  selectedTier: Tier;
  billingCycle: "monthly" | "annual";
  onSelect: (t: Tier) => void;
}) {
  return (
    <div className="rounded-2xl bg-[#f4f4f5] p-4 ring-1 ring-[#141414]/5">
      <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#8a8a8a] mb-3">
        Compare All Tiers
      </p>
      <div className="space-y-2">
        {TIER_ORDER.map((tier) => {
          const pricing = TIER_PRICING[tier]!;
          const price =
            billingCycle === "annual" ? pricing.monthlyEquivalent : pricing.monthly;
          const isSelected = selectedTier === tier;
          const tierColor =
            tier === "bronze"
              ? "#b87333"
              : tier === "silver"
                ? "#c0c0c0"
                : tier === "gold"
                  ? "#e6b800"
                  : "#7c3aed";

          return (
            <button
              key={tier}
              onClick={() => onSelect(tier)}
              className={cn(
                "w-full flex items-center justify-between rounded-lg px-3 py-2.5 transition-all",
                isSelected ? "bg-white shadow-sm ring-1 ring-[#141414]/8" : "hover:bg-white/50"
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white shrink-0"
                  style={{ backgroundColor: tierColor }}
                >
                  {tier === "neodymium" ? (
                    <Sparkle size={10} weight="fill" />
                  ) : (
                    <Medal size={10} weight="fill" />
                  )}
                </span>
                <div className="text-left">
                  <p className="text-xs font-bold capitalize text-[#141414]">{tier}</p>
                  <p className="text-[9px] text-[#8a8a8a]">
                    {TIER_PERKS[tier]!.tokenMultiplier}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-bold tabular-nums text-[#141414]">
                  ${price > 0 ? price.toFixed(2) : "Free"}
                </p>
                <p className="text-[9px] text-[#8a8a8a]">{price > 0 ? "/mo" : ""}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Fake Testimonials — dark pattern: fabricated social proof */
function FakeTestimonials() {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#8a8a8a]">
        What Members Say
      </p>
      {FAKE_TESTIMONIALS.map((t, i) => {
        const tierColor = t.tier === "neodymium" ? "#7c3aed" : "#e6b800";
        return (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1, ease: PREMIUM_EASE }}
            className="flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-[#141414]/8"
          >
            {/* Fake avatar using initials */}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: tierColor }}
            >
              {t.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-bold text-[#141414] truncate">{t.name}</p>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-white capitalize shrink-0"
                  style={{ backgroundColor: tierColor }}
                >
                  {t.tier}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#4b4b4b]">{t.quote}</p>
              <div className="flex items-center gap-0.5 mt-1.5">
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star key={s} size={10} weight="fill" className="text-[#e6b800]" />
                ))}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
