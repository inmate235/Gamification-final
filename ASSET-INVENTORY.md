# Asset Inventory & Integration Plan

> Created: 2026-06-29
> Status: **Organized, not yet integrated**
> Source: "Additional asstest" folder (now cleaned up and removed)

---

## 1. Feed Content Videos

**Location:** `/public/feed/videos/`

| File | Size | Feed ID | Store | Integration |
|---|---|---|---|---|
| `brain-rot-alert.mp4` | 2.7 MB | `feed-0-spin-wheel-promo` | TechNova | Add `videoUrl` to existing placeholder feed item |
| `murky-playground-ad.mp4` | 2.2 MB | `feed-murky-playground-ad` | Murky Playground | Add `videoUrl` to existing placeholder feed item |
| `luxury-watch-ad.mp4` | 2.4 MB | **New feed item** | Chrome | Add as a new `FeedItem` entry in `feedData.ts` |

**Existing feed videos (already integrated):**
- `cyberpunk-keyboard.mp4` → `feed-1-technova`
- `glow-earbuds.mp4` → `feed-2-pulse`
- `spring-fashion.mp4` → `feed-3-bloom`
- `luxury-watch.mp4` → `feed-4-chrome` (keep as-is; the new `luxury-watch-ad.mp4` is an additional ad)

**Code touch point:** `src/data/feedData.ts` — add `videoUrl` to the two placeholder items and add a new feed entry for the luxury watch ad.

---

## 2. Sound Effects

**Location:** `/public/audio/sfx/` (kebab-case, already existed)
**Duplicate removed:** `public/assets/Additional asstest/murky corps sfx/` (same files, Title Case names)

The app currently has **no audio playback infrastructure**. Integration requires building a sound utility (e.g., `src/lib/sound.ts` or `src/hooks/useSound.ts`) using the Web Audio API or `HTMLAudioElement`.

### Sound-to-trigger mapping

| File | Trigger | Component(s) |
|---|---|---|
| `access-to-app.wav` | App initial load / landing page | `app/page.tsx` or layout |
| `achievement.wav` | Task completed, achievement unlocked, tier upgrade shown | `TierUpgrade.tsx`, `TaskPanel`, `StreakBadge` |
| `background.wav` | Ambient loop for the mall map (looping) | `MallExperience.tsx` or `MallMap.tsx` |
| `open-tab.wav` | Opening any overlay | `StoreDetail.tsx`, `SpinningWheel.tsx`, `ShopOverlay.tsx`, `FlashSale.tsx`, `TierPerksPanel.tsx`, `TierUpgrade.tsx` |
| `close-tab.wav` | Closing any overlay | Same as above (on dismiss) |
| `swoosh.wav` | Panel transitions, swipe gestures, feed navigation | `TimelineFeed.tsx`, `SpinningWheel.tsx`, survey transitions |
| `spin-the-wheel.wav` | Spinning wheel spin action | `SpinningWheel.tsx` |
| `survey-bold.wav` | Survey: select "Bold & Avant-Garde" | `SurveyScreen.tsx` |
| `survey-classic.wav` | Survey: select "Classic & Refined" | `SurveyScreen.tsx` |
| `survey-trendy.wav` | Survey: select "Trendy & Fresh" | `SurveyScreen.tsx` |
| `survey-cozy.wav` | Survey: select "Cozy & Casual" | `SurveyScreen.tsx` |
| `survey-friends.wav` | Survey: select "With friends" | `SurveyScreen.tsx` |
| `survey-solo.wav` | Survey: select "Solo adventure" | `SurveyScreen.tsx` |
| `survey-deals.wav` | Survey: select "Hunting deals" | `SurveyScreen.tsx` |
| `survey-discovery.wav` | Survey: select "Discovering new things" | `SurveyScreen.tsx` |

**Integration approach (when ready):**
1. Create `src/lib/sound.ts` with a `playSound(filename)` utility
2. Create `src/hooks/useSound.ts` hook for React components (respects mute state in `uiStore`)
3. Add a global mute toggle (already partially exists: `uiStore.isMuted` for feed videos)
4. Call `playSound()` at each trigger point listed above

---

## 3. Tier Images

**Location:** `/public/assets/tiers/`

| File | Size | Tier |
|---|---|---|
| `bronze.png` | 2.3 MB | Bronze |
| `silver.png` | 3.2 MB | Silver |
| `gold.png` | 3.1 MB | Gold |
| `neodymium.png` | 4.4 MB | Neodymium |

**Purpose:** Full-screen / large hero visual in the `TierUpgrade` popup.

**Code touch point:** `src/components/overlays/TierUpgrade.tsx`
- Add `tierImageUrl` field to `TIER_VISUALS` in `src/data/tierData.ts` pointing to `/assets/tiers/{tier}.png`
- Replace or augment the current CSS-drawn badge (circle with Phosphor icon) with the hero image
- The current badge is in the tier-colored banner section, roughly 96x96px — the hero image will likely replace or sit behind the entire banner area

