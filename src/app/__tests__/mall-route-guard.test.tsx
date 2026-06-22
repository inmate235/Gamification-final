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
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

import MallPage from "@/app/mall/page";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { usePlayerStore } from "@/stores/playerStore";

describe("/mall route guard", () => {
  beforeEach(() => {
    pushMock.mockClear();
    replaceMock.mockClear();
    useOnboardingStore.getState().reset();
    usePlayerStore.getState().reset();
  });

  it("redirects to / when onboarding is not complete (step='invite')", async () => {
    render(<MallPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });

    // The mall content must NOT be rendered while redirecting
    expect(screen.queryByText(/Welcome to the Mall/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Redirecting/i)).toBeInTheDocument();
  });

  it("redirects to / when invite is validated but survey not done (step='survey')", async () => {
    useOnboardingStore.getState().advanceToSurvey();
    render(<MallPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });

    expect(screen.queryByText(/Welcome to the Mall/i)).not.toBeInTheDocument();
  });

  it("renders the mall content when onboarding is complete (step='mall')", () => {
    useOnboardingStore.getState().advanceToMall();
    // Provide survey answers so the stub shows a non-zero count
    usePlayerStore.getState().setSurveyAnswers({ q1: "a", q2: "b", q3: "c" });

    render(<MallPage />);

    expect(screen.getByText(/Welcome to the Mall/i)).toBeInTheDocument();
    expect(screen.getByText(/Onboarding complete/i)).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("the forward flow ends at /mall with onboardingStep='mall'", () => {
    useOnboardingStore.getState().advanceToSurvey();
    useOnboardingStore.getState().advanceToMall();
    render(<MallPage />);

    expect(screen.getByText(/Welcome to the Mall/i)).toBeInTheDocument();
    expect(useOnboardingStore.getState().onboardingStep).toBe("mall");
  });
});
