/**
 * Static shortcut definitions.
 *
 * Each shortcut opens a faster route between two non-adjacent (or distant)
 * zones when unlocked for a deficit-engineered token cost. When unlocked, the
 * mapStore treats the two zones as adjacent so the player can travel directly,
 * and a distinct corridor line is drawn on the map.
 *
 * The `tokenCost` here is a BASE placeholder; the economyStore overwrites it
 * with a deficit price (balance + 2..3) at the moment the shortcut becomes the
 * active offer, then freezes that price until the shortcut is purchased.
 */

import type { Shortcut } from "@/types";
import {
  ZONE_ENTRANCE,
  ZONE_EAST_WING,
  ZONE_WEST_WING,
  ZONE_CENTRAL_PLAZA,
  ZONE_FOOD_COURT,
} from "./mallData";

export const SHORTCUT_AURORA = "shortcut-aurora-passage";
export const SHORTCUT_NEON = "shortcut-neon-tunnel";
export const SHORTCUT_SILK = "shortcut-silk-corridor";

/**
 * The canonical shortcut list (in activation order). The first locked
 * shortcut is the active, buyable offer; the rest are teasers.
 */
export const shortcuts: Shortcut[] = [
  {
    id: SHORTCUT_AURORA,
    name: "Aurora Passage",
    description: "A luminous express lift from the Entrance straight to Central Plaza.",
    fromZoneId: ZONE_ENTRANCE,
    toZoneId: ZONE_CENTRAL_PLAZA,
    tokenCost: 2, // overwritten by deficit engine at activation
    unlocked: false,
  },
  {
    id: SHORTCUT_NEON,
    name: "Neon Tunnel",
    description: "A pulsing service tunnel linking the East Wing to the Food Court.",
    fromZoneId: ZONE_EAST_WING,
    toZoneId: ZONE_FOOD_COURT,
    tokenCost: 2,
    unlocked: false,
  },
  {
    id: SHORTCUT_SILK,
    name: "Silk Corridor",
    description: "A velvet-lined passage from the West Wing up to the Food Court.",
    fromZoneId: ZONE_WEST_WING,
    toZoneId: ZONE_FOOD_COURT,
    tokenCost: 2,
    unlocked: false,
  },
];

/** Returns the unlocked shortcut edges as [from, to] pairs for adjacency. */
export function unlockedShortcutEdges(list: Shortcut[]): Array<[string, string]> {
  return list
    .filter((s) => s.unlocked)
    .map((s) => [s.fromZoneId, s.toZoneId] as [string, string]);
}
