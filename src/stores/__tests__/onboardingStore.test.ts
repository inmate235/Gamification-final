import { describe, it, expect, beforeEach } from "vitest";
import { useOnboardingStore } from "@/stores/onboardingStore";

describe("onboardingStore", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  it("initializes at the 'invite' step", () => {
    expect(useOnboardingStore.getState().onboardingStep).toBe("invite");
  });

  it("setStep advances forward (invite -> survey -> mall)", () => {
    useOnboardingStore.getState().setStep("survey");
    expect(useOnboardingStore.getState().onboardingStep).toBe("survey");
    useOnboardingStore.getState().setStep("mall");
    expect(useOnboardingStore.getState().onboardingStep).toBe("mall");
  });

  it("setStep rejects backward movement (no-op)", () => {
    useOnboardingStore.getState().setStep("mall");
    useOnboardingStore.getState().setStep("survey");
    expect(useOnboardingStore.getState().onboardingStep).toBe("mall");
    useOnboardingStore.getState().setStep("invite");
    expect(useOnboardingStore.getState().onboardingStep).toBe("mall");
  });

  it("advanceToSurvey moves the step to 'survey'", () => {
    useOnboardingStore.getState().advanceToSurvey();
    expect(useOnboardingStore.getState().onboardingStep).toBe("survey");
  });

  it("advanceToMall moves the step to 'mall'", () => {
    useOnboardingStore.getState().advanceToSurvey();
    useOnboardingStore.getState().advanceToMall();
    expect(useOnboardingStore.getState().onboardingStep).toBe("mall");
  });

  it("isInviteValidated is false at 'invite' and true at 'survey' / 'mall'", () => {
    expect(useOnboardingStore.getState().isInviteValidated()).toBe(false);
    useOnboardingStore.getState().advanceToSurvey();
    expect(useOnboardingStore.getState().isInviteValidated()).toBe(true);
    useOnboardingStore.getState().advanceToMall();
    expect(useOnboardingStore.getState().isInviteValidated()).toBe(true);
  });

  it("isOnboardingComplete is true only at 'mall'", () => {
    expect(useOnboardingStore.getState().isOnboardingComplete()).toBe(false);
    useOnboardingStore.getState().advanceToSurvey();
    expect(useOnboardingStore.getState().isOnboardingComplete()).toBe(false);
    useOnboardingStore.getState().advanceToMall();
    expect(useOnboardingStore.getState().isOnboardingComplete()).toBe(true);
  });

  it("reset returns the step to 'invite'", () => {
    useOnboardingStore.getState().advanceToMall();
    useOnboardingStore.getState().reset();
    expect(useOnboardingStore.getState().onboardingStep).toBe("invite");
  });
});
