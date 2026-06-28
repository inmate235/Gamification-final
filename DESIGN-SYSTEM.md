# MurkyCorps Mall App — Design System & Agent Reference

> **Single source of truth for all UI work.** Read this before touching any component. Every agent, every session, every collaborator starts here.

---

## 0. Quick-start for new agents

```
Branch:   new-UI
Repo:     /Users/tim/Desktop/Coding/Gamification-final
```

**Before making any change:**
```bash
npm run typecheck   # must be clean
npm run test        # 596 tests / 42 files must all pass
```

**After every file change — run the same two commands again.** Both must stay green before you consider the task done.

**Files you are allowed to edit:**
- `src/components/**` (visual layer only — see Section 10 for what NOT to touch inside components)
- `src/app/globals.css`
- `src/app/layout.tsx`

**Files that are off-limits:**
- `src/engine/` — game mechanics
- `src/stores/` — Zustand state
- `src/data/` — game data
- `src/lib/` — utilities
- `src/types/` — TypeScript types
- `src/hooks/` — custom hooks

---

## 1. Figma reference

**File URL:**
```
https://www.figma.com/design/2wJc91XFnCvYjde6FUFV38/Gamification?node-id=0-1
```

### Connecting Figma MCP (per session)

```bash
droid mcp add figma https://mcp.figma.com/mcp --type http
```

Re-authenticate when prompted. The Figma account may hit MCP rate limits (Starter plan). If `figma___get_screenshot` or `figma___download_assets` return a rate-limit error, use the manual export path instead.

### Manual asset export (when MCP is rate-limited)

1. Open the Figma file in the browser
2. Select the frame or illustration layer
3. Export as PNG @2x (trim whitespace, transparent bg where possible)
4. Drop the file into `public/assets/figma/` using the exact filename from Section 7

### Frame inventory (all 13 frames)

| Node ID | Frame name | Maps to |
|---|---|---|
| `1:2` | Invite | `InviteScreen` — input phase |
| `1:18` | Verified invitation | `InviteScreen` — welcome phase |
| `1:127` | Invalid invite | `InviteScreen` — error state |
| `3:134` | Q1 Survey | `SurveyScreen` — question 1 |
| `3:209` | Q2 Survey | `SurveyScreen` — question 2 |
| `3:240` | Q3 Survey | `SurveyScreen` — question 3 |
| `11:27` | Mall Map | `MallMap` + `StatusBar` main screen |
| `3:258` | Active Quests | `TaskPanel` |
| `14:96` | Store Info | `StoreDetail` overlay |
| `15:209` | Spinning Wheel | `SpinningWheel` overlay |
| `25:91` | Wheel Reward / Buy Spins | `SpinningWheel` result screen |
| `25:143` | Trending Feed Unlock | `TimelineOnboardingPopup` |
| `25:209` | Marketing | Not yet implemented |

---

## 2. Design direction

The Figma design is **light, bright, and Gen-Z playful.** It is the opposite of a dark premium look. Any agent seeing a dark background, gold glow, or glassmorphism card in this codebase is looking at unconverted code — convert it.

### Visual personality

| Aspect | Figma target |
|---|---|
| Backgrounds | White `#ffffff`; bright yellow `#ffe600` for feature sections and quest cards |
| Primary accent | Vibrant magenta / hot-pink `#e6009e` |
| Display headings | Chunky rounded **sticker font** — white fill + thick black outline |
| Display font | **Fredoka** (Google Font, weights 500/600/700) |
| Body font | **Geist Sans** |
| Decoration | Hand-drawn scribble stars, dots, lightning bolts — part of the Figma illustrations |
| Illustrations | 3D claymation renders (mall buildings, food items, store icons, phone device) |
| Buttons | Solid magenta pill with a 3D bottom shadow that physically compresses on press |
| Inputs | White bg, thick `3px` magenta border, fully rounded, centered placeholder |
| Logo | Black pill top-right of every screen reading "Murky" in white Fredoka |
| Mood reference | Duolingo / BeReal energy — not Apple / luxury |

### Anti-patterns — hard bans

These must never appear in converted components:

