"use client";

import { motion } from "framer-motion";
import {
  ZONE_ENTRANCE,
  ZONE_EAST_WING,
  ZONE_WEST_WING,
  ZONE_CENTRAL_PLAZA,
  ZONE_FOOD_COURT,
} from "@/data/mallData";
import type { Zone } from "@/types";

/**
 * ZoneLabel — renders a zone's canonical name as a solid colored rounded pill.
 *
 * Labels are shown ONLY for revealed (explored) zones. Fogged zones hide
 * their name until the player explores them (per VAL-MAP-013).
 *
 * Playful direction: solid filled pill per zone (magenta / purple / teal /
 * yellow / lime), white Fredoka label, uppercase tracking.
 */

const ZONE_COLORS: Record<string, string> = {
  [ZONE_FOOD_COURT]: "#e6009e",
  [ZONE_CENTRAL_PLAZA]: "#7c3aed",
  [ZONE_EAST_WING]: "#14b8a6",
  [ZONE_WEST_WING]: "#f59e0b",
  [ZONE_ENTRANCE]: "#84cc16",
};

function zoneColor(zoneId: string): string {
  return ZONE_COLORS[zoneId] ?? "#8a8a8a";
}

interface ZoneLabelProps {
  zone: Zone;
  revealed: boolean;
}

export function ZoneLabel({ zone, revealed }: ZoneLabelProps) {
  if (!revealed) return null;

  const color = zoneColor(zone.id);
  const labelWidth = 124;
  const labelHeight = 26;
  const x = zone.center.x - labelWidth / 2;
  const y = zone.center.y - labelHeight / 2;

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      pointerEvents="none"
      data-testid={`zone-label-${zone.id}`}
      aria-label={zone.name}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    >
      <rect
        x={x}
        y={y}
        width={labelWidth}
        height={labelHeight}
        rx={labelHeight / 2}
        fill={color}
      />
      <text
        x={zone.center.x}
        y={zone.center.y + 4.5}
        textAnchor="middle"
        fontFamily="var(--font-display), sans-serif"
        fontSize={12}
        fontWeight={600}
        fill="#ffffff"
        letterSpacing="0.08em"
        style={{ textTransform: "uppercase" }}
      >
        {zone.name}
      </text>
    </motion.g>
  );
}

export default ZoneLabel;

export { zoneColor };
