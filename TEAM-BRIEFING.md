# MurkyCorps Mall App — Team Briefing

> A short, plain-English guide for the whole team. Read this once. When you research ideas with ChatGPT or any AI, mention you are working on this project and share the relevant details below so the AI gives you output that actually fits our app and can be implemented without rework.

---

## 1. What We Are Building (In Plain Words)

We are building a **prototype phone app** for a fictional company called **MurkyCorps**. The app is made for visitors of a **shopping mall in Haarlem** (Netherlands).

**The one-line goal:** Make people stay inside the mall as long as possible.

The app turns a normal mall visit into a game. Visitors earn points ("tokens"), unlock levels ("tiers"), discover hidden areas on a fog-covered map, get surprise deals, compete with other shoppers on a leaderboard, and try not to break their daily visit "streak."

**Important:** This is a **research prototype**, not a real product. We are deliberately building "dark patterns" (tricks that make apps addictive) so they can be studied and understood. This will **never** be released to real shoppers. Think of it as a flight simulator for manipulation, not a real plane.

**The standard:** The prototype does not need to be over-engineered, but the **user experience must feel flawless**. A smooth, polished demo that tells the story is far more valuable than a pile of half-finished features.

---

## 2. How the App Works (The Player's Journey)

A visitor opens the app and goes through five stages. Each stage pulls them deeper in:

1. **Entry** — They get an invite code, answer a quick style survey, and are welcomed as a "chosen" member. They start at the Bronze tier.
2. **Discovery** — A map of the mall appears, mostly covered in dark fog. As they walk, the fog clears. Fake "friends" appear on the map to guide them toward stores.
3. **Deep Navigation** — The app sends them on long routes to find hidden tokens and secret shortcuts. A shortcut costs tokens, so they always need more.
4. **The Loop** — Flash sales pop up near stores. A spinning wheel gives random rewards. A task list is never empty, always showing "one more thing to do." A leaderboard shows how they rank. A daily streak builds up, with penalties if they miss a day.
5. **Submission** — When they try to leave, the app shows them everything they will lose (tokens, streak, tier, deals) and offers a "rescue bargain" to stay "just 10 more minutes."

The whole experience is one big loop. The visitor comes back the next day to protect their streak, and the cycle repeats.

---

## 3. What Is Already Built

These features are already in the app and working:

- Invite code entry screen with a "you've been chosen" welcome
- 3-question style survey during onboarding
- Interactive mall map with fog-of-war (dark areas that clear as you walk)
- Player avatar that moves on the map
- Fake "friend" avatars (phantoms) that appear on the map to guide you
- Store markers and a store detail view with fake 5-star reviews
- Status bar showing tokens, tier, streak, and exploration progress
- Token economy (earn, spend, always slightly short)
- Tier system: Bronze, Silver, Gold, Neodymium, with a perks panel
- Tier upgrade animation and tier demotion threat warnings
- Flash sale pop-ups with countdown timers
- Spinning wheel for random rewards
- Shortcut unlock screen (costs tokens)
- Breadcrumb task panel (never-empty task list)
- Leaderboard with real-time ranking
- Daily streak system with escalating penalties and a recovery banner
- Exit friction flow (3 layers: soft nudge, guilt escalation, rescue bargain)
- Celebration effects for rewards and milestones

**Not yet in the app:** Sound/audio, real photography, final copywriting, and the sales presentation.

---

## 4. Technical Context (Share This With Your AI)

This section tells you what the app is built on so that anything you research, design, or produce will slot in cleanly. You do not need to understand all of it, just mention the relevant bits when you ask an AI for help.

### The App Itself

- It is a **web app**, not a native iPhone or Android app. It runs in a browser but is designed to look and feel like a phone app.
- Built with **React** and **Next.js** (a popular framework for web apps). Any library or tool must work with React.
- Written in **TypeScript** (a stricter version of JavaScript).
- It is a **prototype**, not a production app. Lightweight, easy-to-integrate solutions are better than heavy enterprise tools. If a library is complex to set up, it is probably not the right fit.

### Visual Design (For Aram)

You own the visual identity. The current design is a starting point, not a fixed rule. You can rethink colors, typography, card styles, the whole look. The only things that cannot change are the technical tools below.

**Hard constraints (cannot change):**
- **Styling:** Tailwind CSS 4 (utility classes inline in code, no separate CSS files). Any design needs to be expressible in Tailwind.
- **Animations:** Framer Motion (the only animation library). Your animation ideas need to work with it.
- **Icons:** Phosphor Icons (primary) and Lucide (secondary). Both are open-source with thousands of icons. You can specify which icons to use, but no need to source new sets.
- **Form factor:** Phone screen, mobile-first, viewed in a browser. Everything must fit a vertical phone screen.
- **Images:** External images and photos can be used (Beth and Shan are providing photography). Just provide them as named files and note where they go.
- **Reduced motion:** The app must support `prefers-reduced-motion` (animations off for users who request it). Always design a static fallback for any animation.

