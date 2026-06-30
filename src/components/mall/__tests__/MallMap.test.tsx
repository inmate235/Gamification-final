import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* --- Mock framer-motion (factory is lazy-evaluated, React is available) --- */
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
      h1: mk("h1"),
      h2: mk("h2"),
      p: mk("p"),
      g: mk("g"),
      circle: mk("circle"),
      polygon: mk("polygon"),
      rect: mk("rect"),
      line: mk("line"),
      path: mk("path"),
      foreignObject: mk("foreignObject"),
      ellipse: mk("ellipse"),
      image: mk("image"),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

/* --- Mock @phosphor-icons so icons render as simple spans --- */
vi.mock("@phosphor-icons/react/dist/ssr", () => {
  const make = (name: string) => {
    const Cmp = (props: { size?: number; weight?: string; color?: string }) =>
      React.createElement("span", {
        "data-icon": name,
        "data-size": props.size,
        style: { color: props.color },
      });
    Cmp.displayName = `Icon-${name}`;
    return Cmp;
  };
  const names = [
    "Coin",
    "Fire",
    "MapPin",
    "X",
    "Star",
    "Users",
    "Tag",
    "CaretDown",
    "ListChecks",
    "Storefront",
    "Hanger",
    "DeviceMobileCamera",
    "Cpu",
    "Watch",
    "Sunglasses",
    "Lamp",
    "House",
    "Coffee",
    "Fish",
    "Hamburger",
    "ShoppingBag",
    "PuzzlePiece",
  ];
  const obj: Record<string, ReturnType<typeof make>> = {};
  for (const n of names) obj[n] = make(n);
  return obj;
});

import { MallMap, __resetFirstMoveFlag } from "@/components/mall/MallMap";
import { useMapStore } from "@/stores/mapStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useUIStore } from "@/stores/uiStore";
import {
  ZONE_ENTRANCE,
  ZONE_EAST_WING,
  ZONE_WEST_WING,
  ZONE_CENTRAL_PLAZA,
  ZONE_FOOD_COURT,
} from "@/data/mallData";

