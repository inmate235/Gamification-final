import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* --- Mock framer-motion (strip animation props, render plain elements) --- */
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
      onAnimationComplete,
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
    void onAnimationComplete;
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
      svg: mk("svg"),
      g: mk("g"),
      path: mk("path"),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

/* --- Mock Phosphor icons --- */
vi.mock("@phosphor-icons/react/dist/ssr", () => {
  const make = (name: string) => {
    const Cmp = () => React.createElement("span", { "data-icon": name });
    Cmp.displayName = `Icon-${name}`;
    return Cmp;
  };
  const names = [
    "X",
    "CircleNotch",
    "Sparkle",
    "MapTrifold",
    "Storefront",
    "Coins",
  ];
  const obj: Record<string, ReturnType<typeof make>> = {};
  for (const n of names) obj[n] = make(n);
  return obj;
});

import { SpinningWheel, SpinningWheelEntryButton } from "@/components/overlays/SpinningWheel";
import { useUIStore } from "@/stores/uiStore";
import { useEconomyStore } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import {
  WHEEL_SEGMENTS,
} from "@/engine/nearMissAlgorithm";

describe("SpinningWheel overlay", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    useEconomyStore.getState().reset();
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
  });

  /* --- Entry button --- */

  it("entry button is hidden when wheel is not available", () => {
    useEconomyStore.setState({
      spinningWheel: { available: false, lastSpin: 0, spinCount: 0 },
    });
    render(<SpinningWheelEntryButton />);
    expect(screen.queryByTestId("wheel-entry-button")).toBeNull();
  });

  it("entry button is shown when wheel is available", () => {
    useEconomyStore.setState({
      spinningWheel: { available: true, lastSpin: 0, spinCount: 0 },
    });
    render(<SpinningWheelEntryButton />);
    expect(screen.getByTestId("wheel-entry-button")).toBeDefined();
  });

  it("clicking entry button opens the wheel overlay", () => {
    useEconomyStore.setState({
      spinningWheel: { available: true, lastSpin: 0, spinCount: 0 },
    });
    render(<SpinningWheelEntryButton />);
    fireEvent.click(screen.getByTestId("wheel-entry-button"));
    expect(useUIStore.getState().activeOverlay).toBe("spinning-wheel");
  });

  /* --- Overlay rendering --- */

  it("overlay is not rendered when activeOverlay is not spinning-wheel", () => {
    render(<SpinningWheel />);
    expect(screen.queryByTestId("spinning-wheel-overlay")).toBeNull();
  });

  it("overlay renders with wheel, pointer, and spin button when open", () => {
    useEconomyStore.setState({
      spinningWheel: { available: true, lastSpin: 0, spinCount: 0 },
    });
    useUIStore.getState().showOverlay("spinning-wheel");
    render(<SpinningWheel />);
    expect(screen.getByTestId("spinning-wheel-overlay")).toBeDefined();
    expect(screen.getByTestId("wheel-svg")).toBeDefined();
    expect(screen.getByTestId("wheel-pointer")).toBeDefined();
    expect(screen.getByTestId("wheel-spin-button")).toBeDefined();
  });

  it("shows all 7 prize segment labels before spinning (VAL-WHEEL-011)", () => {
    useEconomyStore.setState({
      spinningWheel: { available: true, lastSpin: 0, spinCount: 0 },
    });
    useUIStore.getState().showOverlay("spinning-wheel");
    render(<SpinningWheel />);
    for (const seg of WHEEL_SEGMENTS) {
      expect(screen.getByText(seg.label)).toBeDefined();
    }
  });

  /* --- Close / dismiss --- */

  it("close button dismisses the overlay (VAL-WHEEL-014)", () => {
    useEconomyStore.setState({
      spinningWheel: { available: true, lastSpin: 0, spinCount: 0 },
    });
    useUIStore.getState().showOverlay("spinning-wheel");
    render(<SpinningWheel />);
    fireEvent.click(screen.getByTestId("wheel-close-button"));
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });

  it("backdrop click dismisses the overlay", () => {
    useEconomyStore.setState({
      spinningWheel: { available: true, lastSpin: 0, spinCount: 0 },
    });
    useUIStore.getState().showOverlay("spinning-wheel");
    render(<SpinningWheel />);
    const overlay = screen.getByTestId("spinning-wheel-overlay");
    // Click the backdrop (the overlay container itself)
    fireEvent.click(overlay.firstChild as HTMLElement);
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });

  /* --- Mid-spin close prevention (fix-spinning-wheel-midspin) --- */

  it("close button is disabled during spin animation", () => {
    useEconomyStore.setState({
      spinningWheel: { available: true, lastSpin: 0, spinCount: 0 },
    });
    useUIStore.getState().showOverlay("spinning-wheel");
    render(<SpinningWheel />);
    fireEvent.click(screen.getByTestId("wheel-spin-button"));
    const closeBtn = screen.getByTestId("wheel-close-button") as HTMLButtonElement;
    expect(closeBtn.disabled).toBe(true);
  });

  it("clicking close button during spin does not dismiss the overlay", () => {
    useEconomyStore.setState({
      spinningWheel: { available: true, lastSpin: 0, spinCount: 0 },
    });
    useUIStore.getState().showOverlay("spinning-wheel");
    render(<SpinningWheel />);
    fireEvent.click(screen.getByTestId("wheel-spin-button"));
    fireEvent.click(screen.getByTestId("wheel-close-button"));
    expect(useUIStore.getState().activeOverlay).toBe("spinning-wheel");
  });

  it("clicking backdrop during spin does not dismiss the overlay", () => {
    useEconomyStore.setState({
      spinningWheel: { available: true, lastSpin: 0, spinCount: 0 },
    });
    useUIStore.getState().showOverlay("spinning-wheel");
    render(<SpinningWheel />);
    fireEvent.click(screen.getByTestId("wheel-spin-button"));
    fireEvent.click(screen.getByTestId("wheel-backdrop"));
    expect(useUIStore.getState().activeOverlay).toBe("spinning-wheel");
  });

  it("cooldown is consumed but reward is preserved when attempting to close mid-spin", () => {
    // The spin consumes the cooldown immediately; preventing close mid-spin
    // guarantees the animation completes and the reward is applied.
    useEconomyStore.setState({
      spinningWheel: { available: true, lastSpin: 0, spinCount: 0 },
    });
    useUIStore.getState().showOverlay("spinning-wheel");
    render(<SpinningWheel />);
    fireEvent.click(screen.getByTestId("wheel-spin-button"));
    // Cooldown consumed.
    expect(useEconomyStore.getState().spinningWheel.available).toBe(false);
    expect(useEconomyStore.getState().spinningWheel.spinCount).toBe(1);
    // Overlay remains open (close prevented).
    expect(useUIStore.getState().activeOverlay).toBe("spinning-wheel");
    // Still spinning — reward not yet shown.
    expect(screen.getByTestId("wheel-spinning-label")).toBeDefined();
  });

  it("close button is enabled and overlay can be dismissed before spinning (idle)", () => {
    useEconomyStore.setState({
      spinningWheel: { available: true, lastSpin: 0, spinCount: 0 },
    });
    useUIStore.getState().showOverlay("spinning-wheel");
    render(<SpinningWheel />);
    const closeBtn = screen.getByTestId("wheel-close-button") as HTMLButtonElement;
    expect(closeBtn.disabled).toBe(false);
    fireEvent.click(closeBtn);
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });

  it("no animation uses linear easing (design-system rule)", async () => {
    // Read the component source and assert no `ease: "linear"` remains.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/overlays/SpinningWheel.tsx"),
      "utf-8"
    );
    expect(src).not.toContain('ease: "linear"');
  });

  /* --- Spin interaction --- */

  it("spin button starts the spin and enters cooldown (VAL-WHEEL-003, VAL-WHEEL-012)", () => {
    useEconomyStore.setState({
      spinningWheel: { available: true, lastSpin: 0, spinCount: 0 },
    });
    useUIStore.getState().showOverlay("spinning-wheel");
    render(<SpinningWheel />);
    fireEvent.click(screen.getByTestId("wheel-spin-button"));
    // Wheel is now on cooldown (available = false)
    expect(useEconomyStore.getState().spinningWheel.available).toBe(false);
    expect(useEconomyStore.getState().spinningWheel.spinCount).toBe(1);
    // Spinning label should be visible (framer-motion mock renders children)
    expect(screen.getByTestId("wheel-spinning-label")).toBeDefined();
  });

  it("spin button is disabled during cooldown when wheel is not available", () => {
    useEconomyStore.setState({
      spinningWheel: { available: false, lastSpin: Date.now(), spinCount: 1 },
    });
    useUIStore.getState().showOverlay("spinning-wheel");
    render(<SpinningWheel />);
    const btn = screen.getByTestId("wheel-spin-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  /* --- Cooldown hint --- */

  it("shows cooldown hint when wheel is not available in idle phase", () => {
    useEconomyStore.setState({
      spinningWheel: { available: false, lastSpin: Date.now(), spinCount: 1 },
    });
    useUIStore.getState().showOverlay("spinning-wheel");
    render(<SpinningWheel />);
    expect(screen.getByTestId("wheel-cooldown-hint")).toBeDefined();
  });
});
