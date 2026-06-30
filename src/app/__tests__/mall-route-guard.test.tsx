import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

/* --- Mock next/navigation useRouter (hoisted) --- */
const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => "/mall",
}));

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
      main: mk("main"),
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
    "Compass",
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
    "Lightning",
    "Path",
    "Check",
    "Lock",
    "Minus",
    "Timer",
    "Eye",
    "Sparkle",
    "ArrowRight",
    "Medal",
    "CircleNotch",
    "MapTrifold",
    "Crosshair",
    "Warning",
    "Clock",
    "ArrowUp",
    "ArrowDown",
    "Crown",
    "ClockClockwise",
    "SignOut",
    "Trophy",
    "Heartbeat",
    "ShieldStar",
    "Heart",
    "ShoppingBag",
    "PuzzlePiece",
    "SpeakerHigh",
    "SpeakerSlash",
    "SpinnerGap",
    "CaretUp",
    "Gauge",
    "Gift",
    "PlayCircle",
    "TrendUp",
    "TrendDown",
    "Coins",
  ];
  const obj: Record<string, ReturnType<typeof make>> = {};
  for (const n of names) obj[n] = make(n);
  return obj;
});

/* --- Mock the EventScheduler singleton so no real setInterval runs --- */
vi.mock("@/engine/EventScheduler", () => ({
  getEventScheduler: () => ({ start: vi.fn(), stop: vi.fn(), setHandlers: vi.fn() }),
  resetEventSchedulerSingleton: vi.fn(),
}));

import MallPage from "@/app/mall/page";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";

describe("/mall route guard", () => {
  beforeEach(() => {
    pushMock.mockClear();
    replaceMock.mockClear();
    useOnboardingStore.getState().reset();
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
    useUIStore.getState().reset();
  });

  it("redirects to / when onboarding is not complete (step='invite')", async () => {
    render(<MallPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });

    // The mall map must NOT be rendered while redirecting
    expect(screen.queryByTestId("mall-map")).not.toBeInTheDocument();
    expect(screen.getByText(/Redirecting/i)).toBeInTheDocument();
  });

  it("redirects to / when invite is validated but survey not done (step='survey')", async () => {
    useOnboardingStore.getState().advanceToSurvey();
    render(<MallPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });

    expect(screen.queryByTestId("mall-map")).not.toBeInTheDocument();
  });

  it("renders the mall experience when onboarding is complete (step='mall')", () => {
    useOnboardingStore.getState().advanceToMall();
    usePlayerStore.getState().setSurveyAnswers({ q1: "a", q2: "b", q3: "c" });

    render(<MallPage />);

    // The full mall experience is now rendered: status bar, map, bottom panel
    expect(screen.getByTestId("mall-map")).toBeInTheDocument();
    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
    expect(screen.getByTestId("task-panel")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("the forward flow ends at /mall with onboardingStep='mall'", () => {
    useOnboardingStore.getState().advanceToSurvey();
    useOnboardingStore.getState().advanceToMall();
    render(<MallPage />);

    expect(screen.getByTestId("mall-map")).toBeInTheDocument();
    expect(useOnboardingStore.getState().onboardingStep).toBe("mall");
  });
});
