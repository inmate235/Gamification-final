import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
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
      layoutId,
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
    void layoutId;
    return rest;
  };
  const mk = (tag: string) => {
    const comp = React.forwardRef<HTMLElement, Record<string, unknown>>(
      (props, ref) =>
        React.createElement(
          tag,
          { ref, ...(strip(props) as Record<string, unknown>) },
          props.children as React.ReactNode,
        ),
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
      ol: mk("ol"),
      li: mk("li"),
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
    "Trophy",
    "X",
    "Coin",
    "Clock",
    "MapPin",
    "Crown",
    "CaretUp",
    "CaretDown",
  ];
  const map: Record<string, ReturnType<typeof make>> = {};
  for (const i of icons) map[i] = make(i);
  return map;
});

import {
  Leaderboard,
  LeaderboardEntryButton,
  ProximityAlertBanner,
} from "@/components/social/Leaderboard";
import { useUIStore } from "@/stores/uiStore";
import { useSocialStore } from "@/stores/socialStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { resetPhantomEngine } from "@/engine/phantomEngine";

describe("Leaderboard overlay (VAL-LEADER-001..025)", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    useSocialStore.getState().reset();
    usePlayerStore.getState().reset();
    useSessionStore.getState().reset();
    resetPhantomEngine();
  });

  it("entry button is rendered and accessible from the mall view (VAL-LEADER-001)", () => {
    render(<LeaderboardEntryButton />);
    const btn = screen.getByTestId("leaderboard-entry-button");
    expect(btn).toBeInTheDocument();
  });

  it("entry button opens the leaderboard overlay via the uiStore (VAL-LEADER-023)", () => {
    render(<LeaderboardEntryButton />);
    act(() => {
      screen.getByTestId("leaderboard-entry-button").click();
    });
    expect(useUIStore.getState().activeOverlay).toBe("leaderboard");
  });

  it("renders nothing when the leaderboard overlay is not active", () => {
    render(<Leaderboard />);
    expect(screen.queryByTestId("leaderboard-overlay")).not.toBeInTheDocument();
  });

  it("renders a ranked list with contiguous 1-indexed ranks (VAL-LEADER-002, -021)", () => {
    act(() => {
      usePlayerStore.getState().addTokens(15);
      useSocialStore.getState().updateLeaderboard();
      useUIStore.getState().showOverlay("leaderboard");
    });
    render(<Leaderboard />);
    const list = screen.getByTestId("leaderboard-list");
    const rows = list.querySelectorAll('[data-testid="leaderboard-row"]');
    expect(rows.length).toBeGreaterThan(0);
    // Ranks contiguous starting at 1 within the displayed window.
    const ranks = Array.from(rows).map(
      (r) => Number(r.getAttribute("data-rank")),
    );
    expect(ranks[0]).toBe(1);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBe(ranks[i - 1] + 1);
    }
  });

  it("highlights the user's row (VAL-LEADER-003, -018)", () => {
    act(() => {
      useSocialStore.getState().updateLeaderboard();
      useUIStore.getState().showOverlay("leaderboard");
    });
    render(<Leaderboard />);
    const playerRow = screen
      .getByTestId("leaderboard-list")
      .querySelector('[data-player="true"]');
    expect(playerRow).toBeTruthy();
  });

  it("shows all three metrics simultaneously per row (VAL-LEADER-007)", () => {
    act(() => {
      useSocialStore.getState().updateLeaderboard();
      useUIStore.getState().showOverlay("leaderboard");
    });
    render(<Leaderboard />);
    const rows = screen
      .getByTestId("leaderboard-list")
      .querySelectorAll('[data-testid="leaderboard-row"]');
    expect(rows.length).toBeGreaterThan(0);
    // Every row's text contains token count, minutes and a percent sign.
    for (const row of rows) {
      const txt = row.textContent ?? "";
      expect(txt).toMatch(/\d/); // token count digits
      expect(txt).toMatch(/\d+m/); // minutes (e.g. "76m")
      expect(txt).toContain("%"); // exploration
    }
  });

  it("metric tabs switch the sort metric (VAL-LEADER-019)", () => {
    act(() => {
      useSocialStore.getState().updateLeaderboard();
      useUIStore.getState().showOverlay("leaderboard");
    });
    render(<Leaderboard />);
    const explorationTab = screen.getByTestId("leaderboard-metric-exploration");
    act(() => {
      explorationTab.click();
    });
    expect(useSocialStore.getState().activeMetric).toBe("exploration");
    expect(explorationTab.getAttribute("data-active")).toBe("true");
  });

  it("bounded entry count (VAL-LEADER-022)", () => {
    act(() => {
      useSocialStore.getState().updateLeaderboard();
      useUIStore.getState().showOverlay("leaderboard");
    });
    render(<Leaderboard />);
    const rows = screen
      .getByTestId("leaderboard-list")
      .querySelectorAll('[data-testid="leaderboard-row"]');
    expect(rows.length).toBeLessThanOrEqual(12);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it("dismisses on close button", () => {
    act(() => useUIStore.getState().showOverlay("leaderboard"));
    render(<Leaderboard />);
    act(() => {
      screen.getByLabelText("Close leaderboard").click();
    });
    expect(useUIStore.getState().activeOverlay).toBe("none");
  });

  it("proximity alert banner names the phantom, gap and rank (VAL-LEADER-011..013)", () => {
    act(() => {
      useSocialStore.getState().triggerProximityAlert(
        "Alex",
        2,
        5,
        "tokens",
        "2 tokens",
      );
    });
    render(<ProximityAlertBanner />);
    const banner = screen.getByTestId("proximity-alert-banner");
    const text = within(banner).getByTestId("proximity-alert-text");
    expect(text.textContent).toContain("Alex");
    expect(text.textContent).toContain("#5");
    expect(text.textContent).toContain("2 tokens");
  });

  it("proximity alert banner is hidden when a non-shopping overlay is open", () => {
    act(() => {
      useSocialStore.getState().triggerProximityAlert(
        "Alex",
        2,
        5,
        "tokens",
        "2 tokens",
      );
      // tier-upgrade is not a shopping overlay, so the banner should be hidden.
      useUIStore.getState().showOverlay("tier-upgrade");
    });
    render(<ProximityAlertBanner />);
    expect(screen.queryByTestId("proximity-alert-banner")).not.toBeInTheDocument();
  });

  it("proximity alert banner stays visible when the shop overlay is open", () => {
    act(() => {
      useSocialStore.getState().triggerProximityAlert(
        "Alex",
        2,
        5,
        "tokens",
        "2 tokens",
      );
      useUIStore.getState().showOverlay("shop");
    });
    render(<ProximityAlertBanner />);
    expect(screen.queryByTestId("proximity-alert-banner")).toBeInTheDocument();
  });
});
