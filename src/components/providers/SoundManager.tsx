"use client";

import { useEffect, useRef } from "react";
import { useUIStore } from "@/stores/uiStore";
import {
  initSound,
  setSoundEnabled as setSoundEnabledGlobal,
  playSound,
  playAchievement,
  startBackgroundMusic,
  stopBackgroundMusic,
  SOUNDS,
} from "@/lib/sound";

/**
 * SoundManager — invisible component that orchestrates audio across the app.
 *
 * Responsibilities:
 *  1. Unlock audio on first user interaction (initSound on pointerdown/keydown)
 *  2. Sync the sound-enabled flag from uiStore → sound.ts
 *  3. Play open/close tab sounds on overlay transitions
 *  4. Play achievement sound on tier-upgrade overlay open
 *  5. Play swoosh on timeline open/close
 *
 * Mounted once in Providers.tsx. Renders nothing.
 */

/** Overlays that use the achievement sound instead of open-tab. */
const ACHIEVEMENT_OVERLAYS = new Set(["tier-upgrade"]);

/** Overlays that are transient and should NOT play open/close sounds. */
const SILENT_OVERLAYS = new Set(["celebration"]);

/** Cap for open/close tab sounds — 1200ms is enough to hear the cue without
 *  bleeding 2+ seconds past the overlay animation. */
const TAB_SOUND_CAP_MS = 1200;

export function SoundManager() {
  const isSoundEnabled = useUIStore((s) => s.isSoundEnabled);
  const isSoundEnabledRef = useRef(isSoundEnabled);

  /* --- Sync sound-enabled flag to the sound engine + ref --- */
  useEffect(() => {
    isSoundEnabledRef.current = isSoundEnabled;
    setSoundEnabledGlobal(isSoundEnabled);
  }, [isSoundEnabled]);

  /* --- Unlock audio on first interaction + subscribe to overlay changes --- */
  useEffect(() => {
    // Attempt to start background music immediately on mount. If the browser
    // blocks autoplay (no user interaction yet), sound.ts stores a pending
    // flag and initSound() will retry on the first pointerdown/keydown.
    startBackgroundMusic();

    const unlock = () => {
      initSound();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    // Subscribe to uiStore state changes for overlay + timeline sounds.
    const unsubscribe = useUIStore.subscribe((state, prevState) => {
      if (!isSoundEnabledRef.current) return;

      // Overlay transition: none → X (open)
      if (prevState.activeOverlay === "none" && state.activeOverlay !== "none") {
        if (ACHIEVEMENT_OVERLAYS.has(state.activeOverlay)) {
          playAchievement();
        } else if (!SILENT_OVERLAYS.has(state.activeOverlay)) {
          playSound(SOUNDS.OPEN_TAB, undefined, TAB_SOUND_CAP_MS);
        }
      }

      // Overlay transition: X → none (close)
      if (prevState.activeOverlay !== "none" && state.activeOverlay === "none") {
        if (!SILENT_OVERLAYS.has(prevState.activeOverlay)) {
          playSound(SOUNDS.CLOSE_TAB, undefined, TAB_SOUND_CAP_MS);
        }
      }

      // Timeline open/close swoosh
      if (prevState.isTimelineOpen !== state.isTimelineOpen) {
        playSound(SOUNDS.SWOOSH);
      }
    });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      unsubscribe();
      stopBackgroundMusic();
    };
  }, []);

  return null;
}