**Also potentially relevant:** `TierPerksPanel.tsx` (tier perks display) could use smaller versions of these images.

---

## 4. Shopper Walking Video

**Location:** `/public/assets/onboarding/shopper-walking.mp4`

| File | Size |
|---|---|
| `shopper-walking.mp4` | 2.6 MB |

**Purpose:** Onboarding / loading screen animation.

**Code touch point:** Likely `app/page.tsx` (landing page) or `OnboardingGuard.tsx` — play as a loading animation during app boot or onboarding flow.

---

## 5. Final Asset Directory Structure

```
public/
├── assets/
│   ├── avatar/
│   │   └── shopper.gif                    (existing, phantom avatars on map)
│   ├── map/
│   │   ├── central-plaza.png              (existing)
│   │   ├── east-wing.png                  (existing)
│   │   ├── entrance.png                   (existing)
│   │   ├── food-court.png                 (existing)
│   │   ├── streak-badge.png               (existing)
│   │   └── west-wing.png                  (existing)
│   ├── onboarding/
│   │   ├── hero.png                       (existing)
│   │   ├── not-found.png                  (existing)
│   │   ├── verified.png                   (existing)
│   │   └── shopper-walking.mp4            (NEW - onboarding/loading animation)
│   ├── survey/
│   │   ├── bold.png                       (existing)
│   │   ├── classic.png                    (existing)
│   │   ├── cozy.png                       (existing)
│   │   ├── deals.png                      (existing)
│   │   ├── discovery.png                  (existing)
│   │   ├── friends.png                    (existing)
│   │   ├── solo.png                       (existing)
│   │   └── trendy.png                     (existing)
│   ├── tasks/
│   │   ├── task-explore.png               (existing)
│   │   ├── task-token.png                 (existing)
│   │   └── task-visit.png                 (existing)
│   ├── tiers/                             (NEW directory)
│   │   ├── bronze.png                     (NEW - tier upgrade hero visual)
│   │   ├── gold.png                       (NEW - tier upgrade hero visual)
│   │   ├── neodymium.png                  (NEW - tier upgrade hero visual)
│   │   └── silver.png                     (NEW - tier upgrade hero visual)
│   └── unused/
│       ├── boi.png                        (existing)
│       ├── murkey-mall-start.png          (existing)
│       ├── spin-wheel-bottom-left.png     (existing)
│       └── spin-wheel-bottom-right.png    (existing)
├── audio/
│   └── sfx/                               (existing, 15 files, kebab-case)
│       ├── access-to-app.wav
│       ├── achievement.wav
│       ├── background.wav
│       ├── close-tab.wav
│       ├── open-tab.wav
│       ├── spin-the-wheel.wav
│       ├── swoosh.wav
│       ├── survey-bold.wav
│       ├── survey-classic.wav
│       ├── survey-cozy.wav
│       ├── survey-deals.mp3
│       ├── survey-discovery.wav
│       ├── survey-friends.mp3
│       ├── survey-solo.wav
│       └── survey-trendy.wav
└── feed/
    └── videos/
        ├── brain-rot-alert.mp4            (NEW - feed-0-spin-wheel-promo)
        ├── cyberpunk-keyboard.mp4         (existing - feed-1-technova)
        ├── glow-earbuds.mp4              (existing - feed-2-pulse)
        ├── luxury-watch.mp4              (existing - feed-4-chrome)
        ├── luxury-watch-ad.mp4           (NEW - additional Chrome ad)
        ├── murky-playground-ad.mp4       (NEW - feed-murky-playground-ad)
        └── spring-fashion.mp4            (existing - feed-3-bloom)
```

---

## 6. Cleanup Performed

- [x] Copied 3 feed videos to `/public/feed/videos/` with kebab-case names
- [x] Copied 4 tier images to `/public/assets/tiers/`
- [x] Copied shopper walking video to `/public/assets/onboarding/`
- [x] Removed `public/assets/Additional asstest/` folder (included duplicate `murky corps sfx/` and empty `Sounds/` folder)
- [x] Kept `/public/audio/sfx/` as the single sound effects location (kebab-case convention)

---

## 7. Integration Roadmap (not yet started)

When ready to integrate, the suggested order:

1. **Sound infrastructure** — build `src/lib/sound.ts` + `src/hooks/useSound.ts`, wire up mute toggle
2. **Feed videos** — add `videoUrl` to 2 placeholder feed items, add new luxury watch ad feed item
3. **Tier images** — add `tierImageUrl` to `TIER_VISUALS`, replace badge with hero image in `TierUpgrade.tsx`
4. **Shopper video** — integrate into onboarding/loading flow
5. **Sound triggers** — wire up all 15 sounds to their mapped trigger points
