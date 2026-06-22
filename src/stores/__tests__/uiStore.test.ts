import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "@/stores/uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
  });

  it("initializes with no overlay, null data, and expanded bottom panel", () => {
    const s = useUIStore.getState();
    expect(s.activeOverlay).toBe("none");
    expect(s.overlayData).toBeNull();
    expect(s.bottomPanelExpanded).toBe(true);
  });

  it("showOverlay sets the active overlay and data", () => {
    useUIStore.getState().showOverlay("store-detail", { storeId: "abc" });
    const s = useUIStore.getState();
    expect(s.activeOverlay).toBe("store-detail");
    expect(s.overlayData).toEqual({ storeId: "abc" });
  });

  it("showOverlay without data defaults to null", () => {
    useUIStore.getState().showOverlay("celebration");
    expect(useUIStore.getState().overlayData).toBeNull();
  });

  it("hideOverlay resets to none and clears data", () => {
    useUIStore.getState().showOverlay("flash-sale", { id: 1 });
    useUIStore.getState().hideOverlay();
    const s = useUIStore.getState();
    expect(s.activeOverlay).toBe("none");
    expect(s.overlayData).toBeNull();
  });

  it("toggleBottomPanel flips the expanded flag", () => {
    expect(useUIStore.getState().bottomPanelExpanded).toBe(true);
    useUIStore.getState().toggleBottomPanel();
    expect(useUIStore.getState().bottomPanelExpanded).toBe(false);
    useUIStore.getState().toggleBottomPanel();
    expect(useUIStore.getState().bottomPanelExpanded).toBe(true);
  });

  it("setBottomPanelExpanded sets the flag directly", () => {
    useUIStore.getState().setBottomPanelExpanded(false);
    expect(useUIStore.getState().bottomPanelExpanded).toBe(false);
    useUIStore.getState().setBottomPanelExpanded(true);
    expect(useUIStore.getState().bottomPanelExpanded).toBe(true);
  });
});
