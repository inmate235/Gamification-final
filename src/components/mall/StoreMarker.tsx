"use client";

import { motion } from "framer-motion";
import * as Phosphor from "@phosphor-icons/react/dist/ssr";
import type { Store, StoreCategory } from "@/types";

/**
 * StoreMarker — a clickable store pin rendered on the map.
 *
 * Markers are shown ONLY within revealed zones (per VAL-MAP-014). Each marker
 * uses a category-colored glow and a distinct Phosphor icon per category so
 * different store types are visually distinguishable (per VAL-MAP-032).
 *
 * Tapping a marker opens the store detail overlay (handled by the parent
 * MallMap via onStoreClick).
 */

/* ============================================================================
   Category styling
   ========================================================================== */

const CATEGORY_COLORS: Record<StoreCategory, string> = {
  fashion: "#e879a1",
  tech: "#4fd1c5",
  lifestyle: "#d4af37",
  food: "#f59e0b",
  accessories: "#9d7fdb",
};

/* ============================================================================
   StoreIcon — module-scope component that renders the right Phosphor icon.
   Declared outside render so component identity is stable.
   ========================================================================== */

const PHOSPHOR = Phosphor as unknown as Record<
  string,
  React.ComponentType<{ size?: number; weight?: "light"; color?: string }>
>;

function StoreIcon({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  const Cmp = PHOSPHOR[name] ?? Phosphor.Storefront;
  return <Cmp size={16} weight="light" color={color} />;
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

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.6,
        ease: [0.32, 0.72, 0, 1],
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
      {/* Glow halo */}
      <circle
        cx={store.position.x}
        cy={store.position.y}
        r={18}
        fill={color}
        opacity={0.18}
      />
      {/* Marker body */}
      <rect
        x={store.position.x - 14}
        y={store.position.y - 14}
        width={28}
        height={28}
        rx={10}
        fill="#12121a"
        stroke={color}
        strokeWidth={1.5}
        style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
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
            color,
          }}
        >
          <StoreIcon name={store.icon} color={color} />
        </div>
      </foreignObject>
    </motion.g>
  );
}

export default StoreMarker;
