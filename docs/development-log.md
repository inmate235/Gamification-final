# Development Log — MurkyCorps Mall App

## Milestone 1: Foundation — Scaffold & Design System

### Feature: scaffold-and-design-system

**What was built:**
- Scaffolded Next.js 16.2.9 (App Router, Turbopack dev) with React 19.2, TypeScript 5 strict mode.
- Tailwind CSS 4.3 via `@tailwindcss/postcss` (CSS-first config, no `tailwind.config.js`).
- Mystic Premium design system in `src/app/globals.css`: dark ethereal theme tokens (gold `#d4af37`, amethyst `#9d7fdb`, teal `#4fd1c5`), radial gradient background, SVG film-grain noise overlay, `--ease-premium: cubic-bezier(0.32,0.72,0,1)`, double-bezel card utilities, glass-surface utility, glow utilities, reduced-motion fallback.
- Geist + Geist Mono fonts via `next/font/google`, wired into `--font-geist-sans` / `--font-geist-mono` CSS variables consumed by Tailwind `--font-sans`.
- `cn()` helper in `src/lib/utils.ts` (clsx + tailwind-merge).
- Root layout (`src/app/layout.tsx`) with fonts, metadata, viewport, and `Providers` wrapper (`src/components/providers/Providers.tsx`).
- shadcn/ui (new-york) foundation: `components.json`, `Button` primitive with Mystic Premium variants (gold gradient primary, glass secondary).
- Shared TypeScript types in `src/types/index.ts` covering all 7 Zustand store shapes (player, map, tasks, economy, social, session, ui) per architecture.md.
- Project structure per architecture.md: `src/{app,components/{ui,onboarding,mall,overlays,tasks,social,providers},stores,engine,data,types,lib,hooks}`.
- Vitest 2 + React Testing Library + jsdom configured (`vitest.config.ts`, `src/__tests__/setup.ts`). 9 tests passing (cn utility + Button component).
- Placeholder home page at `/` rendering the Mystic Premium hero (double-bezel card, gold gradient headline, teal status pill).

**Key decisions:**
- `next lint` was removed in Next.js 16; switched the lint command to `npx eslint .` using `eslint-config-next` flat-config exports (`/core-web-vitals`, `/typescript`) imported directly into `eslint.config.mjs`. Updated `services.yaml` accordingly. The original FlatCompat approach hit a circular-structure bug in ESLint 9 + eslint-config-next 16.
- Tailwind 4 `@theme` block used for all design tokens so they generate utility classes (e.g. `bg-accent-gold`, `text-accent-teal`) and CSS variables simultaneously.
- Noise overlay implemented as an inline SVG `feTurbulence` data-URI on `body::before` (fixed, `pointer-events-none`, `opacity: 0.03`) per design-system.md.
- `noUncheckedIndexedAccess` left `false` to avoid friction with the map `fogState` record lookups planned for the next feature.

**Verification:**
- `npx tsc --noEmit` — clean (exit 0).
- `npx eslint .` — clean (exit 0).
- `npx vitest run` — 9/9 passing.
- `npm run dev` — Ready on port 3000; `curl http://localhost:3000` returns 200 with rendered content, Geist font variable classes on `<html>`, and compiled CSS containing all design tokens (gold/amethyst/teal/bg/radial-gradient/noise).
- agent-browser could not launch (environment blocks CDP `Target.createTarget`); fell back to curl-based HTML/CSS verification.

### Feature: game-state-stores

