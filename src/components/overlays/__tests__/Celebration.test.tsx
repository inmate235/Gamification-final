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
    Coin: make("Coin"),
    Minus: make("Minus"),
    Fire: make("Fire"),
    Lightning: make("Lightning"),
    MapPin: make("MapPin"),
    SpinnerGap: make("SpinnerGap"),
    ShoppingBag: make("ShoppingBag"),
    X: make("X"),
  };
});

import { Celebration } from "@/components/overlays/Celebration";
import { useUIStore } from "@/stores/uiStore";

describe("Celebration overlay (earn vs spend vs streak)", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
  });

  it("renders nothing when the queue is empty", () => {
    render(<Celebration />);
    expect(screen.queryByTestId("celebration-overlay")).not.toBeInTheDocument();
    expect(screen.queryByTestId("celebration-overlay-wrapper")).not.toBeInTheDocument();
  });

  it("renders an earn celebration pushed to the queue", () => {
    act(() => {
      useUIStore.getState().pushCelebration({
        message: "+5 Tokens",
        amount: 5,
        kind: "earn",
      });
    });
    render(<Celebration />);
    expect(screen.getByTestId("celebration-overlay-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("celebration-message")).toHaveTextContent("+5 Tokens");
    expect(screen.getByTestId("celebration-kind")).toHaveTextContent("earn");
  });

  it("renders a spend receipt card pushed to the queue (distinct from earn)", () => {
    act(() => {
      useUIStore.getState().pushCelebration({
        message: "Deal Claimed! -3 Tokens",
        amount: 3,
        kind: "spend",
        label: "Bloom",
        balanceBefore: 10,
        balanceAfter: 7,
      });
    });
    render(<Celebration />);
    expect(screen.getByTestId("celebration-overlay-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("celebration-kind")).toHaveTextContent("spend");
  });

  it("renders a streak celebration pushed to the queue", () => {
    act(() => {
      useUIStore.getState().pushCelebration({
        message: "Day 3 streak — keep it going!",
        amount: 3,
        kind: "streak",
      });
    });
    render(<Celebration />);
    expect(screen.getByTestId("celebration-overlay-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("celebration-kind")).toHaveTextContent("streak");
  });
});