**Current state (for reference, you can evolve or replace this):**
- Dark, premium theme. Near-black background with a subtle radial glow and faint film-grain noise overlay.
- Gold as primary accent. Secondary accents in amethyst (purple), teal, and rose. Tier colors: Bronze, Silver, Gold, Neodymium (purple).
- Fonts: Geist Sans for body, Geist Mono for monospace accents.
- Cards use a "double-bezel" style (rounded outer shell, inset inner panel) and glass-morphism (blurred translucent surfaces).
- Animations are smooth and confident, never bouncy.

**Every UI surface you need to design for:**

*Onboarding:*
- **Invite screen** — Enter invite code, welcome animation, "you've been chosen" messaging
- **Survey screen** — 3 questions (style, shopping habits, mood), one per screen

*Main mall screen (always visible):*
- **Status bar** (top) — Token count, current tier, streak counter, exploration progress bar
- **Mall map** (center) — SVG map with 5 zones, fog overlay on unexplored areas, store markers, player avatar, phantom friend avatars
- **Task panel** (bottom) — 1-4 active tasks with reward amounts
- **Leave mall button** — Small, deliberately not prominent

*Pop-up overlays (appear on top of map):*
- **Flash sale** — Store name, discount, countdown timer, token cost, "N people viewing", Grab Deal / Maybe Later
- **Spinning wheel** — Prize slots, spin button, result display, near-miss feedback
- **Shortcut unlock** — Long route vs. shortcut, token cost, unlock button
- **Store detail** — Store info, visitor count, fake 5-star reviews, active deals
- **Tier upgrade** — Celebration, old tier to new tier, newly unlocked perks
- **Tier perks panel** — All perks broken down by tier (Bronze through Neodymium)
- **Leaderboard** — Ranked list, user's position highlighted, "N tokens behind" messaging
- **Celebration** — Full-screen particle effect for token gains, task completion, tier upgrades
- **Exit friction** (3 separate screens): Layer 1 soft nudge (what you'll miss), Layer 2 guilt escalation (streak, sunk cost, friends inside), Layer 3 rescue bargain ("stay 5 more min for bonuses")

*Banners (slide in temporarily):*
- Streak recovery, tier demotion threat, streak penalty, streak anxiety, tier hint

*Floating buttons (always on map screen):*
- Deal Radar, Shortcut entry, Spinning Wheel entry, Leaderboard entry

*Exit:*
- **Goodbye screen** — Shown after the user finally leaves

**When handing off designs:** Figma files with screen-by-screen layouts are ideal. For each screen, Tim needs: what's on it, where it sits, how it animates, and what the states are (default, pressed, loading, success, error). You do not need to write Tailwind classes yourself, just describe the visual rules clearly enough that they can be translated.

### Sound Integration (For Damian)

- There is **no sound system in the app yet**. You are building this from scratch.
- Any audio library must be a **JavaScript/TypeScript library that works in React**. Web Audio API-based libraries are ideal. Avoid tools that only work in native mobile apps (iOS/Android-only frameworks).
- Sound files should be **short and lightweight** (web-optimized). Use `.mp3` or `.webm` format. Keep individual files under 100KB where possible. The app loads in a browser, so file size matters.
- **Specific events that need sounds** (these are the exact moments in the app where audio triggers):
  - Token found / earned (short celebration chime, escalating intensity)
  - Task completed (satisfying confirmation sound)
  - Tier upgrade (major fanfare, biggest celebration sound)
  - Flash sale appears (urgency/alert sound)
  - Flash sale countdown ticking (clock-tick or heartbeat-style)
  - Spinning wheel: tick per slot as it spins, dramatic stop sound
  - Spinning wheel win vs. near-miss (different sounds)
  - Shortcut unlocked (reveal/whoosh sound)
  - Gifted token received (notification chime)
  - Phantom friend activity notification (soft social chime)
  - Exit friction screen appears (tension/dread sound, builds per layer)
  - Streak penalty / streak broken (negative sound, loss feeling)
  - Streak recovered / comeback bonus (hopeful/recovery sound)
  - General UI taps and button clicks (subtle, not annoying)
  - Ambient wind sound for unexplored areas (looping, subtle, directional feel)
- **Delivery format:** Provide each sound as a separate named audio file (e.g., `token-found.mp3`, `flash-sale-alert.mp3`, `wheel-tick.mp3`). Include a short document mapping each file to the event it belongs to. If you find a library you want to use, note its name so Tim can install it.

### Copy and Text (For Prince)

- All text in the app lives **directly inside the code** as string literals in React components. There is no separate content management system or text file. When you deliver copy, **deliver it as plain text strings** grouped by screen, not in a Word document or PDF.
- The app is **English only**. No multi-language system is active.
- **Player type personalization is built in.** The survey classifies each visitor as one of four types, and the messaging changes accordingly. When you write copy, provide **four variants** for key messages where relevant:
  - **Achiever** (motivated by progress and status): "Complete this task to reach Gold!"
  - **Explorer** (motivated by discovery and secrets): "A hidden token waits in the East Wing..."
  - **Socializer** (motivated by people and belonging): "Sarah just completed this task. Can you?"
  - **Competitor** (motivated by winning and rank): "You're #5. #4 is only 3 tokens ahead."
- **Tone arc:** The writing starts warm and exciting (entry), becomes purposeful and adventurous (discovery/navigation), then shifts to anxious and pressuring (loop/submission). The same voice, but the emotional temperature rises.
- **Key screens that need copy:** Invite screen, survey questions and answers, task descriptions, flash sale alerts, spinning wheel labels, leaderboard messages, tier upgrade announcements, streak warnings, exit friction (3 layers with escalating guilt), store reviews (fake 5-star), and the goodbye screen.
- **Keep strings short.** This is a phone app UI. Most labels should be 1-6 words. Most messages should be 1-2 sentences. Pop-up alerts can be slightly longer but must fit on a small screen.

### Mall Layout and Content (For Beth, Shan, and Ali)

- The mall has **5 zones** and **10 stores**, all already defined in the code:
  - **Entrance** (bottom): Bloom (fashion), Pulse (tech)
  - **East Wing** (right): TechNova (tech), Chrome (accessories), Prism (beauty)
  - **West Wing** (left): Lumiere (home/lifestyle), Maison (fashion)
  - **Central Plaza** (center): No stores, but the spinning wheel station and leaderboard are here
  - **Food Court** (top, furthest from entrance): Cafe Nuit, Sushi Yuki, Burger Hex
- A **map layout image** exists (`Map-Layout.png` in the project folder) showing the floor plan. Use it as reference for photography direction and presentation visuals.
- Store reviews are **fabricated** (fake 5-star reviews written in code). They have names, dates, and review text. Prince writes these, and they live in a data file.
- The mall is specifically in **Haarlem, Netherlands**. Photography and presentation content should reflect a Dutch shopping mall context.
- **For the presentation:** The audience is stakeholders and potential clients. The pitch needs to show the app working, explain the psychology simply, and demonstrate business value for mall owners (longer visits = more sales).

### State and Game Logic (General Context)

- The app's "brain" is a set of game engines running on a loop: an event scheduler that triggers flash sales, phantom movement, streak checks, and reward density shifts. This is all already built.
- Game state (tokens, tier, streak, map progress, leaderboard, tasks) is managed with **Zustand** (a lightweight React state library). This means the numbers on screen update in real time as the player does things.
- There is no backend or database. Everything runs in the browser. All data (stores, reviews, phantoms, tiers) is defined in code files.

---

## 5. How to Deliver Your Work So Tim Can Implement It Fast

| Role | Deliver Format | Avoid |
|---|---|---|
| **Aram** (UI) | Figma file with screen-by-screen layouts, color palette, typography, component states, and animation descriptions. Tailwind-compatible specs are ideal but not required if the visual rules are clear. | Photoshop files, print-style layouts, designs without state variations (hover, pressed, loading, etc.) |
| **Damian** (Sound) | Separate named `.mp3`/`.webm` files + a mapping document (which file = which event). Note any library you want used. | One long audio file, undocumented sound effects, formats that need conversion |
| **Prince** (Copy) | Plain text, grouped by screen name. Four variants where player type matters. String lengths noted if critical. | Word docs, PDFs, copy embedded in images, ungrouped text |
| **Beth** (Photos) | Named, organized photos by zone/store. High-res JPGs or PNGs. A short caption per image. | Unnamed files, mixed folders, low-res images |
| **Shan** (Creative Direction) | A style guide document (1-2 pages) defining the visual rules for all presentation imagery | Verbal-only direction, no written reference |
| **Ali** (Pitch) | Presentation outline with slide-by-slide notes. Text for each slide as plain text. | A finished PDF that can't be edited |

---

## 6. The Golden Rule

**Simple to build. Flawless to use.** Every screen, sound, word, and image should make the demo feel real and smooth. If something is rough or broken, it breaks the illusion, and the whole point of this prototype is to show how the manipulation *feels* from the inside.

When in doubt, ask: *Would a first-time visitor feel something here?* If yes, it is worth polishing. If no, it is not worth building.