- Dark backgrounds (`bg-[#0a0a0f]`, `bg-slate-900`, `bg-[#12121a]`, etc.)
- Gold accents (`#d4af37`, `#b8941f`, `text-gradient-gold`, `.glow-gold`)
- Amethyst / teal accents (old theme — removed from tokens)
- Glassmorphism / double-bezel cards (`.bezel-card`, `.bezel-card-inner`)
- AI-purple (`indigo-*`, generic `purple-*`) — exception: `--color-tier-neodymium` for the Neodymium tier badge only
- Emojis anywhere in JSX

---

## 3. Design tokens

All tokens live in `src/app/globals.css` inside the `@theme` block. Tailwind CSS 4 reads these directly — no separate config file.

```css
/* Surfaces */
--color-background:       #ffffff
--color-surface:          #ffffff
--color-surface-elevated: #fafafa
--color-surface-yellow:   #ffe600   /* yellow sections, quest card backgrounds */

/* Text */
--color-ink:              #141414   /* primary — never pure #000000 */
--color-text-primary:     #141414
--color-text-muted:       #4b4b4b
--color-text-dim:         #8a8a8a

/* Accents */
--color-accent:           #e6009e   /* magenta — ALL primary CTAs */
--color-accent-deep:      #b8007e   /* magenta shadow / pressed state */
--color-accent-yellow:    #ffe600
--color-accent-purple:    #7c3aed   /* Neodymium tier badge ONLY */
--color-accent-teal:      #14b8a6   /* secondary info badges only */
--color-accent-lime:      #84cc16
--color-danger:           #ef4444

/* Tier badge colors */
--color-tier-bronze:      #b87333
--color-tier-silver:      #c0c0c0
--color-tier-gold:        #e6b800
--color-tier-neodymium:   #7c3aed

/* Easing curves */
--ease-premium: cubic-bezier(0.32, 0.72, 0, 1)   /* smooth exits / entrances */
--ease-pop:     cubic-bezier(0.34, 1.56, 0.64, 1) /* springy pop-in reveals */

/* Border */
--color-border-hairline: rgba(20, 20, 20, 0.1)
```

---

## 4. Typography

### Font loading (`src/app/layout.tsx`)

Three fonts are loaded via `next/font/google`:

| Variable | Font | Weights | Role |
|---|---|---|---|
| `--font-geist-sans` | Geist Sans | variable | Body copy, labels |
| `--font-geist-mono` | Geist Mono | variable | Token counts, codes |
| `--font-fredoka` | Fredoka | 500, 600, 700 | Display / sticker headings |

