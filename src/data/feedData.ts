import { STORE_BLOOM, STORE_PULSE, STORE_TECHNOVA, STORE_CHROME } from "./mallData";

export interface FeedItem {
  id: string;
  storeId: string;
  videoUrl?: string; // Currently mocked, will be added later
  prompt: string;    // The AI prompt that would generate the video
  likes: number;
  comments: number;
  shares: number;
}

export const timelineFeed: FeedItem[] = [
  {
    id: "feed-0-spin-wheel-promo",
    storeId: STORE_TECHNOVA,
    prompt:
      "BRAIN ROT ALERT: A hyper-kinetic, flashy, sensory-overload TikTok-style edit. The Mystic Wheel is spinning at 1000MPH while a robotic voice screams 'SPIN TO WIN! STOP SCROLLING AND SPIN!'. Bright rainbow strobes, exploding emojis (🤑💥🔥), and a massive flashing 'CLICK TOP RIGHT NOW' arrow pointing aggressively to the spin button.",
    likes: 99999,
    comments: 42069,
    shares: 1337,
  },
  {
    id: "feed-1-technova",
    storeId: STORE_TECHNOVA,
    videoUrl: "/feed/cyberpunk-keyboard.mp4",
    prompt:
      "A hyper-energetic, fast-paced cyberpunk 3D animation showing glowing 'Neon Keyboards' from TechNova floating towards the camera with a massive '40% OFF' text overlay, neon lights flashing in sync with a heavy bass drop.",
    likes: 12450,
    comments: 423,
    shares: 1205,
  },
  {
    id: "feed-2-pulse",
    storeId: STORE_PULSE,
    videoUrl: "/feed/glow-earbuds.mp4",
    prompt:
      "A sleek, cinematic product showcase of 'Glow Earbuds' from Pulse. The camera pans around the earbuds suspended in mid-air against a pure black background. Smooth lighting reveals a '25% OFF' badge that pulses softly, giving a premium, exclusive feel.",
    likes: 8320,
    comments: 215,
    shares: 890,
  },
  {
    id: "feed-3-bloom",
    storeId: STORE_BLOOM,
    videoUrl: "/feed/spring-fashion.mp4",
    prompt:
      "A fast, trendy fashion montage featuring the 'Spring Capsule' collection from Bloom. Quick cuts of models wearing the clothes in dynamic poses, with vibrant spring colors popping. A bold '30% OFF' sticker slaps onto the screen at the end.",
    likes: 24500,
    comments: 1102,
    shares: 3400,
  },
  {
    id: "feed-4-chrome",
    storeId: STORE_CHROME,
    videoUrl: "/feed/luxury-watch.mp4",
    prompt:
      "A luxurious, slow-motion macro shot of the 'Mesh Band' watch from Chrome. The camera focuses on the intricate details of the metal mesh catching the light. An elegant, minimalist '20% OFF' text fades in gracefully, exuding high status.",
    likes: 5600,
    comments: 98,
    shares: 410,
  },
];
