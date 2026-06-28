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
    CaretDown: make("CaretDown"),
    ListChecks: make("ListChecks"),
    Compass: make("Compass"),
    Coin: make("Coin"),
    Storefront: make("Storefront"),
    Timer: make("Timer"),
    Star: make("Star"),
  };
});

import { TaskPanel } from "@/components/tasks/TaskPanel";
import { useUIStore } from "@/stores/uiStore";
import { useTaskStore } from "@/stores/taskStore";
import { useMapStore } from "@/stores/mapStore";
import { ZONE_EAST_WING } from "@/data/mallData";
import type { Task } from "@/types";

function setTasks(tasks: Task[]) {
  useTaskStore.setState({
    activeTasks: tasks,
    completedTasks: [],
    taskChain: 0,
  });
}

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    type: "explore-zone",
    description: "Explore the East Wing",
    reward: 4,
    timeGated: false,
    difficulty: 1,
    chainLevel: 0,
    assignedAt: Date.now(),
    targetZone: ZONE_EAST_WING,
    ...overrides,
  };
}

describe("TaskPanel", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    useMapStore.getState().reset();
    useTaskStore.getState().reset();
  });

  it("renders the task panel chrome with a task count", () => {
    setTasks([makeTask({})]);
    render(<TaskPanel />);
    expect(screen.getByTestId("task-panel")).toBeInTheDocument();
    expect(screen.getByTestId("task-panel-count")).toHaveTextContent("1");
  });

  it("shows task card description and reward when expanded", () => {
    useUIStore.getState().setBottomPanelExpanded(true);
    setTasks([
      makeTask({ description: "Explore the East Wing", reward: 5 }),
    ]);
    render(<TaskPanel />);
    expect(screen.getByTestId("task-card-description")).toHaveTextContent(
      "Explore the East Wing"
    );
    expect(screen.getByTestId("task-card-reward")).toHaveTextContent("+5");
  });

  it("shows multiple active tasks simultaneously", () => {
    useUIStore.getState().setBottomPanelExpanded(true);
    setTasks([
      makeTask({ id: "t1", description: "Explore the East Wing", reward: 3 }),
      makeTask({
        id: "t2",
        type: "visit-stores",
        description: "Visit 2 stores in the East Wing",
        reward: 6,
      }),
    ]);
    render(<TaskPanel />);
    const cards = screen.getAllByTestId("task-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByTestId("task-panel-count")).toHaveTextContent("2");
  });

  it("toggles expand/collapse via the handle", () => {
    setTasks([makeTask({})]);
    render(<TaskPanel />);
    expect(useUIStore.getState().bottomPanelExpanded).toBe(true);
    act(() => {
      fireEvent.click(screen.getByTestId("task-panel-toggle"));
    });
    expect(useUIStore.getState().bottomPanelExpanded).toBe(false);
    act(() => {
      fireEvent.click(screen.getByTestId("task-panel-toggle"));
    });
    expect(useUIStore.getState().bottomPanelExpanded).toBe(true);
  });

  it("displays a countdown for time-gated tasks", () => {
    useUIStore.getState().setBottomPanelExpanded(true);
    setTasks([
      makeTask({
        timeGated: true,
        gateUntil: Date.now() + 90 * 1000,
        description: "Find a hidden token",
      }),
    ]);
    render(<TaskPanel />);
    const timer = screen.getByTestId("task-card-timer");
    expect(timer.textContent).toMatch(/\d:\d\d/);
  });

  it("marks a time-gated task ready when the gate has elapsed", () => {
    useUIStore.getState().setBottomPanelExpanded(true);
    setTasks([
      makeTask({
        timeGated: true,
        gateUntil: Date.now() - 1000,
      }),
    ]);
    render(<TaskPanel />);
    expect(screen.getByTestId("task-card-timer")).toHaveTextContent("Ready");
  });
});
