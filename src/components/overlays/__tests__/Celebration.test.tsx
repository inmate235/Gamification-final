import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
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
  return { Coin: make("Coin") };
});

import { Celebration } from "@/components/overlays/Celebration";
import { useUIStore } from "@/stores/uiStore";

describe("Celebration overlay", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("does not render when no celebration overlay is active", () => {
    render(<Celebration />);
    expect(screen.queryByTestId("celebration-overlay")).not.toBeInTheDocument();
  });

  it("renders the reward message when active", () => {
    useUIStore.getState().showOverlay("celebration", {
      message: "+3 Tokens",
      amount: 3,
    });
    render(<Celebration />);
    expect(screen.getByTestId("celebration-message")).toHaveTextContent(
      "+3 Tokens"
    );
  });

  it("auto-dismisses after the celebration duration", () => {
    useUIStore.getState().showOverlay("celebration", {
      message: "+1 Token!",
      amount: 1,
    });
    render(<Celebration />);
    expect(useUIStore.getState().activeOverlay).toBe("celebration");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });
});