describe("MallMap", () => {
  beforeEach(() => {
    useMapStore.getState().reset();
    usePlayerStore.getState().reset();
    useUIStore.getState().reset();
    __resetFirstMoveFlag();
  });

  it("renders an SVG map container", () => {
    render(<MallMap />);
    expect(screen.getByTestId("mall-map-svg")).toBeInTheDocument();
  });

  it("renders all 5 zone polygons", () => {
    render(<MallMap />);
    for (const zoneId of [
      ZONE_ENTRANCE,
      ZONE_EAST_WING,
      ZONE_WEST_WING,
      ZONE_CENTRAL_PLAZA,
      ZONE_FOOD_COURT,
    ]) {
      expect(screen.getByTestId(`zone-${zoneId}`)).toBeInTheDocument();
    }
  });

  it("renders a fog overlay for each unexplored zone", () => {
    render(<MallMap />);
    expect(screen.getByTestId(`fog-${ZONE_EAST_WING}`)).toBeInTheDocument();
    expect(screen.getByTestId(`fog-${ZONE_FOOD_COURT}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`fog-${ZONE_ENTRANCE}`)).toBeInTheDocument();
  });

  it("shows store markers only for revealed zones on first load", () => {
    render(<MallMap />);
    // Entrance stores (Bloom, Pulse, Murky Playground) are visible
    expect(screen.getByTestId("store-marker-store-bloom")).toBeInTheDocument();
    expect(screen.getByTestId("store-marker-store-pulse")).toBeInTheDocument();
    expect(screen.getByTestId("store-marker-store-murky-playground")).toBeInTheDocument();
    // East Wing stores are hidden (fogged)
    expect(screen.queryByTestId("store-marker-store-technova")).not.toBeInTheDocument();
    expect(screen.queryByTestId("store-marker-store-chrome")).not.toBeInTheDocument();
    // Food Court stores are hidden
    expect(screen.queryByTestId("store-marker-store-cafe-nuit")).not.toBeInTheDocument();
  });

  it("shows zone labels only for revealed zones", () => {
    render(<MallMap />);
    expect(screen.getByTestId(`zone-label-${ZONE_ENTRANCE}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`zone-label-${ZONE_EAST_WING}`)).not.toBeInTheDocument();
  });

  it("clicking an adjacent zone moves the player and reveals it", async () => {
    render(<MallMap />);
    const east = screen.getByTestId(`zone-${ZONE_EAST_WING}`);
    fireEvent.click(east);
    await waitFor(() => {
      expect(useMapStore.getState().playerPosition.zoneId).toBe(ZONE_EAST_WING);
    });
    expect(useMapStore.getState().fogState[ZONE_EAST_WING]).toBe(true);
  });

  it("moving into a fogged zone awards tokens and shows a celebration", async () => {
    render(<MallMap />);
    fireEvent.click(screen.getByTestId(`zone-${ZONE_EAST_WING}`));
    await waitFor(() => {
      expect(usePlayerStore.getState().tokens).toBeGreaterThan(0);
    });
    expect(useUIStore.getState().celebrationQueue.length).toBeGreaterThan(0);
  });

  it("clicking a non-adjacent zone does not move the player", () => {
    render(<MallMap />);
    const before = useMapStore.getState().playerPosition.zoneId;
    // Food Court is not adjacent to Entrance
    fireEvent.click(screen.getByTestId(`zone-${ZONE_FOOD_COURT}`));
    expect(useMapStore.getState().playerPosition.zoneId).toBe(before);
  });

  it("clicking the current zone is a no-op", () => {
    render(<MallMap />);
    const tokensBefore = usePlayerStore.getState().tokens;
    fireEvent.click(screen.getByTestId(`zone-${ZONE_ENTRANCE}`));
    expect(useMapStore.getState().playerPosition.zoneId).toBe(ZONE_ENTRANCE);
    expect(usePlayerStore.getState().tokens).toBe(tokensBefore);
  });

  it("the first move from entrance triggers the first-token celebration", async () => {
    render(<MallMap />);
    fireEvent.click(screen.getByTestId(`zone-${ZONE_EAST_WING}`));
    await waitFor(() => {
      expect(useUIStore.getState().celebrationQueue.length).toBeGreaterThan(0);
    });
    const data = useUIStore.getState().celebrationQueue[0] as { message: string };
    expect(data.message).toContain("+1 Token");
  });

  it("tapping a store marker opens the store detail overlay", () => {
    render(<MallMap />);
    fireEvent.click(screen.getByTestId("store-marker-store-bloom"));
    expect(useUIStore.getState().activeOverlay).toBe("store-detail");
    const data = useUIStore.getState().overlayData as { id: string };
    expect(data.id).toBe("store-bloom");
  });

  it("marks reachable adjacent zones with a hint overlay", () => {
    render(<MallMap />);
    expect(screen.getByTestId(`zone-hint-${ZONE_EAST_WING}`)).toBeInTheDocument();
    expect(screen.getByTestId(`zone-hint-${ZONE_WEST_WING}`)).toBeInTheDocument();
    // Food Court is not adjacent -> no hint
    expect(screen.queryByTestId(`zone-hint-${ZONE_FOOD_COURT}`)).not.toBeInTheDocument();
  });

  it("does not move the avatar while the store-detail overlay is open", () => {
    render(<MallMap />);
    // Open store detail
    fireEvent.click(screen.getByTestId("store-marker-store-bloom"));
    expect(useUIStore.getState().activeOverlay).toBe("store-detail");
    const before = useMapStore.getState().playerPosition.zoneId;
    // Click an adjacent zone behind the overlay -> blocked
    fireEvent.click(screen.getByTestId(`zone-${ZONE_EAST_WING}`));
    expect(useMapStore.getState().playerPosition.zoneId).toBe(before);
  });

  it("traverses entrance -> east -> central -> food court (full path)", async () => {
    render(<MallMap />);
    fireEvent.click(screen.getByTestId(`zone-${ZONE_EAST_WING}`));
    await waitFor(() => {
      expect(useMapStore.getState().playerPosition.zoneId).toBe(ZONE_EAST_WING);
    });
    fireEvent.click(screen.getByTestId(`zone-${ZONE_CENTRAL_PLAZA}`));
    await waitFor(() => {
      expect(useMapStore.getState().playerPosition.zoneId).toBe(ZONE_CENTRAL_PLAZA);
    });
    fireEvent.click(screen.getByTestId(`zone-${ZONE_FOOD_COURT}`));
    await waitFor(() => {
      expect(useMapStore.getState().playerPosition.zoneId).toBe(ZONE_FOOD_COURT);
    });
    expect(useMapStore.getState().fogState[ZONE_FOOD_COURT]).toBe(true);
  });
});
