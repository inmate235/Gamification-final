import { STORE_BLOOM, STORE_PULSE, STORE_TECHNOVA, STORE_CHROME, STORE_MURKY_PLAYGROUND, STORE_LUMIERE } from "@/data/mallData";

export interface FeedItem {
  id: string;
  storeId: string;
  videoUrl?: string;
  prompt: string;    // The AI prompt that would generate the video
  likes: number;
  comments: number;
  shares: number;
}

export const timelineFeed: FeedItem[] = [
  {
    id: "feed-influencer-app-hype",
    storeId: STORE_LUMIERE,
    videoUrl: "/feed/videos/Influencer Scam App Promotion.mp4",
    prompt:
      "INFLUENCER DARK PATTERN AD 2: A fast-paced, jump-cut heavy vlog of a lifestyle influencer unboxing a glowing Amber Candle from Lumiere. The background is artificially blurred to look like a premium VIP lounge. 'I'm gatekeeping this no more! The Murky Mall app is basically free money if you know the glitch. 🤫 Step 1: Download it. Step 2: Spam your invite link to literally everyone in your contacts to get 500 free tokens. If you aren't doing this, you're literally falling behind. Click the link below, tag 5 friends, and secure the bag! 💸🔥'",
    likes: 980500,
    comments: 31000,
    shares: 112000,
  },
  {
    id: "feed-1-technova",
    storeId: STORE_TECHNOVA,
    videoUrl: "/feed/videos/cyberpunk-keyboard.mp4",
    prompt:
      "A hyper-energetic, fast-paced cyberpunk 3D animation showing glowing 'Neon Keyboards' from TechNova floating towards the camera with a massive '40% OFF' text overlay, neon lights flashing in sync with a heavy bass drop.",
    likes: 12450,
    comments: 423,
    shares: 1205,
  },
  {
    id: "feed-buy-tokens-brainrot",
    storeId: STORE_TECHNOVA,
    videoUrl: "/feed/videos/Dynamic Video Ad Generation.mp4",
    prompt:
      "BRAIN ROT TOKEN AD: A hyper-stimulating split-screen video. Top half shows a hypnotic kinetic sand cutting compilation, bottom half shows GTA V car parkour. Flashing neon text screams 'YOU ARE BROKE!!! BUY MORE TOKENS NOW!!! NO CAP 🧢🔥'. An AI voice aggressively reads the text over extremely loud phonk music.",
    likes: 999999,
    comments: 8520,
    shares: 4200,
  },
  {
    id: "feed-2-pulse",
    storeId: STORE_PULSE,
    videoUrl: "/feed/videos/glow-earbuds.mp4",
    prompt:
      "A sleek, cinematic product showcase of 'Glow Earbuds' from Pulse. The camera pans around the earbuds suspended in mid-air against a pure black background. Smooth lighting reveals a '25% OFF' badge that pulses softly, giving a premium, exclusive feel.",
    likes: 8320,
    comments: 215,
    shares: 890,
  },
  {
    id: "feed-murky-playground-ad",
    storeId: STORE_MURKY_PLAYGROUND,
    videoUrl: "/feed/videos/murky-playground-ad.mp4",
    prompt:
      "A warm, soft-focus commercial for 'Murky Playground' — the mall's complimentary child drop-off service. A smiling mother hands her giggling toddler to a gently nodding Play Warden in a pastel uniform. The child waves bye-bye. The camera slowly pushes into the softly lit play dome as the door closes behind them with a soft click. A calm, reassuring voiceover: 'At Murky Playground, we see your little ones. We always see them. Your children are safe in our care — supervised every second by our certified Play Wardens who never look away. Not even for a moment. Not even when they ask us to. Enjoy up to TWO HOURS of undisturbed shopping, completely free. Walk the mall in peace. We'll still have them when you come back. We always still have them. Murky Playground — because your peace of mind is our surveillance.' The ad ends on a slow zoom into a wall of softly blinking security cameras, each one showing a different child playing alone, before cutting to a bright tagline: 'MURKY PLAYGROUND. DROP THEM OFF. WE'LL KEEP WATCH.'",
    likes: 3104,
    comments: 287,
    shares: 156,
  },
  {
    id: "feed-3-bloom",
    storeId: STORE_BLOOM,
    videoUrl: "/feed/videos/spring-fashion.mp4",
    prompt:
      "A fast, trendy fashion montage featuring the 'Spring Capsule' collection from Bloom. Quick cuts of models wearing the clothes in dynamic poses, with vibrant spring colors popping. A bold '30% OFF' sticker slaps onto the screen at the end.",
    likes: 24500,
    comments: 1102,
    shares: 3400,
  },
  {
    id: "feed-influencer-handbag-review",
    storeId: STORE_CHROME,
    videoUrl: "/feed/videos/TikTok Influencer Promo.mp4",
    prompt:
      "INFLUENCER DARK PATTERN AD 1: A hyper-enthusiastic TikTok influencer vlogging while speed-walking through the dark, aesthetic neon-lit corridors of Murky Mall. She holds up a glowing, high-end handbag from Chrome. 'Guys, I literally CANNOT believe the exclusive deals in the Murky Mall app right now! Look at this bag! 😭 If you don't download the app this second, you are literally throwing money away. Use my link to invite 3 friends and unlock the hidden Platinum Tier NOW. The FOMO is real, do it before the timer runs out! ⏳🚨'",
    likes: 1250430,
    comments: 43200,
    shares: 89000,
  },
  {
    id: "feed-old-brainrot-end",
    storeId: STORE_BLOOM,
    videoUrl: "/feed/videos/Subway Surfers Sigma Grindset Video.mp4",
    prompt:
      "OLD BRAIN ROT AD: The original Subway Surfers gameplay video showing endless running and satisfying jumps to keep the viewer locked in while browsing Bloom fashion.",
    likes: 888888,
    comments: 5555,
    shares: 2222,
  },
  {
    id: "feed-4-chrome",
    storeId: STORE_CHROME,
    videoUrl: "/feed/videos/luxury-watch.mp4",
    prompt:
      "A luxurious, slow-motion macro shot of the 'Mesh Band' watch from Chrome. The camera focuses on the intricate details of the metal mesh catching the light. An elegant, minimalist '20% OFF' text fades in gracefully, exuding high status.",
    likes: 5600,
    comments: 98,
    shares: 410,
  },
  {
    id: "feed-spend-more-brainrot",
    storeId: STORE_PULSE,
    videoUrl: "/feed/videos/Subway Surfers Sigma Grindset Video (1).mp4",
    prompt:
      "BRAIN ROT SPEND AD: A weird looping video of Subway Surfers gameplay but the character is just running into walls repeatedly. Overlay text aggressively pulses: 'YOU HAVE TOKENS JUST SITTING THERE. SPEND THEM NOW!! GET THE TIER UPGRADE!! SIGMA GRINDSET 📈💀'. Audio is heavily bass-boosted and distorted.",
    likes: 777777,
    comments: 6969,
    shares: 1337,
  },
  {
    id: "feed-5-chrome-luxury-watch-ad",
    storeId: STORE_CHROME,
    videoUrl: "/feed/videos/luxury-watch-ad.mp4",
    prompt:
      "A second luxurious macro advertisement for the 'Mesh Band' watch from Chrome. The camera slowly orbits the timepiece as warm golden light sweeps across the brushed steel surface. Water droplets bead and roll off the sapphire crystal. A deep, confident voiceover: 'Chrome. Time is your most exclusive accessory.' A '20% OFF' engraving catches the light in the final frame.",
    likes: 4200,
    comments: 71,
    shares: 289,
  },
  {
    id: "feed-0-spin-wheel-promo",
    storeId: STORE_TECHNOVA,
    videoUrl: "/feed/videos/brain-rot-alert.mp4",
    prompt:
      "BRAIN ROT ALERT: A hyper-kinetic, flashy, sensory-overload TikTok-style edit. The Mystic Wheel is spinning at 1000MPH while a robotic voice screams 'SPIN TO WIN! STOP SCROLLING AND SPIN!'. Bright rainbow strobes, exploding emojis (🤑💥🔥), and a massive flashing 'CLICK TOP RIGHT NOW' arrow pointing aggressively to the spin button.",
    likes: 99999,
    comments: 42069,
    shares: 1337,
  },
];
