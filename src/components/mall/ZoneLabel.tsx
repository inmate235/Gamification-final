"use client";

import type { Zone } from "@/types";

/**
 * ZoneLabel — renders a zone's canonical name on the map.
 *
 * Labels are shown ONLY for revealed (explored) zones. Fogged zones hide
 * their name until the player explores them (per VAL-MAP-013).
 */

interface ZoneLabelProps {
  zone: Zone;
  revealed: boolean;
}

export function ZoneLabel({ zone, revealed }: ZoneLabelProps) {
  if (!revealed) return null;

  return (
    <g
      pointerEvents="none"
      data-testid={`zone-label-${zone.id}`}
      aria-label={zone.name}
    >
      {/* Compact backing pill for legibility (Figma-inspired smaller labels) */}
      <rect
        x={zone.center.x - 55}
        y={zone.center.y - 11}
        width={110}
        height={22}
        rx={11}
        fill="#0a0a0f"
        opacity={0.75}
      />
      <rect
        x={zone.center.x - 55}
        y={zone.center.y - 11}
        width={110}
        height={22}
        rx={11}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={1}
      />
      <text
        x={zone.center.x}
        y={zone.center.y + 4}
        textAnchor="middle"
        fontFamily="var(--font-geist-sans), sans-serif"
        fontSize={12}
        fontWeight={500}
        fill="#a1a1aa"
        letterSpacing="0.08em"
        style={{ textTransform: "uppercase" }}
      >
        {zone.name}
      </text>
    </g>
  );
}

export default ZoneLabel;
