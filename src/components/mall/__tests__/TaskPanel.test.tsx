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
    CaretDown: make("CaretDown"),
    ListChecks: make("ListChecks"),
  };
});

import { TaskPanel } from "@/components/tasks/TaskPanel";
import { useUIStore } from "@/stores/uiStore";

describe("TaskPanel", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
  });

  it("renders the bottom panel chrome", () => {
    render(<TaskPanel />);
    expect(screen.getByTestId("task-panel")).toBeInTheDocument();
    expect(screen.getByTestId("task-panel-toggle")).toBeInTheDocument();
  });

  it("defaults to expanded showing the placeholder content", () => {
    render(<TaskPanel />);
    expect(useUIStore.getState().bottomPanelExpanded).toBe(true);
    expect(screen.getByTestId("task-panel-content")).toBeInTheDocument();
  });

  it("toggles collapse on handle click", () => {
    render(<TaskPanel />);
    fireEvent.click(screen.getByTestId("task-panel-toggle"));
    expect(useUIStore.getState().bottomPanelExpanded).toBe(false);
  });

  it("can be expanded again after collapsing", () => {
    render(<TaskPanel />);
    fireEvent.click(screen.getByTestId("task-panel-toggle"));
    expect(useUIStore.getState().bottomPanelExpanded).toBe(false);
    fireEvent.click(screen.getByTestId("task-panel-toggle"));
    expect(useUIStore.getState().bottomPanelExpanded).toBe(true);
  });
});
