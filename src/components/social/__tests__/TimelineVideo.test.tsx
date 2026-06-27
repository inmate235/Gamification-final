import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { TimelineVideo } from "../TimelineVideo";
import { useUIStore } from "@/stores/uiStore";

// Mock HTMLVideoElement methods play and pause
const mockPlay = vi.fn().mockImplementation(() => Promise.resolve());
const mockPause = vi.fn();

// Add mocks on HTMLMediaElement prototype
Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: mockPlay,
});
Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value: mockPause,
});
// Mock currentTime
Object.defineProperty(window.HTMLMediaElement.prototype, "currentTime", {
  configurable: true,
  get() { return 0; },
  set(_value) { },
});

// Mock framer-motion
vi.mock("framer-motion", () => {
  const strip = (props: Record<string, unknown>) => {
    const {
      initial,
      animate,
      exit,
      transition,
      whileHover,
      whileTap,
      whileInView,
      variants,
      layout,
      ...rest
    } = props;
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
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock("@phosphor-icons/react", () => {
  const make = (name: string) => {
    const Cmp = () => React.createElement("span", { "data-icon": name });
    Cmp.displayName = `Icon-${name}`;
    return Cmp;
  };
  return {
    Heart: make("Heart"),
    ChatCircle: make("ChatCircle"),
    ShareFat: make("ShareFat"),
    Storefront: make("Storefront"),
    ShoppingBag: make("ShoppingBag"),
    SpeakerHigh: make("SpeakerHigh"),
    SpeakerSlash: make("SpeakerSlash"),
    Flame: make("Flame"),
    ArrowRight: make("ArrowRight"),
  };
});

describe("TimelineVideo component", () => {
  const mockItem = {
    id: "feed-2-pulse",
    storeId: "store-pulse",
    videoUrl: "/feed/glow-earbuds.mp4",
    prompt: "A sleek showcase of Glow Earbuds",
    likes: 8320,
    comments: 215,
    shares: 890,
  };

  beforeEach(() => {
    useUIStore.getState().reset();
    mockPlay.mockClear();
    mockPause.mockClear();
  });

  it("calls play on the video element when rendered with isActive: true", () => {
    render(<TimelineVideo item={mockItem} isActive={true} />);
    
    // play should be called on mount
    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(mockPause).not.toHaveBeenCalled();
  });

  it("calls pause on the video element when rendered with isActive: false", () => {
    render(<TimelineVideo item={mockItem} isActive={false} />);
    
    // pause should be called on mount
    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it("plays or pauses dynamically as isActive changes", () => {
    const { rerender } = render(<TimelineVideo item={mockItem} isActive={false} />);
    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();

    // Change isActive to true
    rerender(<TimelineVideo item={mockItem} isActive={true} />);
    expect(mockPlay).toHaveBeenCalledTimes(1);

    // Change isActive back to false
    rerender(<TimelineVideo item={mockItem} isActive={false} />);
    expect(mockPause).toHaveBeenCalledTimes(2);
  });

  it("toggles global mute state when the mute button is clicked", () => {
    render(<TimelineVideo item={mockItem} isActive={true} />);
    
    // Initial state is muted (true)
    expect(useUIStore.getState().isMuted).toBe(true);
    
    const muteButton = screen.getByLabelText("Unmute video");
    expect(muteButton).toBeInTheDocument();
    
    // Click to unmute
    act(() => {
      muteButton.click();
    });
    
    expect(useUIStore.getState().isMuted).toBe(false);
  });
});
