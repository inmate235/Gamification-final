import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  const names = ["X", "Lightning", "Path", "Check", "Lock"];
  const obj: Record<string, ReturnType<typeof make>> = {};
  for (const n of names) obj[n] = make(n);
  return obj;
});

import {
  ShortcutUnlock,
  ShortcutEntryButton,
} from "@/components/overlays/ShortcutUnlock";
import { useUIStore } from "@/stores/uiStore";
import { useEconomyStore } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";

describe("ShortcutUnlock overlay", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    useEconomyStore.getState().reset();
    usePlayerStore.getState().reset();
  });

  it("entry button shows the live deficit price and opens the overlay", () => {
    usePlayerStore.getState().addTokens(4);
    useEconomyStore.getState().refreshLiveDeficitPrice();
    render(<ShortcutEntryButton />);
    const btn = screen.getByTestId("shortcut-entry-button");
    expect(btn).toBeInTheDocument();
    // live price = 4 + 2..3 = 6..7
    expect(screen.getByTestId("shortcut-entry-price").textContent).toMatch(/^[67]$/);
    fireEvent.click(btn);
    expect(useUIStore.getState().activeOverlay).toBe("shortcut-unlock");
  });

  it("overlay shows the active shortcut with its frozen cost", () => {
    useUIStore.getState().showOverlay("shortcut-unlock");
    render(<ShortcutUnlock />);
    expect(screen.getByTestId("shortcut-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("shortcut-active-card")).toBeInTheDocument();
    const cost = Number(screen.getByTestId("shortcut-active-cost").textContent);
    expect(cost).toBeGreaterThanOrEqual(2);
    expect(cost).toBeLessThanOrEqual(3);
  });

  it("unlock button is disabled when balance is insufficient", () => {
    useUIStore.getState().showOverlay("shortcut-unlock");
    render(<ShortcutUnlock />);
    const btn = screen.getByTestId("shortcut-unlock-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("clicking unlock when affordable spends tokens and unlocks the route", () => {
    const active = useEconomyStore.getState().getActiveShortcut()!;
    usePlayerStore.getState().addTokens(active.tokenCost);
    useUIStore.getState().showOverlay("shortcut-unlock");
    render(<ShortcutUnlock />);
    const btn = screen.getByTestId("shortcut-unlock-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(usePlayerStore.getState().tokens).toBe(0);
    expect(
      useEconomyStore.getState().shortcuts.find((s) => s.id === active.id)!.unlocked
    ).toBe(true);
    // spend feedback fired
    expect(useUIStore.getState().activeOverlay).toBe("celebration");
  });

  it("Maybe Later closes the overlay without spending", () => {
    useUIStore.getState().showOverlay("shortcut-unlock");
    render(<ShortcutUnlock />);
    fireEvent.click(screen.getByText(/Maybe Later/i));
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });

  it("backdrop click closes the overlay", () => {
    useUIStore.getState().showOverlay("shortcut-unlock");
    render(<ShortcutUnlock />);
    fireEvent.click(screen.getByTestId("shortcut-overlay"));
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });
});
