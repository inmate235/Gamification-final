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
    motion: { div: mk("div"), span: mk("span") },
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
    Fire: make("Fire"),
    MapPin: make("MapPin"),
    Lightning: make("Lightning"),
  };
});

import { StatusBar } from "@/components/mall/StatusBar";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";

describe("StatusBar", () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
  });

  it("renders tokens, tier, streak, and exploration percent", () => {
    usePlayerStore.getState().addTokens(7);
    render(<StatusBar />);
    expect(screen.getByTestId("status-tokens")).toHaveTextContent("7");
    expect(screen.getByTestId("status-tier")).toHaveTextContent(/Bronze/i);
    expect(screen.getByTestId("status-streak")).toHaveTextContent("1");
    expect(screen.getByTestId("status-exploration")).toBeInTheDocument();
  });

  it("updates the token display reactively after earning", () => {
    render(<StatusBar />);
    expect(screen.getByTestId("status-tokens")).toHaveTextContent("0");
    act(() => {
      usePlayerStore.getState().addTokens(5);
    });
    expect(screen.getByTestId("status-tokens")).toHaveTextContent("5");
  });

  it("shows the exploration percent from the map store", () => {
    render(<StatusBar />);
    const initial = useMapStore.getState().explorationPercent;
    expect(screen.getByTestId("status-exploration")).toHaveTextContent(
      `${initial}%`
    );
  });
});
