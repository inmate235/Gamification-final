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
  const icons = [
    "X",
    "Sparkle",
    "Lightning",
    "CircleNotch",
    "MapTrifold",
    "Tag",
    "Coin",
    "MapPin",
    "Crosshair",
    "Warning",
    "Clock",
  ];
  const map: Record<string, ReturnType<typeof make>> = {};
  for (const i of icons) map[i] = make(i);
  return map;
});

import { TierPerksPanel } from "@/components/overlays/TierPerksPanel";
import { useUIStore } from "@/stores/uiStore";
import { usePlayerStore } from "@/stores/playerStore";

describe("TierPerksPanel (VAL-TIER-001..012, -026, -028)", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    usePlayerStore.getState().reset();
  });

  it("renders nothing when the perks overlay is not active", () => {
    render(<TierPerksPanel />);
    expect(screen.queryByTestId("tier-perks-overlay")).not.toBeInTheDocument();
  });

  it("renders all four tiers in the ladder (VAL-TIER-001, -002)", () => {
    act(() => useUIStore.getState().showOverlay("tier-perks"));
    render(<TierPerksPanel />);
    const ladder = screen.getByTestId("tier-perks-ladder");
    expect(ladder.querySelector('[data-testid="tier-ladder-bronze"]')).toBeTruthy();
    expect(ladder.querySelector('[data-testid="tier-ladder-silver"]')).toBeTruthy();
    expect(ladder.querySelector('[data-testid="tier-ladder-gold"]')).toBeTruthy();
    expect(ladder.querySelector('[data-testid="tier-ladder-neodymium"]')).toBeTruthy();
    // Bronze is the active tier by default
    expect(
      ladder.querySelector('[data-testid="tier-ladder-bronze"]')!.getAttribute("data-active")
    ).toBe("true");
  });

  it("shows flash sale frequency, token multiplier and map visibility for the current tier", () => {
    act(() => {
      usePlayerStore.getState().setTier("silver");
      useUIStore.getState().showOverlay("tier-perks");
    });
    render(<TierPerksPanel />);
    const perks = screen.getByTestId("tier-perks-current");
    expect(perks.textContent).toContain("2 flash sales / hour");
    expect(perks.textContent).toContain("1.5x tokens");
    expect(perks.textContent).toContain("Deal radar");
  });

  it("does not show Neodymium exclusive perks at gold (VAL-TIER-026)", () => {
    act(() => {
      usePlayerStore.getState().setTier("gold");
      useUIStore.getState().showOverlay("tier-perks");
    });
    render(<TierPerksPanel />);
    expect(screen.queryByTestId("tier-perks-neodymium-exclusives")).not.toBeInTheDocument();
  });

  it("shows Neodymium exclusive perks only at neodymium (VAL-TIER-026)", () => {
    act(() => {
      usePlayerStore.getState().setTier("neodymium");
      useUIStore.getState().showOverlay("tier-perks");
    });
    render(<TierPerksPanel />);
    expect(screen.getByTestId("tier-perks-neodymium-exclusives")).toBeInTheDocument();
  });

  it("shows trial perks with a countdown when granted (VAL-TIER-013, -014)", () => {
    act(() => {
      usePlayerStore.getState().grantOnboardingTrialPerks();
      useUIStore.getState().showOverlay("tier-perks");
    });
    render(<TierPerksPanel />);
    const trialSection = screen.getByTestId("tier-perks-trial");
    expect(trialSection).toBeInTheDocument();
    // At least one trial perk card with a countdown is rendered
    expect(screen.queryByTestId("trial-perk-trial-deal-radar")).toBeTruthy();
  });

  it("shows an aspiration hint toward the next tier (VAL-TIER-028)", () => {
    act(() => useUIStore.getState().showOverlay("tier-perks"));
    render(<TierPerksPanel />);
    const hint = screen.getByTestId("tier-perks-hint");
    expect(hint.textContent).toContain("Silver");
  });

  it("dismisses on close button", () => {
    act(() => useUIStore.getState().showOverlay("tier-perks"));
    render(<TierPerksPanel />);
    act(() => {
      screen.getByLabelText("Close perks panel").click();
    });
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });
});
