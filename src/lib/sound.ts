/**
 * sound.ts — core client-side audio engine.
 *
 * Uses HTMLAudioElement with a preloaded cache. Sound effects are triggered
 * by user interactions (overlays, button clicks, survey selections) so they
 * comply with browser autoplay policies. The first call to `initSound()`
 * (wired to the first pointerdown/keydown in SoundManager) unlocks audio
 * playback for the session.
 *
 * Background ambient music is a separate looping HTMLAudioElement with
 * fade in/out.
 */

/* ============================================================================
   Sound file paths
   ========================================================================== */

export const SOUNDS = {
  ACCESS_TO_APP: "/audio/sfx/access-to-app.wav",
  ACHIEVEMENT: "/audio/sfx/achievement.wav",
  BACKGROUND: "/audio/sfx/background.wav",
  OPEN_TAB: "/audio/sfx/open-tab.wav",
  CLOSE_TAB: "/audio/sfx/close-tab.wav",
  SWOOSH: "/audio/sfx/swoosh.wav",
  SPIN_THE_WHEEL: "/audio/sfx/spin-the-wheel.wav",
  SURVEY_BOLD: "/audio/sfx/survey-bold.wav",
  SURVEY_CLASSIC: "/audio/sfx/survey-classic.wav",
  SURVEY_TRENDY: "/audio/sfx/survey-trendy.wav",
  SURVEY_COZY: "/audio/sfx/survey-cozy.wav",
  SURVEY_FRIENDS: "/audio/sfx/survey-friends.mp3",
  SURVEY_SOLO: "/audio/sfx/survey-solo.wav",
  SURVEY_DEALS: "/audio/sfx/survey-deals.mp3",
  SURVEY_DISCOVERY: "/audio/sfx/survey-discovery.wav",
} as const;

/** Mapping from survey option id to sound file path. */
export const SURVEY_SOUNDS: Record<string, string> = {
  bold: SOUNDS.SURVEY_BOLD,
  classic: SOUNDS.SURVEY_CLASSIC,
  trendy: SOUNDS.SURVEY_TRENDY,
  cozy: SOUNDS.SURVEY_COZY,
  friends: SOUNDS.SURVEY_FRIENDS,
  solo: SOUNDS.SURVEY_SOLO,
  deals: SOUNDS.SURVEY_DEALS,
  discovery: SOUNDS.SURVEY_DISCOVERY,
};

/* ============================================================================
   Volume presets
   ========================================================================== */

const VOLUME = {
  effect: 0.7,
  achievement: 0.85,
  /** Super quiet — a barely-there ambient presence, still recognizable. */
  background: 0.06,
} as const;

/** Fade duration in ms for background music fade in/out (smooth wave). */
const BG_FADE_MS = 1500;
/** Fade duration in ms for stopAllSounds (gentle wave, not abrupt). */
const STOP_FADE_MS = 400;

/* ============================================================================
   State (module-level singletons)
   ========================================================================== */

const isClient = typeof window !== "undefined";

/** Preloaded audio elements keyed by sound path. */
const audioCache = new Map<string, HTMLAudioElement>();

/** Whether the audio context has been unlocked by a user interaction. */
let initialized = false;

/** Whether sound effects are enabled (mirrors uiStore.isSoundEnabled). */
let soundEnabled = true;

/** Background music element + fade controller. */
let bgAudio: HTMLAudioElement | null = null;
let bgFadeTimer: ReturnType<typeof setInterval> | null = null;
/** True when background music was requested but blocked by autoplay policy. */
let bgMusicPending = false;

/** Active sound clones currently playing (for stopAllSounds). */
const activeClones = new Set<HTMLAudioElement>();

/** Last time the achievement sound was played, to prevent overlapping echoes. */
let lastAchievementTime = 0;

/* ============================================================================
   Initialization
   ========================================================================== */

/**
 * Preload all sound effect files into the cache. Called once on the first
 * user interaction (pointerdown / keydown) to satisfy browser autoplay
 * policies. Safe to call multiple times — only runs once.
 */
export function initSound(): void {
  if (!isClient || initialized) return;
  initialized = true;

  for (const path of Object.values(SOUNDS)) {
    const audio = new Audio(path);
    audio.preload = "auto";
    audioCache.set(path, audio);
  }

  // If background music was requested before the user interacted (blocked by
  // autoplay policy), start it now that we have an unlocked audio context.
  if (bgMusicPending) {
    bgMusicPending = false;
    startBackgroundMusic();
  }
}

/** Update the sound-enabled flag (called by SoundManager when uiStore changes). */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  if (!enabled) {
    stopBackgroundMusic();
  }
}

/* ============================================================================
   Sound effect playback
   ========================================================================== */

/**
 * Play a sound effect by path. Clones the cached element so overlapping
 * calls (e.g. rapid open/close) don't cut each other off. Respects the
 * sound-enabled flag.
 *
 * @param maxDurationMs  If provided, the sound is automatically stopped
 *   after this duration (fade-out over the last 200ms). Use this to cap
 *   long audio files that would otherwise bleed past their UI context.
 */
