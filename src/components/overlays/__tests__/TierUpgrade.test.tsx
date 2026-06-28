import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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
      h2: mk("h2"),
      p: mk("p"),
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
    Sparkle: make("Sparkle"),
    ArrowRight: make("ArrowRight"),
    Medal: make("Medal"),
    Crown: make("Crown"),
    Coins: make("Coins"),
    Timer: make("Timer"),
    Users: make("Users"),
    Warning: make("Warning"),
    Fire: make("Fire"),
    CheckCircle: make("CheckCircle"),
    Tag: make("Tag"),
    Eye: make("Eye"),
    Lightning: make("Lightning"),
    TrendDown: make("TrendDown"),
  };
});

import { TierUpgrade } from "@/components/overlays/TierUpgrade";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";

describe("TierUpgrade celebration overlay (VAL-TIER-006..008)", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    usePlayerStore.getState().reset();
  });

  it("renders nothing when no tier-upgrade overlay is active", () => {
    render(<TierUpgrade />);
    expect(screen.queryByTestId("tier-upgrade-overlay")).not.toBeInTheDocument();
  });

  it("renders the full-screen celebration with the new tier name (Silver)", () => {
    act(() => {
      usePlayerStore.getState().setTier("silver");
      useUIStore.getState().showOverlay("tier-upgrade", {
        newTier: "silver",
        previousTier: "bronze",
      });
    });
    render(<TierUpgrade />);
    expect(screen.getByTestId("tier-upgrade-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("tier-upgrade-title")).toHaveTextContent(
      "You are now Silver!"
    );
    expect(screen.getByTestId("tier-upgrade-badge")).toBeInTheDocument();
  });

  it("shows the perks summary for the new tier", () => {
    act(() => {
      usePlayerStore.getState().setTier("gold");
      useUIStore.getState().showOverlay("tier-upgrade", {
        newTier: "gold",
        previousTier: "silver",
      });
    });
    render(<TierUpgrade />);
    const perks = screen.getByTestId("tier-upgrade-perks");
    expect(perks.textContent).toContain("3 flash sales / hour");
    expect(perks.textContent).toContain("2x tokens");
  });

  it("dismisses on CTA click", () => {
    act(() => {
      useUIStore.getState().showOverlay("tier-upgrade", {
        newTier: "silver",
        previousTier: "bronze",
      });
    });
    render(<TierUpgrade />);
    act(() => {
      screen.getByTestId("tier-upgrade-cta").click();
    });
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });
});
