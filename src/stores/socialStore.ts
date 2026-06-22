/**
 * socialStore - phantom users, leaderboard, proximity alerts.
 *
 * Holds: phantoms, leaderboard, proximityAlerts.
 * Actions: movePhantoms, updateLeaderboard, triggerProximityAlert,
 *          generatePhantomActivity, dismissProximityAlert, reset.
 *
 * Phantoms are always just barely ahead of the real player. When the player
 * overtakes a phantom, a new one appears just ahead (goalpost shifting).
 */

import { create } from "zustand";
import type {
  LeaderboardEntry,
  ProximityAlert,
  SocialState,
} from "@/types";
import {
  phantoms as initialPhantoms,
  initialLeaderboard,
  samplePhantomAction,
  PHANTOM_ZONE_POSITIONS,
} from "@/data/phantomData";
import { usePlayerStore } from "./playerStore";

/* ============================================================================
   Store
   ========================================================================== */

let alertCounter = 0;
function nextAlertId(): string {
  alertCounter += 1;
  return `proximity-alert-${alertCounter}`;
}

export interface SocialStore extends SocialState {
  movePhantoms: () => void;
  updateLeaderboard: () => void;
  triggerProximityAlert: (targetName: string, tokenGap: number) => ProximityAlert;
  generatePhantomActivity: () => void;
  dismissProximityAlert: (alertId: string) => void;
  reset: () => void;
}

export const useSocialStore = create<SocialStore>((set, get) => ({
  phantoms: initialPhantoms.map((p) => ({ ...p })),
  leaderboard: initialLeaderboard.map((e) => ({ ...e })),
  proximityAlerts: [],

  movePhantoms: () =>
    set((state) => ({
      phantoms: state.phantoms.map((p) => {
        const zoneKeys = Object.keys(PHANTOM_ZONE_POSITIONS);
        const nextKey = zoneKeys[
          Math.floor(Math.random() * zoneKeys.length)
        ];
        const nextPos = nextKey
          ? PHANTOM_ZONE_POSITIONS[nextKey]
          : p.position;
        return {
          ...p,
          position: nextPos ? { ...nextPos } : p.position,
          currentAction: samplePhantomAction(),
          lastActivity: "just now",
        };
      }),
    })),

  updateLeaderboard: () => {
    const playerTokens = usePlayerStore.getState().tokens;
    const state = get();

    // Build a combined list including the player, then sort by token count desc.
    const playerEntry: LeaderboardEntry = {
      rank: 0, // assigned after sort
      name: "You",
      avatarSeed: "player-avatar",
      tier: usePlayerStore.getState().tier,
      tokenCount: playerTokens,
      isPlayer: true,
    };

    const phantomEntries: LeaderboardEntry[] = state.phantoms.map((p) => ({
      rank: 0,
      name: p.name,
      avatarSeed: p.avatarSeed,
      tier: p.tier,
      tokenCount: p.tokenCount,
      isPlayer: false,
    }));

    const combined = [playerEntry, ...phantomEntries].sort(
      (a, b) => b.tokenCount - a.tokenCount
    );

    // Assign contiguous 1-indexed ranks.
    combined.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    set({ leaderboard: combined });
  },

  triggerProximityAlert: (targetName, tokenGap) => {
    const alert: ProximityAlert = {
      id: nextAlertId(),
      message: `You're only ${tokenGap} token${
        tokenGap === 1 ? "" : "s"
      } behind ${targetName}!`,
      targetName,
      tokenGap,
    };
    set((state) => ({ proximityAlerts: [...state.proximityAlerts, alert] }));
    return alert;
  },

  generatePhantomActivity: () => {
    get().movePhantoms();
    get().updateLeaderboard();
  },

  dismissProximityAlert: (alertId) =>
    set((state) => ({
      proximityAlerts: state.proximityAlerts.filter((a) => a.id !== alertId),
    })),

  reset: () =>
    set({
      phantoms: initialPhantoms.map((p) => ({ ...p })),
      leaderboard: initialLeaderboard.map((e) => ({ ...e })),
      proximityAlerts: [],
    }),
}));

export default useSocialStore;