export function playSound(
  path: string,
  volume: number = VOLUME.effect,
  maxDurationMs?: number,
  startTimeSec?: number
): void {
  if (!isClient || !initialized || !soundEnabled) return;

  const cached = audioCache.get(path);
  if (!cached) return;

  // Clone for overlap support — the cached element is just a template.
  const clone = cached.cloneNode() as HTMLAudioElement;
  clone.volume = Math.min(1, Math.max(0, volume));
  
  if (startTimeSec !== undefined && startTimeSec > 0) {
    clone.currentTime = startTimeSec;
  }
  
  activeClones.add(clone);

  clone.play().catch(() => {
    // Autoplay may still be blocked in edge cases — silently ignore.
    activeClones.delete(clone);
  });

  // Clean up when the sound ends naturally.
  clone.addEventListener("ended", () => {
    activeClones.delete(clone);
  });

  // Cap duration if requested — fade out over the last 200ms then stop.
  if (maxDurationMs && maxDurationMs > 0) {
    const fadeStartMs = Math.max(0, maxDurationMs - 200);
    const startVol = clone.volume;

    setTimeout(() => {
      // Fade out
      const fadeSteps = 8;
      let step = 0;
      const fadeTimer = setInterval(() => {
        if (clone.paused) {
          clearInterval(fadeTimer);
          return;
        }
        step++;
        clone.volume = Math.max(0, startVol * (1 - step / fadeSteps));
        if (step >= fadeSteps) {
          clone.pause();
          activeClones.delete(clone);
          clearInterval(fadeTimer);
        }
      }, 25);
    }, fadeStartMs);
  }
}

/** Convenience: play the achievement sound at a higher volume. */
export function playAchievement(): void {
  const now = Date.now();
  if (now - lastAchievementTime < 1000) return;
  lastAchievementTime = now;
  playSound(SOUNDS.ACHIEVEMENT, VOLUME.achievement);
}

/** Convenience: play the tier upgrade sound (survey friends starting at 1s). */
export function playTierUpgrade(): void {
  playSound(SOUNDS.SURVEY_FRIENDS, VOLUME.achievement, undefined, 1);
}

/**
 * Stop all currently playing sound effects with a gentle fade-out so the
 * cutoff doesn't feel abrupt. Use this before playing a new sound that
 * should not overlap with the previous one (e.g. survey option sound →
 * swoosh transition).
 */
export function stopAllSounds(): void {
  if (!isClient || activeClones.size === 0) return;

  const fadeSteps = 10;
  const stepMs = STOP_FADE_MS / fadeSteps;
  const clonesToStop = [...activeClones];

  for (const clone of clonesToStop) {
    const startVol = clone.volume;
    let step = 0;
    const timer = setInterval(() => {
      if (clone.paused) {
        clearInterval(timer);
        return;
      }
      step++;
      clone.volume = Math.max(0, startVol * (1 - step / fadeSteps));
      if (step >= fadeSteps) {
        clone.pause();
        activeClones.delete(clone);
        clearInterval(timer);
      }
    }, stepMs);
  }
}

/* ============================================================================
   Background ambient music
   ========================================================================== */

/**
 * Start the looping ambient background track with a smooth fade-in.
 * Safe to call when already playing (no-op). Respects the sound-enabled flag.
 */
export function startBackgroundMusic(): void {
  if (!isClient || !soundEnabled) return;
  if (bgAudio) return; // already playing

  bgAudio = new Audio(SOUNDS.BACKGROUND);
  bgAudio.loop = true;
  bgAudio.volume = 0;
  bgAudio.play().catch(() => {
    // Autoplay blocked — mark as pending so initSound() can retry once the
    // user interacts. Clean up the element for now.
    bgAudio = null;
    bgMusicPending = true;
    return;
  });

  // Smooth fade-in wave over BG_FADE_MS.
  const targetVol = VOLUME.background;
  const steps = 30;
  const stepMs = BG_FADE_MS / steps;
  let currentStep = 0;
  if (bgFadeTimer) clearInterval(bgFadeTimer);
  bgFadeTimer = setInterval(() => {
    if (!bgAudio) {
      if (bgFadeTimer) clearInterval(bgFadeTimer);
      return;
    }
    currentStep++;
    // Ease-out curve for a natural swell.
    const progress = currentStep / steps;
    bgAudio.volume = Math.min(targetVol, targetVol * (1 - Math.pow(1 - progress, 2)));
    if (currentStep >= steps) {
      bgAudio.volume = targetVol;
      if (bgFadeTimer) clearInterval(bgFadeTimer);
      bgFadeTimer = null;
    }
  }, stepMs);
}

/**
 * Stop the ambient background music with a smooth fade-out wave.
 * Safe to call when not playing (no-op).
 */
export function stopBackgroundMusic(): void {
  if (!isClient) return;
  // Clear any pending request that hasn't started yet.
  bgMusicPending = false;
  if (!bgAudio) return;

  const startVol = bgAudio.volume;
  const steps = 30;
  const stepMs = BG_FADE_MS / steps;
  let currentStep = 0;

  if (bgFadeTimer) clearInterval(bgFadeTimer);
  bgFadeTimer = setInterval(() => {
    if (!bgAudio) {
      if (bgFadeTimer) clearInterval(bgFadeTimer);
      bgFadeTimer = null;
      return;
    }
    currentStep++;
    // Ease-in curve for a natural fade — dissipates like a wave.
    const progress = currentStep / steps;
    bgAudio.volume = Math.max(0, startVol * Math.pow(1 - progress, 2));
    if (currentStep >= steps) {
      bgAudio.pause();
      bgAudio = null;
      if (bgFadeTimer) clearInterval(bgFadeTimer);
      bgFadeTimer = null;
    }
  }, stepMs);
}

/* ============================================================================
   Test helpers
   ========================================================================== */

/** Reset all state (for tests only). */
export function _resetSound(): void {
  audioCache.clear();
  initialized = false;
  soundEnabled = true;
  bgMusicPending = false;
  lastAchievementTime = 0;
  if (bgAudio) {
    bgAudio.pause();
    bgAudio = null;
  }
  if (bgFadeTimer) {
    clearInterval(bgFadeTimer);
    bgFadeTimer = null;
  }
}