All three are added to `<html>` as CSS variables:
```tsx
<html className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable}`}>
```

### Usage scale

| Role | Font | Tailwind | Notes |
|---|---|---|---|
| Hero / sticker headings | Fredoka | `sticker-heading` utility | White fill + black outline |
| Section headings | Fredoka | `font-display font-semibold text-2xl` | No outline needed for smaller sizes |
| Body copy | Geist Sans | `text-sm text-[#4b4b4b] leading-relaxed` | Max `~40ch` width |
| Labels / eyebrows | Geist Sans | `text-sm font-medium text-[#141414]` | |
| Monospace (tokens, codes) | Geist Mono | `font-mono tracking-wider` | |
| Logo pill | Fredoka | inside `Logo` component | 600 weight |

### Sticker heading CSS

Defined as `.sticker-heading` in `globals.css`:

```css
.sticker-heading {
  font-family: var(--font-display);
  color: #ffffff;
  -webkit-text-stroke: 2.5px #141414;
  paint-order: stroke fill;        /* keeps outline behind fill */
  line-height: 0.95;
  letter-spacing: -0.01em;
  text-shadow: 3px 4px 0 rgba(20, 20, 20, 0.9);
}
```

Use for: "You've been chosen", "Active Quests", "Trending feed unlock", and any other primary hero headline.

---

## 5. Component library

### Utility classes (`globals.css`)

| Class | Purpose | When to use |
|---|---|---|
| `.sticker-heading` | White-fill, black-outline Fredoka display heading | All primary hero headings |
| `.btn-magenta` | Solid magenta pill, 3D shadow, compresses on press | All primary CTAs |
| `.pill-outline` | White bg, 1.5px black border, rounded-full | Social proof chips, tags, secondary labels |
| `.input-pill` | White bg, 3px magenta border, rounded-full, centered | Code inputs, search fields |

### `.btn-magenta` detail

```css
background: #e6009e;
box-shadow: 0 6px 0 #b8007e;       /* 3D depth */
:active → translateY(4px) + box-shadow: 0 2px 0 #b8007e;  /* press */
```

Always use with `whileTap={{ scale: 0.97 }}` on a Framer `motion.button` for tactile feedback.

### Shared components

| Component | Path | Status | Notes |
|---|---|---|---|
| `Logo` | `src/components/ui/Logo.tsx` | Done | Black "Murky" pill, top-right every screen |
| `MagneticButton` | `src/components/ui/MagneticButton.tsx` | Keep, not used | Mocked in tests — do not delete |
| `ParticleField` | `src/components/onboarding/ParticleField.tsx` | Keep, not used | Mocked in tests — do not delete |

### Logo usage

```tsx
import { Logo } from "@/components/ui/Logo";

// Top-right of every screen
<div className="flex justify-end mb-1">
  <Logo size={38} />
</div>
```

---

## 6. Motion rules

1. **Spring pop** for reveals and button interactions: `ease: [0.34, 1.56, 0.64, 1]`
2. **Smooth slide** for exits and transitions: `ease: [0.32, 0.72, 0, 1]`
3. **Tactile press** on all buttons: `whileTap={{ scale: 0.97 }}`
4. **Stagger** list items with CSS: `transition-delay: calc(var(--index) * 60ms)`
5. **Hardware-accelerated only** — never animate `top`, `left`, `width`, `height`; use `transform` + `opacity`
6. **No magnetic hover physics** — removed in the playful build
7. **Reduced motion** fallback: the `globals.css` base already handles `prefers-reduced-motion`

### Standard entrance pattern

```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
>
```

---

## 7. Asset pipeline

All Figma 3D illustrations go in `public/assets/figma/`. Every `<img>` tag in the codebase uses `onError={() => setHeroError(true)}` to show a gradient fallback when an asset is missing, so the app never crashes with a broken image.

| Filename | Source frame | Used in |
|---|---|---|
| `invite-hero.png` | `1:2` — 3D mall cluster illustration | `InviteScreen` hero |
| `survey-achiever.png` | `3:134` — Q1 option (Achiever) | `SurveyScreen` Q1 card |
| `survey-socializer.png` | `3:134` — Q1 option (Socializer) | `SurveyScreen` Q1 card |
| `survey-explorer.png` | `3:134` — Q1 option (Explorer) | `SurveyScreen` Q1 card |
| `survey-killer.png` | `3:134` — Q1 option (Competitor) | `SurveyScreen` Q1 card |
| `map-bg.png` | `11:27` — full 3D map illustration | `MallMap` background |
| `quests-icon-food.png` | `3:258` — food bowl icon | `TaskPanel` quest cards |
| `quests-icon-token.png` | `3:258` — spinning compass icon | `TaskPanel` quest cards |
| `quests-icon-store.png` | `3:258` — store building icon | `TaskPanel` quest cards |
| `feed-phone.png` | `25:143` — 3D phone with sparkles | `TimelineOnboardingPopup` |

**Export settings:** PNG @2x, trim whitespace, transparent background where the illustration has one.

---

## 8. Screen-by-screen specification

### 8.1 InviteScreen ✅ CONVERTED

**File:** `src/components/onboarding/InviteScreen.tsx`
**Figma:** `1:2` (input), `1:18` (welcome), `1:127` (error)

**Layout (top to bottom, `max-w-sm` centered on white bg):**
1. Black "Murky" pill — `flex justify-end`
2. Hairline divider `h-px bg-[#141414]/10`
3. Eyebrow: magenta `Star` icon (fill) + "Invite Only · Members Exclusive"
4. Hero `<img src="/assets/figma/invite-hero.png">` — `aspect-[16/10]`, `rounded-2xl`, gradient fallback
5. Sticker heading `"You've been chosen"` — `sticker-heading text-[2.6rem]`
6. Outline pill chip: "Invited by Sarah · Gold member"
7. Body copy — Geist, `#4b4b4b`, `max-w-[38ch]`
8. `input-pill` — shakes on error via framer `x` animation
9. `role="alert"` error paragraph, centered, red
10. `btn-magenta` full-width: "Enter Mall" + `ArrowRight` icon
11. Footer: "1747 Members – **Limited spots remaining**"

**Welcome phase:** Magenta circle + `SealCheck` icon, sticker "You're in!", pulsing "Tap to continue".

**Test contracts (do not break):**
- `aria-label="Invite code"` on the input
- Button accessible name matches `/ENTER MALL/i`
- Text `/Invite Only/i` in eyebrow
- Text `/Invited by Sarah/i` and `/Gold member/i` in social proof chip
- `role="alert"` for error messages
- Text `/Tap to continue/i` in welcome phase

---

### 8.2 SurveyScreen — NEEDS CONVERSION

**File:** `src/components/onboarding/SurveyScreen.tsx`
**Figma:** `3:134`, `3:209`, `3:240`

**Design notes from Figma screenshot:**
- White background
- Sticker heading for question text
- **Q1:** 2×2 grid of image cards — each card is a Bartle type with a 3D icon (`survey-*.png`) and label
- **Q2–Q3:** full-width or side-by-side option rows
- Selected card: magenta `3px` border
- Magenta pill progress bar at bottom (replaces dot indicators — but keep dot `data-testid` if tests reference them)
- No dark colors anywhere

**Key test contracts to preserve:**
- Each option must be clickable and advance the question
- Progress must update in the store
- No Bartle type exposed in UI text

---

### 8.3 MallMap — NEEDS CONVERSION

**File:** `src/components/mall/MallMap.tsx`
**Figma:** `11:27`

**Design notes from Figma screenshot:**
- White background with scattered doodle decorations (scribbles, stars, colored dots)
- Large 3D claymation map illustration centered (`map-bg.png`) — the illustration IS the map
- Zone label pills: solid colored rounded pills (magenta, purple, teal, yellow) for Food Court, West Wing, Central Plaza, East Wing, Entrance
- Bottom action bar: yellow "1 DAY STREAK" pill + magenta "FREE SPIN" pill
- "Murky" pill top-right
- Store markers overlaid on the illustration at correct zone positions

---

### 8.4 StatusBar — NEEDS CONVERSION

**File:** `src/components/mall/StatusBar.tsx`
**Figma:** part of `11:27`

**Design notes:**
- Light bar (white or very light bg)
- Token count with magenta `Star` icon
- Tier badge with correct `--color-tier-*` color
- Streak counter
- Exploration progress bar: magenta fill (`#e6009e`), white/light track

---

### 8.5 StoreMarker — NEEDS CONVERSION

**File:** `src/components/mall/StoreMarker.tsx`
**Figma:** part of `11:27`

**Design notes:**
- Solid colored circle markers matching zone colors (not dark)
- Store name label below marker in Geist Sans, `#141414`
- Hot indicator: use `Fire` icon (Phosphor), no emoji

---

### 8.6 ZoneLabel — NEEDS CONVERSION

**File:** `src/components/mall/ZoneLabel.tsx`
**Figma:** part of `11:27`

**Design notes from Figma screenshot:**
- Solid filled rounded pill labels (not outline)
- Colors per zone: Food Court = magenta, Central Plaza = purple, West/East Wing = teal/yellow, Entrance = lime
- White text, Fredoka font, short uppercase-ish label

---

### 8.7 TaskPanel — NEEDS CONVERSION

**File:** `src/components/tasks/TaskPanel.tsx`
**Figma:** `3:258`

**Design notes from Figma screenshot:**
- Bright yellow (`#ffe600`) full-screen or full-panel background
- Sticker heading "Active Quests" at top
- Quest cards: white bg, `rounded-2xl`, left = task text (Geist), right = 3D icon (`quests-icon-*.png`)
- Magenta star badge (filled) top-right of card showing token reward number
- Magenta pill progress bar below each card: `1/2` or `2/2` label centered
- "Murky" pill top-right

---

### 8.8 TimelineOnboardingPopup — NEEDS CONVERSION

**File:** `src/components/social/TimelineOnboardingPopup.tsx`
**Figma:** `25:143`

**Design notes from Figma screenshot:**
- Yellow card (`#ffe600`) as the main content area, white background surrounds it
- Sticker heading "Trending feed unlock" (white + black outline on yellow bg)
- Body copy: "Swipe Through our new AI generated" — Geist, left-aligned, `#141414`
- Outline pill token reward: "+10 Tokens for exploring" (magenta border, white bg)
- `btn-magenta` full-width: "Start Watching"
- Below yellow card: 3D phone illustration (`feed-phone.png`) with sparkle icons

---

### 8.9 StoreDetail — NEEDS CONVERSION

**File:** `src/components/overlays/StoreDetail.tsx`
**Figma:** `14:96`

**Design notes (inferred — no screenshot captured yet):**
- White bottom-sheet modal
- Category badge using correct `--color-accent-*` for the store's category
- "From your feed" badge in teal (`--color-accent-teal`)
- `btn-magenta` as primary CTA
- Fake reviews: real avatar placeholders, not generic SVG heads

---

### 8.10 SpinningWheel — NEEDS CONVERSION

**File:** `src/components/overlays/SpinningWheel.tsx`
**Figma:** `15:209`, `25:91`

**Design notes (inferred — no screenshot captured yet):**
- Bright colored wheel segments (not dark)
- `btn-magenta` "SPIN!" button
- "Buy More Spins" as secondary option (outline style)
- Win result screen: celebratory yellow bg, sticker heading for prize

---

## 9. Conversion status

| File | Status | Notes |
|---|---|---|
| `src/app/globals.css` | ✅ Done | Light theme, magenta tokens, Fredoka var, sticker/btn-magenta/pill/input utilities |
| `src/app/layout.tsx` | ✅ Done | Fredoka loaded via `next/font/google`, themeColor white |
| `src/components/ui/Logo.tsx` | ✅ Done | Black "Murky" pill |
| `src/components/onboarding/InviteScreen.tsx` | ✅ Done | 12/12 tests pass |
| `src/components/onboarding/SurveyScreen.tsx` | ⚠️ Pending | Convert next |
| `src/components/mall/MallMap.tsx` | ⚠️ Pending | |
| `src/components/mall/StatusBar.tsx` | ⚠️ Pending | |
| `src/components/mall/StoreMarker.tsx` | ⚠️ Pending | |
| `src/components/mall/ZoneLabel.tsx` | ⚠️ Pending | |
| `src/components/tasks/TaskPanel.tsx` | ⚠️ Pending | |
| `src/components/social/TimelineOnboardingPopup.tsx` | ⚠️ Pending | |
| `src/components/overlays/StoreDetail.tsx` | ⚠️ Pending | |
| `src/components/overlays/SpinningWheel.tsx` | ⚠️ Pending | |

**Recommended conversion sequence (journey order):**
1. `SurveyScreen`
2. `MallMap` + `StatusBar` + `StoreMarker` + `ZoneLabel` (all part of the same screen)
3. `TaskPanel`
4. `TimelineOnboardingPopup`
5. `StoreDetail`
6. `SpinningWheel`

---

## 10. Hard constraints — never break these

### Testing

- **596 tests across 42 test files must pass** at all times
- Run `npm run test` after every component change
- Run `npm run typecheck` after every change

### Component contracts

- Preserve all `aria-label`, `role`, and `data-testid` attributes exactly
- Preserve all Zustand store calls: `usePlayerStore`, `useUIStore`, `useOnboardingStore`, `useMallStore`, etc.
- Preserve all `router.push()` calls and route guard logic
- Do not remove `MagneticButton.tsx` or `ParticleField.tsx` — they are `vi.mock`'d in test files

### Layout

- Mobile-first, phone-screen form factor
- Single column, `max-w-sm mx-auto` for overlay/onboarding screens
- Full viewport for the mall map screen
- Always `min-h-[100dvh]` — never `h-screen`

### Code quality

- No emojis in JSX — use Phosphor icons
- No inline `style={}` for things expressible in Tailwind
- No `z-index` values above 50 except for modals/overlays
- Hardware-accelerated animations only (`transform`, `opacity`)

---

## 11. Starting a new session

Paste this prompt at the beginning of any new Droid session on this project:

```
I am working on the new-UI branch of the MurkyCorps Mall gamification app
at /Users/tim/Desktop/Coding/Gamification-final.

Read DESIGN-SYSTEM.md first — it is the single source of truth for all UI work.

Key facts:
- The design direction comes from a Figma file (URL in the doc)
- The look is light + magenta + playful (Fredoka sticker font, NOT dark premium)
- 596 tests across 42 files must stay green — run npm run test after every change
- Check Section 9 of DESIGN-SYSTEM.md for what is already converted and what to do next
- The next screen to convert is listed first in the "Recommended conversion sequence"
```

---

*Last updated: 2026-06-28 — InviteScreen converted, design system pivoted to light/magenta/Fredoka.*
