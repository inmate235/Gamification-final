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
      {/* Backing pill for legibility */}
      <rect
        x={zone.center.x - 70}
        y={zone.center.y - 14}
        width={140}
        height={28}
        rx={14}
        fill="#0a0a0f"
        opacity={0.7}
      />
      <rect
        x={zone.center.x - 70}
        y={zone.center.y - 14}
        width={140}
        height={28}
        rx={14}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />
      <text
        x={zone.center.x}
        y={zone.center.y + 5}
        textAnchor="middle"
        fontFamily="var(--font-geist-sans), sans-serif"
        fontSize={15}
        fontWeight={600}
        fill="#f5f5f7"
        letterSpacing="0.04em"
      >
        {zone.name}
      </text>
    </g>
  );
}

export default ZoneLabel;
