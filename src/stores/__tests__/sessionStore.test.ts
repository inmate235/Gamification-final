import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useSessionStore } from "@/stores/sessionStore";

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it("initializes with zeroed session state and empty event queue", () => {
    const s = useSessionStore.getState();
    expect(s.sessionStart).toBe(0);
    expect(s.sessionMinutes).toBe(0);
    expect(s.exitAttempts).toBe(0);
    expect(s.exitFrictionLayer).toBe(0);
    expect(s.eventQueue).toEqual([]);
  });

  it("startSession sets sessionStart and zeroes counters", () => {
    useSessionStore.getState().startSession();
    expect(useSessionStore.getState().sessionStart).toBeGreaterThan(0);
    expect(useSessionStore.getState().sessionMinutes).toBe(0);
  });

  it("tick updates sessionMinutes based on elapsed time", () => {
    // Mock Date.now for determinism.
    const start = 1000 * 60 * 5; // 5 minutes in ms
    const nowSpy = vi.spyOn(Date, "now");
    try {
      nowSpy.mockReturnValue(start);
      useSessionStore.getState().startSession();
      // Advance 10 minutes.
      nowSpy.mockReturnValue(start + 1000 * 60 * 10);
      useSessionStore.getState().tick();
      expect(useSessionStore.getState().sessionMinutes).toBe(10);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("tick before startSession is a no-op", () => {
    useSessionStore.getState().tick();
    expect(useSessionStore.getState().sessionMinutes).toBe(0);
  });

  it("registerExitAttempt increments attempts and caps at 3", () => {
    expect(useSessionStore.getState().registerExitAttempt()).toBe(1);
    expect(useSessionStore.getState().exitFrictionLayer).toBe(1);
    expect(useSessionStore.getState().registerExitAttempt()).toBe(2);
    expect(useSessionStore.getState().exitFrictionLayer).toBe(2);
    expect(useSessionStore.getState().registerExitAttempt()).toBe(3);
    expect(useSessionStore.getState().exitFrictionLayer).toBe(3);
    expect(useSessionStore.getState().registerExitAttempt()).toBe(3);
  });

  it("resetExitAttempts zeroes attempts and layer", () => {
    useSessionStore.getState().registerExitAttempt();
    useSessionStore.getState().registerExitAttempt();
    useSessionStore.getState().resetExitAttempts();
    const s = useSessionStore.getState();
    expect(s.exitAttempts).toBe(0);
    expect(s.exitFrictionLayer).toBe(0);
  });

  it("scheduleEvent adds an event to the queue with a future timestamp", () => {
    const before = Date.now();
    const event = useSessionStore
      .getState()
      .scheduleEvent("wheel-available", 1000);
    expect(event.id).toBeTruthy();
    expect(event.type).toBe("wheel-available");
    expect(event.scheduledFor).toBeGreaterThanOrEqual(before + 1000);
    expect(event.processed).toBe(false);
    expect(useSessionStore.getState().eventQueue).toHaveLength(1);
  });

  it("processEvents returns due events and marks them processed", () => {
    const event = useSessionStore
      .getState()
      .scheduleEvent("phantom-move", -1000); // already due
    const due = useSessionStore.getState().processEvents();
    expect(due).toHaveLength(1);
    expect(due[0]?.id).toBe(event.id);
  });

  it("processEvents leaves future events in the queue", () => {
    useSessionStore.getState().scheduleEvent("wheel-available", 60000);
    const due = useSessionStore.getState().processEvents();
    expect(due).toHaveLength(0);
  });

  it("clearProcessedEvents removes processed events", () => {
    useSessionStore.getState().scheduleEvent("phantom-move", -1000);
    useSessionStore.getState().processEvents();
    useSessionStore.getState().clearProcessedEvents();
    expect(useSessionStore.getState().eventQueue).toHaveLength(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
