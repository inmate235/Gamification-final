import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("framer-motion", () => {
  const strip = (props: Record<string, unknown>) => {
    const {
      initial,
      animate,
      exit,
      transition,
      whileTap,
      whileInView,
      variants,
      layout,
      ...rest
    } = props;
    void initial;
    void animate;
    void exit;
    void transition;
    void whileTap;
    void whileInView;
    void variants;
    void layout;
    return rest;
  };
  const mk = (tag: string) => {
    const comp = React.forwardRef<HTMLElement, Record<string, unknown>>(
      (props, ref) =>
        React.createElement(
          tag,
          { ref, ...(strip(props) as Record<string, unknown>) },
          props.children as React.ReactNode
        )
    );
    comp.displayName = `motion.${tag}`;
    return comp;
  };
  return {
    motion: {
      div: mk("div"),
      span: mk("span"),
      button: mk("button"),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock("@phosphor-icons/react/dist/ssr", () => {
  const make = (name: string) => {
    const Cmp = () => React.createElement("span", { "data-icon": name });
    Cmp.displayName = `Icon-${name}`;
    return Cmp;
  };
  return {
    X: make("X"),
    Star: make("Star"),
    Users: make("Users"),
    Tag: make("Tag"),
  };
});

import { StoreDetail } from "@/components/overlays/StoreDetail";
import { useUIStore } from "@/stores/uiStore";
import { getStoreById } from "@/data/mallData";

describe("StoreDetail overlay", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
  });

  afterEach(() => cleanup());

  it("does not render when no overlay is active", () => {
    render(<StoreDetail />);
    expect(screen.queryByTestId("store-detail-overlay")).not.toBeInTheDocument();
  });

  it("shows store name, category, visitor count, and deal info", () => {
    const store = getStoreById("store-bloom")!;
    useUIStore.getState().showOverlay("store-detail", store);
    render(<StoreDetail />);
    expect(screen.getByText("Bloom")).toBeInTheDocument();
    expect(screen.getByText(/Fashion/i)).toBeInTheDocument();
    expect(screen.getByTestId("store-visitor-count")).toHaveTextContent(
      String(store.visitorCount)
    );
    expect(screen.getByTestId("store-deal")).toBeInTheDocument();
  });

  it("shows reviews with 4-5 star ratings and no disclosure labels", () => {
    const store = getStoreById("store-technova")!;
    useUIStore.getState().showOverlay("store-detail", store);
    render(<StoreDetail />);
    for (const review of store.reviews) {
      const ratingEl = screen.getByTestId(`review-rating-${review.id}`);
      expect(ratingEl).toBeInTheDocument();
      expect(review.rating).toBeGreaterThanOrEqual(4);
      expect(review.rating).toBeLessThanOrEqual(5);
    }
    // No "sponsored" or standalone "ad" disclosure anywhere in the panel
    const overlay = screen.getByTestId("store-detail-overlay");
    const text = overlay.textContent?.toLowerCase() ?? "";
    expect(text).not.toContain("sponsored");
    expect(/\bad\b/.test(text)).toBe(false);
  });

  it("can be dismissed via the close button", () => {
    const store = getStoreById("store-bloom")!;
    useUIStore.getState().showOverlay("store-detail", store);
    render(<StoreDetail />);
    fireEvent.click(screen.getByLabelText("Close store details"));
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });

  it("can be dismissed via backdrop click", () => {
    const store = getStoreById("store-bloom")!;
    useUIStore.getState().showOverlay("store-detail", store);
    render(<StoreDetail />);
    fireEvent.click(screen.getByTestId("store-detail-overlay"));
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });
});
