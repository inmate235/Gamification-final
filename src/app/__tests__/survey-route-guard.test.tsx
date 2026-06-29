import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

/* --- Mock next/navigation useRouter (hoisted) --- */
const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => "/survey",
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

/* --- Mock ParticleField to avoid animation complexity --- */
vi.mock("@/components/onboarding/ParticleField", () => ({
  ParticleField: () => null,
}));

import SurveyPage from "@/app/survey/page";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { usePlayerStore } from "@/stores/playerStore";
import { SURVEY_QUESTIONS } from "@/data/surveyData";

describe("/survey route guard", () => {
  beforeEach(() => {
    pushMock.mockClear();
    replaceMock.mockClear();
    useOnboardingStore.getState().reset();
    usePlayerStore.getState().reset();
  });

  it("redirects to / when invite code has not been validated (step='invite')", async () => {
    // onboardingStep defaults to 'invite' (not validated)
    render(<SurveyPage />);

    // Guard should call router.replace("/")
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });

    // The survey prompt must NOT be rendered while redirecting
    expect(
      screen.queryByText(SURVEY_QUESTIONS[0].prompt)
    ).not.toBeInTheDocument();

    // A redirecting placeholder is shown
    expect(screen.getByText(/Redirecting/i)).toBeInTheDocument();
  });

  it("renders the survey when invite code has been validated (step='survey')", () => {
    useOnboardingStore.getState().advanceToSurvey();
    render(<SurveyPage />);

    expect(
      screen.getByText(SURVEY_QUESTIONS[0].prompt)
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("renders the survey when onboarding is fully complete (step='mall')", () => {
    useOnboardingStore.getState().advanceToMall();
    render(<SurveyPage />);

    expect(
      screen.getByText(SURVEY_QUESTIONS[0].prompt)
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("the forward flow still works: validated invite -> survey renders -> answer all -> /mall", async () => {
    const user = userEvent.setup();
    useOnboardingStore.getState().advanceToSurvey();
    render(<SurveyPage />);

    // Answer all 3 questions
    for (let i = 0; i < SURVEY_QUESTIONS.length; i++) {
      const q = SURVEY_QUESTIONS[i];
      await waitFor(() => {
        expect(screen.getByText(q.prompt)).toBeInTheDocument();
      });
      const option = screen.getByText(q.options[0].label);
      await user.click(option);
      if (i < SURVEY_QUESTIONS.length - 1) {
        await waitFor(() => {
          expect(
            screen.getByText(SURVEY_QUESTIONS[i + 1].prompt)
          ).toBeInTheDocument();
        });
      }
    }

    // Navigation to /mall fires and the step advanced to 'mall'
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/mall");
    });
    expect(useOnboardingStore.getState().onboardingStep).toBe("mall");
  });
});
