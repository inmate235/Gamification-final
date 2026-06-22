import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

/* --- Mock next/navigation useRouter (hoisted) --- */
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  usePathname: () => "/",
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

/* --- Mock ParticleField to avoid Math.random + animation complexity --- */
vi.mock("@/components/onboarding/ParticleField", () => ({
  ParticleField: () => null,
}));

import { InviteScreen } from "@/components/onboarding/InviteScreen";

describe("InviteScreen", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("renders invite code input and ENTER MALL button", () => {
    render(<InviteScreen />);
    expect(screen.getByLabelText("Invite code")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ENTER MALL/i })
    ).toBeInTheDocument();
  });

  it("displays exclusivity / invite-only messaging", () => {
    render(<InviteScreen />);
    expect(screen.getByText(/Invite Only/i)).toBeInTheDocument();
  });

  it("shows social proof with inviter name and tier", () => {
    render(<InviteScreen />);
    expect(screen.getByText(/Invited by Sarah/i)).toBeInTheDocument();
    expect(screen.getByText(/Gold member/i)).toBeInTheDocument();
  });

  it("blocks empty submission with validation error", async () => {
    const user = userEvent.setup();
    render(<InviteScreen />);
    const button = screen.getByRole("button", { name: /ENTER MALL/i });
    await user.click(button);
    expect(screen.getByRole("alert")).toHaveTextContent(/invite code/i);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows error for invalid code format", async () => {
    const user = userEvent.setup();
    render(<InviteScreen />);
    const input = screen.getByLabelText("Invite code");
    await user.type(input, "WRONG");
    const button = screen.getByRole("button", { name: /ENTER MALL/i });
    await user.click(button);
    expect(screen.getByRole("alert")).toHaveTextContent(/isn't recognized/i);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("accepts a valid-format code and triggers welcome animation then navigation", async () => {
    const user = userEvent.setup();
    render(<InviteScreen />);
    const input = screen.getByLabelText("Invite code");
    await user.type(input, "MURKY-2025-ABC");
    const button = screen.getByRole("button", { name: /ENTER MALL/i });
    await user.click(button);

    // Welcome animation should appear — check for the "Tap to continue"
    // hint which is unique to the welcome phase.
    await waitFor(() => {
      expect(screen.getByText(/Tap to continue/i)).toBeInTheDocument();
    });

    // After the welcome animation timer (3200ms), navigate to /survey
    await waitFor(
      () => {
        expect(pushMock).toHaveBeenCalledWith("/survey");
      },
      { timeout: 5000 }
    );
  });

  it("handles rapid double-submission idempotently (no duplicate navigation)", async () => {
    const user = userEvent.setup();
    render(<InviteScreen />);
    const input = screen.getByLabelText("Invite code");
    await user.type(input, "MURKY-2025-ABC");
    const button = screen.getByRole("button", { name: /ENTER MALL/i });

    // Rapid double click
    await user.click(button);
    await user.click(button);

    await waitFor(
      () => {
        expect(pushMock).toHaveBeenCalledWith("/survey");
      },
      { timeout: 5000 }
    );

    // Should only navigate once
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("input accepts alphanumeric and dash characters", async () => {
    const user = userEvent.setup();
    render(<InviteScreen />);
    const input = screen.getByLabelText("Invite code") as HTMLInputElement;
    await user.type(input, "ABC12-3456-XYZ");
    expect(input.value).toBe("ABC12-3456-XYZ");
  });

  it("clears error when user starts retyping", async () => {
    const user = userEvent.setup();
    render(<InviteScreen />);
    const button = screen.getByRole("button", { name: /ENTER MALL/i });
    await user.click(button);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Type a character — error should clear
    const input = screen.getByLabelText("Invite code");
    await user.type(input, "A");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("supports Enter key to submit", async () => {
    const user = userEvent.setup();
    render(<InviteScreen />);
    const input = screen.getByLabelText("Invite code");
    await user.type(input, "MURKY-2025-ABC{Enter}");

    await waitFor(
      () => {
        expect(pushMock).toHaveBeenCalledWith("/survey");
      },
      { timeout: 5000 }
    );
  });
});
