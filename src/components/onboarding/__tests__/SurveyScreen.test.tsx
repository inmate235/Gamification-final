import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

/* --- Mock next/navigation useRouter (hoisted) --- */
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
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

import { SurveyScreen } from "@/components/onboarding/SurveyScreen";
import { SURVEY_QUESTIONS } from "@/lib/bartle";
import { usePlayerStore } from "@/stores/playerStore";

describe("SurveyScreen", () => {
  beforeEach(() => {
    pushMock.mockClear();
    usePlayerStore.getState().reset();
  });

  it("renders the first question on mount", () => {
    render(<SurveyScreen />);
    expect(
      screen.getByText(SURVEY_QUESTIONS[0].prompt)
    ).toBeInTheDocument();
  });

  it("renders progress dots for exactly 3 questions", () => {
    render(<SurveyScreen />);
    // Progress dots are divs with aria-label "Question N ..."
    const dots = screen.getAllByLabelText(/Question \d/);
    expect(dots).toHaveLength(3);
  });

  it("shows question counter (1 of 3)", () => {
    render(<SurveyScreen />);
    expect(screen.getByText(/Question 1 of 3/i)).toBeInTheDocument();
  });

  it("does NOT show a skip button", () => {
    render(<SurveyScreen />);
    expect(
      screen.queryByRole("button", { name: /skip/i })
    ).not.toBeInTheDocument();
  });

  it("auto-advances to next question on selection", async () => {
    const user = userEvent.setup();
    render(<SurveyScreen />);

    // Answer Q1 (style) — pick first option
    const firstOption = screen.getByText(SURVEY_QUESTIONS[0].options[0].label);
    await user.click(firstOption);

    // Wait for auto-advance (650ms delay)
    await waitFor(() => {
      expect(
        screen.getByText(SURVEY_QUESTIONS[1].prompt)
      ).toBeInTheDocument();
    });
  });

  it("stores all answers in playerStore and classifies Bartle type on completion", async () => {
    const user = userEvent.setup();
    render(<SurveyScreen />);

    // Answer all 3 questions
    for (let i = 0; i < SURVEY_QUESTIONS.length; i++) {
      const q = SURVEY_QUESTIONS[i];
      await waitFor(() => {
        expect(screen.getByText(q.prompt)).toBeInTheDocument();
      });
      // Pick first option of each question
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

    // Wait for the final setTimeout to fire (setSurveyAnswers + router.push
    // happen inside the timeout callback on the last question).
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/mall");
    });

    // Verify store was updated
    const state = usePlayerStore.getState();
    expect(Object.keys(state.surveyAnswers)).toHaveLength(3);
    expect(state.surveyAnswers.style).toBe(SURVEY_QUESTIONS[0].options[0].id);
    expect(state.surveyAnswers.social).toBe(SURVEY_QUESTIONS[1].options[0].id);
    expect(state.surveyAnswers.motivation).toBe(
      SURVEY_QUESTIONS[2].options[0].id
    );
    // Bartle type should be set (covertly)
    expect(state.bartleType).not.toBeNull();
    expect(["achiever", "explorer", "socializer", "killer"]).toContain(
      state.bartleType
    );
  });

  it("navigates to /mall after final question", async () => {
    const user = userEvent.setup();
    render(<SurveyScreen />);

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

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/mall");
    });
  });

  it("does not expose Bartle type in the UI", async () => {
    const user = userEvent.setup();
    render(<SurveyScreen />);

    // Answer all questions
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

    // Wait for the store update + navigation to complete
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/mall");
    });

    // No visible text mentioning Bartle type names
    const bodyText = document.body.textContent ?? "";
    expect(bodyText).not.toMatch(/\b(achiever|explorer|socializer|killer)\b/i);
  });

  it("handles rapid double-click on an option without duplicate advancement", async () => {
    const user = userEvent.setup();
    render(<SurveyScreen />);

    const firstOption = screen.getByText(SURVEY_QUESTIONS[0].options[0].label);
    await user.click(firstOption);
    await user.click(firstOption); // rapid double-click

    // Should advance exactly once to Q2
    await waitFor(() => {
      expect(
        screen.getByText(SURVEY_QUESTIONS[1].prompt)
      ).toBeInTheDocument();
    });
    // Should NOT be on Q3 (no double advancement)
    expect(
      screen.queryByText(SURVEY_QUESTIONS[2].prompt)
    ).not.toBeInTheDocument();
  });

  it("first question has 4 options (image cards for style preference)", () => {
    render(<SurveyScreen />);
    for (const opt of SURVEY_QUESTIONS[0].options) {
      expect(screen.getByText(opt.label)).toBeInTheDocument();
    }
    // 4 style options
    const labels = SURVEY_QUESTIONS[0].options.map((o) => o.label);
    expect(labels).toHaveLength(4);
  });

  it("second question has 2 options (social vs solo)", () => {
    expect(SURVEY_QUESTIONS[1].options).toHaveLength(2);
  });

  it("third question has 2 options (deals vs discovery)", () => {
    expect(SURVEY_QUESTIONS[2].options).toHaveLength(2);
  });
});
