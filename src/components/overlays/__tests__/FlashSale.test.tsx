import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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
  const names = [
    "X",
    "Tag",
    "Timer",
    "Users",
    "Eye",
    "Lightning",
    "CheckCircle",
  ];
  const obj: Record<string, ReturnType<typeof make>> = {};
  for (const n of names) obj[n] = make(n);
  return obj;
});

import { FlashSale, FlashSaleEntryButton } from "@/components/overlays/FlashSale";
import { useUIStore } from "@/stores/uiStore";
import { useEconomyStore } from "@/stores/economyStore";
import { usePlayerStore } from "@/stores/playerStore";
import {
  buildAndPushSale,
  dismissFlashSale,
  expireFlashSale,
  resetFlashSaleEngine,
  getRefractoryMap,
} from "@/engine/flashSaleEngine";
import { getStoreById } from "@/data/mallData";
import type { Store } from "@/types";

/**
 * Build a sale for a specific store via the engine so tests exercise the real
 * proximity/personalization path (deficit price, synthetic timer, social
 * proof).
 */
function pushSaleForStore(store: Store) {
  return buildAndPushSale(store, null);
}

describe("FlashSale overlay (spending + proximity path)", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    useEconomyStore.getState().reset();
    usePlayerStore.getState().reset();
    resetFlashSaleEngine();
  });

  it("entry button is hidden when there are no pending sales", () => {
    render(<FlashSaleEntryButton />);
    expect(
      screen.queryByTestId("flash-sale-entry-button")
    ).not.toBeInTheDocument();
  });

  it("entry button surfaces a pending sale and opens the overlay on click", () => {
    const store = getStoreById("store-bloom")!;
    pushSaleForStore(store);
    render(<FlashSaleEntryButton />);
    fireEvent.click(screen.getByTestId("flash-sale-entry-button"));
    expect(useUIStore.getState().activeOverlay).toBe("flash-sale");
  });

  it("overlay shows store name, discount, item, token cost, and social proof", () => {
    const store = getStoreById("store-technova")!;
    const sale = pushSaleForStore(store);
    useUIStore.getState().showOverlay("flash-sale", sale);
    render(<FlashSale />);
    expect(screen.getByTestId("flash-sale-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("flash-sale-store-name").textContent).toBe(
      "TechNova"
    );
    expect(screen.getByTestId("flash-sale-discount")).toBeInTheDocument();
    expect(screen.getByTestId("flash-sale-item").textContent).toBeTruthy();
    expect(screen.getByTestId("flash-sale-cost").textContent).toMatch(/^\d+$/);
    expect(
      screen.getByTestId("flash-sale-social-proof").textContent
    ).toMatch(/^\d+$/);
  });

  it("token cost is deficit-engineered (balance + 2..3)", () => {
    usePlayerStore.getState().addTokens(7);
    const store = getStoreById("store-bloom")!;
    const sale = pushSaleForStore(store);
    expect(sale.tokenCost).toBeGreaterThanOrEqual(9);
    expect(sale.tokenCost).toBeLessThanOrEqual(10);
  });

  it("grab button is disabled when balance is insufficient", () => {
    const store = getStoreById("store-bloom")!;
    const sale = pushSaleForStore(store);
    useUIStore.getState().showOverlay("flash-sale", sale);
    render(<FlashSale />);
    expect(
      (screen.getByTestId("flash-sale-grab-button") as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("grabbing the deal when affordable deducts tokens and shows claimed state", () => {
    const store = getStoreById("store-bloom")!;
    const sale = pushSaleForStore(store);
    usePlayerStore.getState().addTokens(sale.tokenCost);
    useUIStore.getState().showOverlay("flash-sale", sale);
    render(<FlashSale />);
    const btn = screen.getByTestId("flash-sale-grab-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    // Tokens deducted to zero.
    expect(usePlayerStore.getState().tokens).toBe(0);
    // Sale removed from the store.
    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
    // Spend celebration fired (claimed confirmation -> celebration overlay).
    expect(useUIStore.getState().activeOverlay).toBe("celebration");
  });

  it("Maybe Later dismisses without charging and applies refractory", () => {
    const store = getStoreById("store-bloom")!;
    const sale = pushSaleForStore(store);
    usePlayerStore.getState().addTokens(sale.tokenCost);
    useUIStore.getState().showOverlay("flash-sale", sale);
    render(<FlashSale />);
    fireEvent.click(screen.getByTestId("flash-sale-maybe-later"));
    expect(useUIStore.getState().activeOverlay).toBe("none");
    // Balance unchanged.
    expect(usePlayerStore.getState().tokens).toBe(sale.tokenCost);
    // Sale removed.
    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
    // Refractory recorded for the dismissed store.
    expect(getRefractoryMap()[store.id]).toBeGreaterThan(0);
  });

  it("expiry removes the sale without charging tokens", () => {
    const store = getStoreById("store-bloom")!;
    const sale = pushSaleForStore(store);
    const balanceBefore = usePlayerStore.getState().tokens;
    useUIStore.getState().showOverlay("flash-sale", sale);
    render(<FlashSale />);
    // Drive the countdown to zero by expiring through the engine directly
    // (simulating the synthetic timer reaching 0 without waiting in tests).
    act(() => {
      expireFlashSale(sale.id);
    });
    expect(useEconomyStore.getState().flashSales).toHaveLength(0);
    expect(usePlayerStore.getState().tokens).toBe(balanceBefore);
  });

  it("dismiss via engine helper is a no-op when sale id is unknown", () => {
    expect(() => dismissFlashSale("does-not-exist")).not.toThrow();
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });
});
