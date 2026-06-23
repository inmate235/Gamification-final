/**
 * sessionStore - session tracking + event queue.
 *
 * Holds: sessionStart, sessionMinutes, exitAttempts, exitFrictionLayer,
 *         eventQueue.
 * Actions: startSession, tick, registerExitAttempt, resetExitAttempts,
 *          scheduleEvent, processEvents, clearProcessedEvents, reset.
 */

import { create } from "zustand";
import type { EventType, GameEvent, SessionState } from "@/types";

/* ============================================================================
   Store
   ========================================================================== */

let eventCounter = 0;
function nextEventId(): string {
  eventCounter += 1;
  return `event-${eventCounter}`;
}

export interface SessionStore extends SessionState {
  startSession: () => void;
  tick: () => void;
  registerExitAttempt: () => number;
  resetExitAttempts: () => void;
  /**
   * Mark the user as having left the mall (final "Leave anyway" on Layer 3).
   * Resets the exit-attempt counter and friction layer so a future session
   * starts fresh (VAL-EXIT-032), and sets `exited` so the MallExperience
   * renders the goodbye screen.
   */
  leaveMall: () => void;
  /** Clear the exited flag so the mall renders again (Return to Mall). */
  returnToMall: () => void;
  scheduleEvent: (
    type: EventType,
    delayMs: number,
    payload?: Record<string, unknown>
  ) => GameEvent;
  processEvents: (now?: number) => GameEvent[];
  clearProcessedEvents: () => void;
  reset: () => void;
}

const initialSessionState: SessionState = {
  sessionStart: 0,
  sessionMinutes: 0,
  exitAttempts: 0,
  exitFrictionLayer: 0,
  eventQueue: [],
  exited: false,
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  ...initialSessionState,

  startSession: () => {
    const now = Date.now();
    set({
      sessionStart: now,
      sessionMinutes: 0,
      exitAttempts: 0,
      exitFrictionLayer: 0,
      eventQueue: [],
      exited: false,
    });
  },

  tick: () =>
    set((state) => {
      if (state.sessionStart === 0) return state;
      const elapsedMs = Date.now() - state.sessionStart;
      const minutes = Math.floor(elapsedMs / 60000);
      return { sessionMinutes: minutes };
    }),

  registerExitAttempt: () => {
    let attempts = 0;
    set((state) => {
      attempts = Math.min(3, state.exitAttempts + 1);
      // Layer matches attempt count (capped at 3).
      const layer = Math.min(3, attempts) as 0 | 1 | 2 | 3;
      return { exitAttempts: attempts, exitFrictionLayer: layer };
    });
    return attempts;
  },

  resetExitAttempts: () =>
    set({ exitAttempts: 0, exitFrictionLayer: 0 }),

  leaveMall: () =>
    // Leaving resets the exit-friction state so a future session starts fresh
    // (VAL-EXIT-032) and marks the session as exited so the goodbye screen
    // renders (VAL-EXIT-017).
    set({ exitAttempts: 0, exitFrictionLayer: 0, exited: true }),

  returnToMall: () => set({ exited: false }),

  scheduleEvent: (type, delayMs, payload) => {
    const event: GameEvent = {
      id: nextEventId(),
      type,
      scheduledFor: Date.now() + delayMs,
      payload,
      processed: false,
    };
    set((state) => ({ eventQueue: [...state.eventQueue, event] }));
    return event;
  },

  processEvents: (now = Date.now()) => {
    const state = get();
    const due: GameEvent[] = [];
    const remaining: GameEvent[] = [];

    for (const event of state.eventQueue) {
      if (event.processed) {
        remaining.push(event);
        continue;
      }
      if (event.scheduledFor <= now) {
        due.push(event);
      } else {
        remaining.push(event);
      }
    }

    if (due.length > 0) {
      // Mark due events as processed and keep them in the queue for history.
      const processedIds = new Set(due.map((e) => e.id));
      const updatedQueue = remaining.map((e) =>
        processedIds.has(e.id) ? { ...e, processed: true } : e
      );
      // Append the freshly-processed events.
      const dueProcessed = due.map((e) => ({ ...e, processed: true }));
      set({ eventQueue: [...updatedQueue, ...dueProcessed] });
    }

    return due;
  },

  clearProcessedEvents: () =>
    set((state) => ({
      eventQueue: state.eventQueue.filter((e) => !e.processed),
    })),

  reset: () => set({ ...initialSessionState, eventQueue: [] }),
}));

export default useSessionStore;
