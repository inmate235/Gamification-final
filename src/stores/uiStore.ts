/**
 * uiStore - overlay + bottom panel state.
 *
 * Holds: activeOverlay, overlayData, bottomPanelExpanded.
 * Actions: showOverlay, hideOverlay, toggleBottomPanel, setBottomPanelExpanded.
 */

import { create } from "zustand";
import type { CelebrationData, OverlayType, UIState } from "@/types";

/* ============================================================================
   Store
   ========================================================================== */

export interface UIStore extends UIState {
  showOverlay: (overlay: OverlayType, data?: unknown) => void;
  hideOverlay: () => void;
  toggleBottomPanel: () => void;
  setBottomPanelExpanded: (expanded: boolean) => void;
  setTimelineOpen: (isOpen: boolean) => void;
  markTimelineOnboardingSeen: () => void;
  setMuted: (muted: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;
  pushCelebration: (data: CelebrationData) => void;
  shiftCelebration: () => void;
  reset: () => void;
}

const initialUIState: UIState = {
  activeOverlay: "none",
  overlayData: null,
  bottomPanelExpanded: true,
  isTimelineOpen: false,
  hasSeenTimelineOnboarding: false,
  isMuted: true,
  isSoundEnabled: true,
  celebrationQueue: [],
};

export const useUIStore = create<UIStore>((set) => ({
  ...initialUIState,

  showOverlay: (overlay, data) =>
    set({ activeOverlay: overlay, overlayData: data ?? null }),

  hideOverlay: () => set({ activeOverlay: "none", overlayData: null }),

  toggleBottomPanel: () =>
    set((state) => ({ bottomPanelExpanded: !state.bottomPanelExpanded })),

  setBottomPanelExpanded: (expanded) =>
    set({ bottomPanelExpanded: expanded }),

  setTimelineOpen: (isOpen) =>
    set({ isTimelineOpen: isOpen }),

  markTimelineOnboardingSeen: () =>
    set({ hasSeenTimelineOnboarding: true }),

  setMuted: (muted) =>
    set({ isMuted: muted }),

  setSoundEnabled: (enabled) =>
    set({ isSoundEnabled: enabled }),

  toggleSound: () =>
    set((state) => ({ isSoundEnabled: !state.isSoundEnabled })),

  pushCelebration: (data) =>
    set((state) => ({ celebrationQueue: [...state.celebrationQueue, data] })),

  shiftCelebration: () =>
    set((state) => ({ celebrationQueue: state.celebrationQueue.slice(1) })),

  reset: () => set({ ...initialUIState }),
}));

export default useUIStore;
