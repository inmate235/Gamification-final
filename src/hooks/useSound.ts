"use client";

import { useCallback } from "react";
import { useUIStore } from "@/stores/uiStore";
import {
  playSound,
  playAchievement,
  SURVEY_SOUNDS,
  SOUNDS,
} from "@/lib/sound";

/**
 * useSound — React hook for playing sound effects.
 *
 * Subscribes to `uiStore.isSoundEnabled` and skips playback when disabled.
 * Returns stable callback functions that can be used in event handlers,
 * useEffects, or anywhere a sound trigger is needed.
 */
export function useSound() {
  const isSoundEnabled = useUIStore((s) => s.isSoundEnabled);

  const play = useCallback(
    (soundPath: string, volume?: number) => {
      if (!isSoundEnabled) return;
      playSound(soundPath, volume);
    },
    [isSoundEnabled]
  );

  const playByName = useCallback(
    (name: keyof typeof SOUNDS, volume?: number) => {
      if (!isSoundEnabled) return;
      playSound(SOUNDS[name], volume);
    },
    [isSoundEnabled]
  );

  const playAchievementSound = useCallback(() => {
    if (!isSoundEnabled) return;
    playAchievement();
  }, [isSoundEnabled]);

  const playSurveySound = useCallback(
    (optionId: string) => {
      if (!isSoundEnabled) return;
      const path = SURVEY_SOUNDS[optionId];
      if (path) playSound(path);
    },
    [isSoundEnabled]
  );

  return {
    play,
    playByName,
    playAchievement: playAchievementSound,
    playSurveySound,
    isSoundEnabled,
  };
}
