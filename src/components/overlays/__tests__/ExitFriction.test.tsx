import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

/* --- Mock framer-motion (strip animation props, render plain elements) --- */
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
      onAnimationComplete,
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
    void onAnimationComplete;
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
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

/* --- Mock Phosphor icons --- */
vi.mock("@phosphor-icons/react/dist/ssr", () => {
  const make = (name: string) => {
    const Cmp = () => React.createElement("span", { "data-icon": name });
    Cmp.displayName = `Icon-${name}`;
    return Cmp;
  };
  const names = [
    "X",
    "SignOut",
    "Sparkle",
    "Fire",
    "Coins",
    "Clock",
    "MapPin",
    "Trophy",
    "Users",
    "Tag",
    "CircleNotch",
    "ShieldStar",
    "ArrowRight",
    "Heartbeat",
    "Heart",
  ];
  const icons: Record<string, ReturnType<typeof make>> = {};
  for (const n of names) icons[n] = make(n);
  return icons;
});

import { ExitFriction } from "@/components/overlays/ExitFriction";
import { LeaveMallButton } from "@/components/mall/LeaveMallButton";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useEconomyStore } from "@/stores/economyStore";
import { initiateExit, leaveAnyway } from "@/engine/exitFrictionEngine";

function resetAllStores() {
  useUIStore.getState().reset();
  useSessionStore.getState().reset();
  usePlayerStore.getState().reset();
  useEconomyStore.getState().reset();
}

describe("LeaveMallButton (VAL-EXIT-001)", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("renders the Leave Mall button when no overlay is active", () => {
    render(<LeaveMallButton />);
    expect(screen.getByTestId("leave-mall-button")).toBeInTheDocument();
  });

  it("is hidden while another overlay is active", () => {
    act(() => useUIStore.getState().showOverlay("store-detail"));
    render(<LeaveMallButton />);
    expect(screen.queryByTestId("leave-mall-button")).not.toBeInTheDocument();
  });

  it("is hidden after the user has exited the mall", () => {
    act(() => useSessionStore.getState().leaveMall());
    render(<LeaveMallButton />);
    expect(screen.queryByTestId("leave-mall-button")).not.toBeInTheDocument();
  });

  it("clicking it opens the exit-friction overlay at Layer 1", () => {
    render(<LeaveMallButton />);
    act(() => {
      fireEvent.click(screen.getByTestId("leave-mall-button"));
    });
    expect(useUIStore.getState().activeOverlay).toBe("exit-friction");
    expect(useSessionStore.getState().exitFrictionLayer).toBe(1);
  });
});

describe("ExitFriction overlay — layer rendering (VAL-EXIT-002..016)", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("renders nothing when no exit-friction overlay is active", () => {
    render(<ExitFriction />);
    expect(screen.queryByTestId("exit-friction-overlay")).not.toBeInTheDocument();
  });

  it("Layer 1 shows missed-opportunity info: unexplored % and tokens-away", () => {
    act(() => {
      usePlayerStore.getState().addTokens(4);
      useEconomyStore.getState().refreshLiveDeficitPrice();
      initiateExit();
    });
    render(<ExitFriction />);
    expect(screen.getByTestId("exit-friction-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("exit-friction-layer-1")).toBeInTheDocument();
    expect(screen.getByTestId("exit-friction-unexplored")).toBeInTheDocument();
    expect(screen.getByTestId("exit-friction-tokens-away")).toBeInTheDocument();
  });

  it("Layer 2 shows streak status and sunk-cost summary", () => {
    act(() => {
      initiateExit(); // layer 1
      leaveAnyway(); // -> layer 2
    });
    render(<ExitFriction />);
    expect(screen.getByTestId("exit-friction-layer-2")).toBeInTheDocument();
    expect(screen.getByTestId("exit-friction-streak")).toBeInTheDocument();
    expect(screen.getByTestId("exit-friction-sunk-cost")).toBeInTheDocument();
    expect(screen.getByTestId("exit-friction-sunk-tokens")).toBeInTheDocument();
    expect(screen.getByTestId("exit-friction-sunk-time")).toBeInTheDocument();
    expect(screen.getByTestId("exit-friction-sunk-progress")).toBeInTheDocument();
    expect(screen.getByTestId("exit-friction-friends")).toBeInTheDocument();
  });

  it("Layer 3 enumerates bonus wheel, streak protection, and 2x tokens", () => {
    act(() => {
      initiateExit();
      leaveAnyway();
      leaveAnyway(); // -> layer 3
    });
    render(<ExitFriction />);
    expect(screen.getByTestId("exit-friction-layer-3")).toBeInTheDocument();
    expect(screen.getByTestId("exit-friction-bonus-wheel")).toBeInTheDocument();
    expect(
      screen.getByTestId("exit-friction-streak-protection")
    ).toBeInTheDocument();
    expect(screen.getByTestId("exit-friction-token-boost")).toBeInTheDocument();
  });

  it("each layer has Stay and Leave anyway options (VAL-EXIT-018, VAL-EXIT-019)", () => {
    act(() => initiateExit());
    render(<ExitFriction />);
    expect(screen.getByTestId("exit-friction-stay")).toBeInTheDocument();
    expect(screen.getByTestId("exit-friction-leave")).toBeInTheDocument();
  });
});

describe("ExitFriction overlay — interactions", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("Stay resets the counter and closes the overlay (VAL-EXIT-022)", () => {
    act(() => initiateExit());
    render(<ExitFriction />);
    act(() => fireEvent.click(screen.getByTestId("exit-friction-stay")));
    expect(useSessionStore.getState().exitAttempts).toBe(0);
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });

  it("Leave anyway advances from Layer 1 to Layer 2", () => {
    act(() => initiateExit());
    render(<ExitFriction />);
    act(() => fireEvent.click(screen.getByTestId("exit-friction-leave")));
    expect(useSessionStore.getState().exitFrictionLayer).toBe(2);
  });

  it("Leave anyway on Layer 3 exits the mall and resets state (VAL-EXIT-017, VAL-EXIT-032)", () => {
    act(() => {
      initiateExit();
      leaveAnyway();
      leaveAnyway(); // layer 3
    });
    render(<ExitFriction />);
    act(() => fireEvent.click(screen.getByTestId("exit-friction-leave")));
    expect(useSessionStore.getState().exited).toBe(true);
    expect(useSessionStore.getState().exitAttempts).toBe(0);
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });

  it("Accept & Stay on Layer 3 activates bonuses and keeps user in mall (VAL-EXIT-027)", () => {
    act(() => {
      initiateExit();
      leaveAnyway();
      leaveAnyway(); // layer 3
    });
    render(<ExitFriction />);
    act(() => fireEvent.click(screen.getByTestId("exit-friction-stay")));
    expect(useUIStore.getState().activeOverlay).toBe("none");
    expect(useSessionStore.getState().exited).toBe(false);
    expect(useEconomyStore.getState().spinningWheel.available).toBe(true);
    expect(usePlayerStore.getState().streak.streakProtected).toBe(true);
    expect(usePlayerStore.getState().rescueBoost).not.toBeNull();
  });

  it("close (X) acts as Stay and dismisses the overlay (VAL-EXIT-003)", () => {
    act(() => initiateExit());
    render(<ExitFriction />);
    act(() => fireEvent.click(screen.getByTestId("exit-friction-close")));
    expect(useUIStore.getState().activeOverlay).toBe("none");
    expect(useSessionStore.getState().exitAttempts).toBe(0);
  });
});