**What was built:**
- All 7 Zustand stores with typed state and actions, plus initial state matching architecture.md:
  - `playerStore` — tokens, tier, tierXP, streak (count/lastVisit/broken/recoveryWindow), bartleType, surveyAnswers, perks, trialPerks. Actions: addTokens, spendTokens (returns success bool, no negative balance), setTier, addTierXP, incrementStreak, breakStreak, activateRecovery, addPerk (routes trial perks to `trialPerks`, earned/gifted to `perks`), removePerk, expireTrialPerks, setBartleType, setSurveyAnswers, reset. Tier multipliers exported (Bronze 1x, Silver 1.5x, Gold 2x, Neodymium 3x) plus `applyTierMultiplier` helper.
  - `mapStore` — zones, stores, fogState, playerPosition, explorationPercent. Actions: moveToZone (adjacency-enforced, no-op on current zone), revealZone (memory-based), updatePlayerPosition, setExplorationPercent, getVisibleStores, getZone, isAdjacent, reset. Exports the non-linear `calculateExploration` curve (first 50% of zones -> 0-40%, second 50% -> 40-50%, capped at 99% on full reveal to preserve perpetual-near-completion).
  - `taskStore` — activeTasks (never empty), completedTasks, taskChain. Actions: completeTask (auto-generates next task, rejects time-gated completions before gate elapses), generateNextTask, getTimeGatedTasks, escalateTaskDifficulty, addTask, seedInitialTasks, reset. Task templates cover all 3 types (explore-zone, find-token, visit-stores) with chain escalation (reward + chainLevel, difficulty + floor(chainLevel/2)).
  - `economyStore` — flashSales, spinningWheel, rewardDensity, deficitMultiplier. Actions: triggerFlashSale, removeFlashSale, makeWheelAvailable, spinWheel (cooldown-enforced), updateRewardDensity (hook->chase at 15 min), calculateDeficitPrice (balance + 2..3), setDeficitMultiplier, reset. Exports `calculateDeficitPrice` pure function and `WHEEL_COOLDOWN_MS` (3 min).
  - `socialStore` — phantoms, leaderboard, proximityAlerts. Actions: movePhantoms, updateLeaderboard (includes player entry, contiguous 1-indexed ranks, sorted by tokenCount desc), triggerProximityAlert (correct pluralization), generatePhantomActivity, dismissProximityAlert, reset.
  - `sessionStore` — sessionStart, sessionMinutes, exitAttempts, exitFrictionLayer, eventQueue. Actions: startSession, tick (updates sessionMinutes from elapsed), registerExitAttempt (caps at 3, layer mirrors attempts), resetExitAttempts, scheduleEvent, processEvents (returns due events, marks processed), clearProcessedEvents, reset.
  - `uiStore` — activeOverlay, overlayData, bottomPanelExpanded. Actions: showOverlay, hideOverlay, toggleBottomPanel, setBottomPanelExpanded, reset.
- Static data files:
  - `src/data/mallData.ts` — 5 zones (Entrance, East Wing, West Wing, Central Plaza, Food Court) with SVG polygon points, centers, and the exact adjacency graph (Z1<->Z2, Z1<->Z3, Z2<->Z4, Z3<->Z4, Z4<->Z5). 10 stores distributed per spec (Z1:2, Z2:3, Z3:2, Z4:0, Z5:3) with category, position, icon, amplified visitor counts, and deal info. Helpers: getZoneById, getStoreById, areZonesAdjacent, storesByZone.
  - `src/data/reviewData.ts` — deterministic fake 5-star reviews (mulberry32 PRNG seeded by store id) with 85% 5-star / 15% 4-star distribution, author names, avatar seeds, dates, category-appropriate text. No "sponsored"/"ad" disclosure labels.
  - `src/data/phantomData.ts` — 8 phantom personas with names, tiers, token counts, zone positions, actions. Initial leaderboard with contiguous 1-indexed ranks. Helpers: getPhantomById, phantomJustAbove, samplePhantomAction.
- `src/engine/EventScheduler.ts` — singleton game loop on a 1-second `setInterval` tick. Each tick: updates sessionMinutes, checks reward density hook->chase shift (fires `onRewardDensityShift`), recalculates deficit pricing, re-enables spinning wheel after cooldown (fires `onWheelAvailable`), moves phantoms every 5th tick, updates leaderboard every 10th tick, expires trial perks, and processes the scheduled event queue (fires `onProcessEvent` per due event). Exposes `getEventScheduler()` singleton accessor and `resetEventSchedulerSingleton()` for tests. `tick()` is public so tests can drive the loop deterministically without real timers.

**Key decisions:**
- `addPerk` routes by `perk.type`: trial perks go to `trialPerks` (so `expireTrialPerks` can filter them), earned/gifted go to `perks`. This matches the architecture's separation of active vs. endowment-effect perks.
- `calculateExploration` caps at 99% on full reveal to preserve the perpetual-near-completion hook (Section 4.5.4 phantom progress). The non-linear curve is exported and unit-tested against the documented values (1/5->16%, 2/5->32%, 3/5->42%, 5/5->99%).
- `spendTokens` returns a boolean and no-ops on insufficient balance rather than throwing, so callers can branch on success without try/catch. Balance is clamped at 0.
- `completeTask` returns the completed `Task` (or null for unknown id / time-gate not elapsed) so callers can credit the reward and trigger celebrations from a single call.
- EventScheduler reads `sessionMinutes` *after* calling `session.tick()` (not from a stale snapshot captured before the tick) so reward-density shifts fire on the correct tick.
- Review disclosure test uses a word-boundary regex (`/\bad\b/`) rather than substring matching, so legitimate words like "advertised" don't false-positive.

**Verification:**
- `npx tsc --noEmit` — clean (exit 0).
- `npx eslint .` — clean (exit 0).
- `npx vitest run` — 123/123 passing across 12 test files (playerStore 18, mapStore 15, taskStore 11, economyStore 11, socialStore 9, sessionStore 10, uiStore 6, mallData 15, phantomData 7, EventScheduler 12, utils 5, button 4).
