import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/* --- Mock the sound module so no test plays actual audio --- */
vi.mock("@/lib/sound", () => ({
  playSound: vi.fn(),
  playAchievement: vi.fn(),
  stopAllSounds: vi.fn(),
  initSound: vi.fn(),
  startBackgroundMusic: vi.fn(),
  stopBackgroundMusic: vi.fn(),
  setSoundEnabled: vi.fn(),
  SOUNDS: {
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
  },
  SURVEY_SOUNDS: {
    bold: "/audio/sfx/survey-bold.wav",
    classic: "/audio/sfx/survey-classic.wav",
    trendy: "/audio/sfx/survey-trendy.wav",
    cozy: "/audio/sfx/survey-cozy.wav",
    friends: "/audio/sfx/survey-friends.mp3",
    solo: "/audio/sfx/survey-solo.wav",
    deals: "/audio/sfx/survey-deals.mp3",
    discovery: "/audio/sfx/survey-discovery.wav",
  },
  _resetSound: vi.fn(),
}));
