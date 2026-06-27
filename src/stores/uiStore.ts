/**
 * uiStore - overlay + bottom panel state.
 *
 * Holds: activeOverlay, overlayData, bottomPanelExpanded.
 * Actions: showOverlay, hideOverlay, toggleBottomPanel, setBottomPanelExpanded.
 */

import { create } from "zustand";
import type { OverlayType, UIState } from "@/types";

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
  reset: () => void;
}

const initialUIState: UIState = {
  activeOverlay: "none",
  overlayData: null,
  bottomPanelExpanded: true,
  isTimelineOpen: false,
  hasSeenTimelineOnboarding: false,
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

  reset: () => set({ ...initialUIState }),
}));

export default useUIStore;
