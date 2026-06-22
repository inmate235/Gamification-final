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

### Feature: onboarding-invite-and-survey

**What was built:**
- Invite entry screen at `/` (`src/components/onboarding/InviteScreen.tsx`):
  - Invite code input with format validation (`XXXX-XXXX-XXX` pattern). Empty submission blocked with inline error. Invalid code shows error state. Error clears on retype.
  - "You've Been Chosen" welcome animation with 32-particle ParticleField (`src/components/onboarding/ParticleField.tsx`), pulsing gold glow ring, staggered text reveal, and "Tap to continue" hint. Uses Framer Motion AnimatePresence for phase transitions.
  - Social proof display ("Invited by Sarah, Gold member") on both the input card and the welcome animation.
  - Exclusivity/scarcity messaging ("Invite Only · Members Exclusive", "1,247 members · Limited spots remaining").
  - ENTER MALL button with button-in-button trailing arrow icon (Mystic Premium pattern).
  - Enter key submission supported. Idempotent rapid double-submission guard.
  - Auto-advances to `/survey` after 3.2s welcome animation (or tap to skip).
- Survey screen at `/survey` (`src/components/onboarding/SurveyScreen.tsx`):
  - 3 questions: (1) style preference with 4 image-card options (gradient backgrounds + Phosphor icons), (2) social vs solo shopping (2 options), (3) deals vs discovery motivation (2 options).
  - Auto-advance on selection (650ms delay for visual feedback before advancing). No explicit "Next" button.
  - Visual selection feedback: gold ring + glow on selected option, animated check badge (spring animation).
  - Progress dots (3 dots, current dot elongated with gold glow).
  - Question transitions via Framer Motion AnimatePresence (slide + blur).
  - No skip button — single forward flow.
  - Idempotent rapid double-click guard.
- Bartle type classification (`src/lib/bartle.ts`):
  - Scoring system: each answer option contributes points to Bartle types (achiever, explorer, socializer, killer). Highest score wins, ties broken deterministically (achiever > explorer > socializer > killer).
  - Classification is covert — never displayed to the user (verified by test: DOM text scan for type names returns no matches).
  - All 4 types are reachable through different answer combinations (verified by test).
  - Answers stored in `playerStore.surveyAnswers` as `Record<string, string>`. Bartle type stored in `playerStore.bartleType`.
- Defensive mall stub at `/mall` (`src/app/mall/page.tsx`):
  - Redirects to `/` if no survey answers (onboarding not completed). Shows "Redirecting to invite entry…" during redirect.
  - Shows "Welcome to the Mall" placeholder with onboarding completion confirmation when survey answers exist.
  - Bartle type is intentionally NOT displayed (covert classification per Section 6A).
- Route wiring: `/` -> InviteScreen, `/survey` -> SurveyScreen, `/mall` -> MallPage stub.

**Key decisions:**
- Bartle scoring maps style preference to killer (bold), achiever (classic), explorer (trendy), socializer (cozy). Social question adds socializer/killer for friends, achiever/explorer for solo. Motivation question adds achiever/killer for deals, explorer/socializer for discovery. This ensures all 4 types are reachable.
- Valid invite code format is ` /^[A-Z]{5}-\d{4}-[A-Z]{3}$/` — a mocked format that any matching code accepts (no backend to validate against).
- ParticleField generates particles in `useEffect` (not `useMemo`) to satisfy React's purity rules (Math.random is impure during render). The `set-state-in-effect` lint rule is disabled for this one-time decorative initialization.
- Mall page defensive guard uses `useEffect` for the `router.replace("/")` call (external system sync) and derives the redirecting state from `surveyAnswers` directly (no separate `redirecting` state to avoid `set-state-in-effect` lint violation).
- Framer Motion mock in tests uses `vi.mock` with a lazy-evaluated factory (not `vi.hoisted`) because the factory needs `React` which isn't available at hoisting time. The factory creates `forwardRef` components that strip motion props and render plain DOM elements.

**Verification:**
- `npx tsc --noEmit` — clean (exit 0).
- `npx eslint .` — clean (exit 0).
- `npx vitest run` — 158/158 passing across 15 test files (35 new: bartle 13, InviteScreen 10, SurveyScreen 12).
- `curl http://localhost:3000` — invite page renders with "ENTER MALL", "Invite Only", "Invited by Sarah, Gold member", invite code input, double-bezel card, gold accents.
- `curl http://localhost:3000/survey` — survey renders with "Style Profile", "Which style speaks to you?", 4 style options, 3 progress dots, "Question 1 of 3".
- `curl http://localhost:3000/mall` — shows "Redirecting" (defensive guard works without survey answers).
- Design system tokens verified in compiled HTML: `#0a0a0f` background, `#d4af37` gold, `bezel-card`, `glow-gold`, `cubic-bezier(0.32,0.72,0,1)`, `ring-white/10`.
- agent-browser could not launch (CDP `Target.createTarget` blocked); fell back to curl-based verification.

### Feature: fix-spendtokens-negative

**What was built:**
- Fixed blocking scrutiny-review issue in `playerStore.spendTokens`: the action previously accepted negative amounts, which bypassed the `state.tokens < amount` insufficient-balance guard (e.g. `0 < -5` is false) and then computed `tokens - Math.round(-5)`, effectively *adding* tokens.
- Added input validation at the top of `spendTokens`: if `amount` is not an integer or is `<= 0`, the action returns `false` immediately without mutating state. The deduction path now uses `amount` directly (already validated as a positive integer) instead of re-rounding.
- Added 3 new test cases in `src/stores/__tests__/playerStore.test.ts`: rejects negative amounts (returns false, balance unchanged), rejects zero amounts, and rejects non-integer amounts (e.g. 3.5).

**Key decisions:**
- Chose to `return false` (rather than throw) for invalid input to match the existing `spendTokens` contract which already returns `false` for insufficient funds. This keeps callers' error handling uniform.
- Validated with `Number.isInteger(amount)` to also reject `NaN`, `Infinity`, and fractional values in a single check, since `Number.isInteger` returns false for all of those.
- Removed the now-redundant `Math.round(amount)` in the deduction path since `amount` is guaranteed to be an integer after validation.

**Verification:**
- `npx tsc --noEmit` — clean (exit 0).
- `npx eslint .` — clean (exit 0).
- `npx vitest run` — 161/161 passing across 15 test files (3 new: negative rejection, zero rejection, non-integer rejection).
