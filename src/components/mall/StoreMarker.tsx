"use client";

import { motion } from "framer-motion";
import * as Phosphor from "@phosphor-icons/react/dist/ssr";
import type { Store, StoreCategory } from "@/types";

/**
 * StoreMarker — a clickable store pin rendered on the map.
 *
 * Markers are shown ONLY within revealed zones (per VAL-MAP-014). Each marker
 * uses a category-colored solid circle with a white Phosphor icon so different
 * store types are visually distinguishable (per VAL-MAP-032).
 *
 * Tapping a marker opens the store detail overlay (handled by the parent
 * MallMap via onStoreClick).
 */

/* ============================================================================
   Category styling — playful bright palette
   ========================================================================== */

const CATEGORY_COLORS: Record<StoreCategory, string> = {
  fashion: "#e6009e",
  tech: "#14b8a6",
  lifestyle: "#7c3aed",
  food: "#f59e0b",
  accessories: "#84cc16",
};

/* ============================================================================
   StoreIcon — module-scope component that renders the right Phosphor icon.
   Declared outside render so component identity is stable.
   ========================================================================== */

const PHOSPHOR = Phosphor as unknown as Record<
  string,
  React.ComponentType<{ size?: number; weight?: "fill" | "light"; color?: string }>
>;

function StoreIcon({ name, color }: { name: string; color: string }) {
  const Cmp = PHOSPHOR[name] ?? Phosphor.Storefront;
  return <Cmp size={16} weight="fill" color={color} />;
}

/* ============================================================================
   Component
   ========================================================================== */

interface StoreMarkerProps {
  store: Store;
  onStoreClick: (store: Store) => void;
}

export function StoreMarker({ store, onStoreClick }: StoreMarkerProps) {
  const color = CATEGORY_COLORS[store.category];
  const isHot = store.visitorCount > 50;

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.5,
        ease: [0.34, 1.56, 0.64, 1],
      }}
      style={{ cursor: "pointer", transformBox: "fill-box", transformOrigin: "center" }}
      onClick={(e) => {
        e.stopPropagation();
        onStoreClick(store);
      }}
      data-testid={`store-marker-${store.id}`}
      role="button"
      aria-label={`${store.name} — ${store.category}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onStoreClick(store);
        }
      }}
    >
      {/* Pulsing color halo */}
      <motion.circle
        cx={store.position.x}
        cy={store.position.y}
        r={20}
        fill={color}
        animate={{
          scale: [1, 1.18, 1],
          opacity: [0.18, 0.32, 0.18],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          transformOrigin: `${store.position.x}px ${store.position.y}px`,
          transformBox: "fill-box",
        }}
      />

      {/* Marker body — solid colored circle with white ring */}
      <circle
        cx={store.position.x}
        cy={store.position.y}
        r={16}
        fill={color}
        stroke="#ffffff"
        strokeWidth={3}
      />

      {/* Category icon (rendered via foreignObject so Phosphor SVG renders) */}
      <foreignObject
        x={store.position.x - 12}
        y={store.position.y - 12}
        width={24}
        height={24}
      >
        <div
          style={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
          }}
        >
          <StoreIcon name={store.icon} color="#ffffff" />
        </div>
      </foreignObject>

      {/* Store name label — white backing pill, Geist Sans, #141414 */}
      <foreignObject
        x={store.position.x - 52}
        y={store.position.y + 20}
        width={104}
        height={20}
      >
        <div
          style={{
            width: 104,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9999,
            background: "rgba(255,255,255,0.92)",
            boxShadow: "0 1px 2px rgba(20,20,20,0.12)",
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: 10,
            fontWeight: 600,
            color: "#141414",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            pointerEvents: "none",
            padding: "0 6px",
          }}
        >
          {store.name}
        </div>
      </foreignObject>

      {/* Bobbing deal badge (%) — magenta */}
      {store.dealInfo && (
        <motion.g
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            transformOrigin: `${store.position.x + 14}px ${store.position.y - 14}px`,
          }}
        >
          <circle
            cx={store.position.x + 14}
            cy={store.position.y - 14}
            r={8}
            fill="#e6009e"
            stroke="#ffffff"
            strokeWidth={2}
          />
          <text
            x={store.position.x + 14}
            y={store.position.y - 10.5}
            fill="#ffffff"
            fontSize="9px"
            fontWeight="bold"
            textAnchor="middle"
          >
            %
          </text>
        </motion.g>
      )}

      {/* Hot/busy indicator — Phosphor Fire icon (no emoji) */}
      {isHot && (
        <motion.g
          animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            transformOrigin: `${store.position.x - 14}px ${store.position.y - 14}px`,
          }}
        >
          <foreignObject
            x={store.position.x - 22}
            y={store.position.y - 22}
            width={16}
            height={16}
          >
            <div
              style={{
                width: 16,
                height: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ef4444",
              }}
            >
              {Phosphor.Fire ? (
                <Phosphor.Fire size={14} weight="fill" color="#ef4444" />
              ) : null}
            </div>
          </foreignObject>
        </motion.g>
      )}
    </motion.g>
  );
}

export default StoreMarker;
