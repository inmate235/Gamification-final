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
  const names = ["X", "Tag", "Timer", "Users", "Eye", "Lightning"];
  const obj: Record<string, ReturnType<typeof make>> = {};
  for (const n of names) obj[n] = make(n);
  return obj;
});

import { FlashSale, FlashSaleEntryButton } from "@/components/overlays/FlashSale";
import { useUIStore } from "@/stores/uiStore";
import { useEconomyStore } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";

describe("FlashSale overlay (spending path)", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    useEconomyStore.getState().reset();
    usePlayerStore.getState().reset();
  });

  it("entry button triggers a deficit-priced sale and opens the overlay", () => {
    render(<FlashSaleEntryButton />);
    fireEvent.click(screen.getByTestId("flash-sale-entry-button"));
    expect(useUIStore.getState().activeOverlay).toBe("flash-sale");
    expect(useEconomyStore.getState().flashSales.length).toBeGreaterThan(0);
  });

  it("overlay shows store name, discount, token cost, and social proof", () => {
    const sale = useEconomyStore.getState().triggerDeficitFlashSale();
    useUIStore.getState().showOverlay("flash-sale", sale);
    render(<FlashSale />);
    expect(screen.getByTestId("flash-sale-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("flash-sale-discount")).toBeInTheDocument();
    expect(screen.getByTestId("flash-sale-cost").textContent).toMatch(/^\d+$/);
    expect(screen.getByTestId("flash-sale-social-proof").textContent).toMatch(/^\d+$/);
  });

  it("grab button is disabled when balance is insufficient", () => {
    const sale = useEconomyStore.getState().triggerDeficitFlashSale();
    useUIStore.getState().showOverlay("flash-sale", sale);
    render(<FlashSale />);
    expect(
      (screen.getByTestId("flash-sale-grab-button") as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("grabbing the deal when affordable deducts tokens and closes the sale", () => {
    const sale = useEconomyStore.getState().triggerDeficitFlashSale();
    usePlayerStore.getState().addTokens(sale!.tokenCost);
    useUIStore.getState().showOverlay("flash-sale", sale);
    render(<FlashSale />);
    const btn = screen.getByTestId("flash-sale-grab-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(usePlayerStore.getState().tokens).toBe(0);
    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
    // spend feedback fired
    expect(useUIStore.getState().activeOverlay).toBe("celebration");
  });

  it("Maybe Later closes the overlay without charging", () => {
    const sale = useEconomyStore.getState().triggerDeficitFlashSale();
    usePlayerStore.getState().addTokens(sale!.tokenCost);
    useUIStore.getState().showOverlay("flash-sale", sale);
    render(<FlashSale />);
    fireEvent.click(screen.getByText(/Maybe Later/i));
    expect(useUIStore.getState().activeOverlay).toBe("none");
    // balance unchanged, sale still present
    expect(usePlayerStore.getState().tokens).toBe(sale!.tokenCost);
  });
});
