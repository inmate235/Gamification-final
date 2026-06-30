/**
 * onboardingStore - tracks the forward-only onboarding flow step.
 *
 * The step advances only forward: 'invite' -> 'survey' -> 'mall'.
 * Route guards consult this store to prevent users bypassing onboarding by
 * navigating directly to /survey or /mall.
 *
 * Holds: onboardingStep.
 * Actions: setStep, advanceToSurvey, advanceToMall, reset.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { OnboardingState, OnboardingStep } from "@/types";

/* ============================================================================
   Step ordering (forward-only)
   ========================================================================== */

const STEP_ORDER: OnboardingStep[] = ["invite", "survey", "mall"];

/** Returns true if `to` is ahead of (or equal to) `from` in the flow. */
function canAdvanceTo(from: OnboardingStep, to: OnboardingStep): boolean {
  return STEP_ORDER.indexOf(to) >= STEP_ORDER.indexOf(from);
}

/* ============================================================================
   Store
   ========================================================================== */

export interface OnboardingStore extends OnboardingState {
  /**
   * Advance to a target step. Rejects backward movement (a no-op when the
   * current step is already at or past the target) to keep the flow forward.
   */
  setStep: (step: OnboardingStep) => void;
  /** Convenience: mark invite code validated (advance to 'survey'). */
  advanceToSurvey: () => void;
  /** Convenience: mark survey completed (advance to 'mall'). */
  advanceToMall: () => void;
  /** Selector helper: has the invite code been validated? */
  isInviteValidated: () => boolean;
  /** Selector helper: is onboarding fully complete (survey done)? */
  isOnboardingComplete: () => boolean;
  /** Reset back to the initial 'invite' step. */
  reset: () => void;
}

const initialOnboardingState: OnboardingState = {
  onboardingStep: "invite",
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      ...initialOnboardingState,

      setStep: (step) =>
        set((state) => ({
          onboardingStep: canAdvanceTo(state.onboardingStep, step)
            ? step
            : state.onboardingStep,
        })),

      advanceToSurvey: () => get().setStep("survey"),

      advanceToMall: () => get().setStep("mall"),

      isInviteValidated: () => {
        const step = get().onboardingStep;
        return step === "survey" || step === "mall";
      },

      isOnboardingComplete: () => get().onboardingStep === "mall",

      reset: () => set({ ...initialOnboardingState }),
    }),
    {
      name: "murky-onboarding-step",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ onboardingStep: state.onboardingStep }),
    }
  )
);

export default useOnboardingStore;
