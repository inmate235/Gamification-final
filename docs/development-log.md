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
- The deprecated Next.js lint CLI was removed in Next.js 16; the lint script now runs `npx eslint .` using `eslint-config-next` flat-config exports (`/core-web-vitals`, `/typescript`) imported directly into `eslint.config.mjs`. Updated `services.yaml` accordingly. The original FlatCompat approach hit a circular-structure bug in ESLint 9 + eslint-config-next 16.
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

## Milestone 2: Mall World (map/fog)

### Feature: mall-map-and-navigation

**What was built:**
- Full `/mall` experience replacing the defensive stub: SVG-based 2D floor plan, fog-of-war, click-to-move navigation, store detail overlay, status bar, and bottom task panel.
- `MallExperience` (`src/components/mall/MallExperience.tsx`) composes the persistent chrome (`StatusBar` top, `TaskPanel` bottom) with the `MallMap` and the overlay system (`StoreDetail`, `Celebration`). Starts/stops the `EventScheduler` game loop on mount/unmount.
- `MallMap` (`src/components/mall/MallMap.tsx`): inline `<svg viewBox="0 0 1000 1200">` rendering the 5 zones as `<polygon>` elements in the documented spatial arrangement (Entrance bottom, East Wing right, West Wing left, Central Plaza center-upper, Food Court top). Dashed corridor `<line>`s connect adjacent zones. Radial gradient atmosphere, edge-glow SVG filter on revealed zone borders, and a per-zone reachability hint (pulsing gold overlay on adjacent moveable zones). Click-to-move handler enforces adjacency, blocks movement while the store-detail overlay is open, awards exploration tokens on first reveal, and triggers the first-token celebration on the initial move from the entrance.
- `PlayerAvatar` (`src/components/mall/PlayerAvatar.tsx`): pulsing gold dot with a multi-ring glow (pulsing outer ring + mid glow + core + inner highlight). Animates along the corridor path (from-center → corridor midpoint → to-center) using Framer Motion keyframes with `cubic-bezier(0.32,0.72,0,1)`, not a straight diagonal. Visually distinct from store markers.
- `FogOverlay` + `FogFilterDefs` (`src/components/mall/FogOverlay.tsx`): unexplored zones covered with a dark mist `<feTurbulence>` + `<feDisplacementMap>` SVG filter over a radial dark gradient, plus an extra darkening veil. `pointerEvents="none"` so clicks pass through to adjacent reachable zones. Fades out with the premium easing on reveal.
- `ZoneLabel` (`src/components/mall/ZoneLabel.tsx`): canonical zone names shown ONLY on revealed zones (hidden while fogged).
- `StoreMarker` (`src/components/mall/StoreMarker.tsx`): category-colored rounded-rect pins with a distinct Phosphor icon per category (fashion/tech/lifestyle/food/accessories). Rendered only within revealed zones. Tapping opens the store detail overlay.
- `StatusBar` (`src/components/mall/StatusBar.tsx`): fixed top double-bezel glass pill showing token count (gold), tier badge (tier-colored with tier glow), streak counter (amethyst flame), and the non-linear exploration progress bar (teal gradient with glow). All values read reactively from `playerStore` / `mapStore`.
- `TaskPanel` (`src/components/tasks/TaskPanel.tsx`): fixed bottom double-bezel panel, present and expandable/collapsible via `uiStore.toggleBottomPanel`. Placeholder content for the breadcrumb task system (built in a subsequent feature).
- `StoreDetail` overlay (`src/components/overlays/StoreDetail.tsx`): glass overlay showing store name, category, amplified visitor count framed as "Shoppers now browsing", current deal info, and fake 5-star reviews (all ratings 4-5, author/avatar/date/text, NO disclosure labels). Dismissable via backdrop click, X button, or Escape. Aggregate star rating displayed.
- `Celebration` overlay (`src/components/overlays/Celebration.tsx`): transient token-earned celebration with a particle burst and gold coin, auto-dismisses after 1.8s. Does not block map interaction.
- `getCorridorPath` helper + reward constants (`EXPLORE_REWARD`, `FIRST_TOKEN_BONUS`, `FOOD_COURT_SECRET_REWARD`) added to `src/data/mallData.ts`.
- `/mall` page updated to render `MallExperience` (wrapped in the existing `OnboardingGuard`).

**Key decisions:**
- The fog overlay is rendered above zones/stores/labels but with `pointerEvents="none"` so it visually obscures unexplored content without blocking clicks on adjacent reachable zones (per VAL-MAP-026).
- Player avatar corridor animation uses Framer Motion keyframes derived from `getCorridorPath` (3 points: from-center, midpoint, to-center) with `times: [0, 0.5, 1]` so the avatar visibly follows the corridor rather than teleporting. The path is stored in state updated via `useEffect` (reading the previous zone from a ref) to comply with the React hooks lint rules (no setState in useMemo, no ref access during render).
- Token rewards on zone reveal use the existing `applyTierMultiplier` so tier multipliers apply to exploration rewards. The first move from the entrance adds the `FIRST_TOKEN_BONUS` and shows a "+1 Token!" celebration (per Day 1 minute 2:00). The Food Court first reveal grants the large `FOOD_COURT_SECRET_REWARD` with a "Secret Token!" message.
- The module-level `firstMoveDone` flag is session-only (intentionally not persisted) and reset between tests via `__resetFirstMoveFlag`.
- CDP `Target.createTarget` is blocked in this environment (per AGENTS.md), so manual verification used curl: root route returns the invite screen with mystic-premium tokens, `/mall` returns 200 with the defensive guard placeholder (server-side onboarding step defaults to 'invite'), dev log shows no compile/render errors.

**Verification:**
- `npx tsc --noEmit` — clean (exit 0).
- `npx eslint .` — clean (exit 0).
- `npx vitest run` — 211/211 passing across 24 test files (50 new tests: corridor helpers, MallMap SVG/fog/markers/navigation/celebration, StatusBar, TaskPanel, StoreDetail reviews/visitor-count/dismissal, Celebration auto-dismiss; mall-route-guard test updated for the new full-experience render).
- `npm run dev` — Ready on port 3000; `curl http://localhost:3000` returns 200 with invite screen markers and compiled CSS containing gold `#d4af37`, background `#0a0a0f`, and `cubic-bezier(0.32,...)` tokens; `curl http://localhost:3000/mall` returns 200; dev log clean of errors.


## Milestone 3: Economy & Engagement — Token Economy

### Feature: token-economy

**What was built:**

The full token economy system: earning, spending, the deficit engine, tier multipliers, real-time status-bar feedback, and the non-negative integer invariant. The exploration earning + secret-token + first-token logic was already present from the mall-map feature; this feature added the spending paths, the deficit-engine wiring, the tier-multiplied earning helper, and the spend visual feedback.

- `playerStore.awardTokens(baseReward)` (`src/stores/playerStore.ts`): the canonical earning path. Applies the current tier's earn-rate multiplier (Bronze 1x, Silver 1.5x, Gold 2x, Neodymium 3x) via `applyTierMultiplier`, rounds to a non-negative integer, and returns the exact credited amount so callers can show an accurate "+N". `addTokens` (raw, no multiplier) and `spendTokens` (rejects non-positive/non-integer, enforces non-negative) remain. `MallMap` was refactored to use `awardTokens` for exploration + secret-token rewards.
- `economyStore` extensions (`src/stores/economyStore.ts`):
  - `shortcuts: Shortcut[]` + `liveDeficitPrice: number` state. Three shortcuts (`src/data/shortcutData.ts`: Aurora Passage, Neon Tunnel, Silk Corridor) open faster routes between zones. The active (first locked) shortcut's `tokenCost` is FROZEN at the deficit price (balance + 2..3) when it becomes the active offer; the next shortcut is re-frozen at the new deficit price after each unlock (so the following offer is always 2-3 above the new balance).
  - `unlockShortcut(id)`: deducts the frozen cost when affordable, marks the route unlocked, re-freezes the next offer. `claimFlashSale(saleId)`: deducts the frozen deficit `tokenCost` and closes the sale. `triggerDeficitFlashSale(storeId?)`: creates a minimal deficit-priced sale (foundation for the flash-sales feature). `refreshLiveDeficitPrice()`: recomputes the live teaser price (balance + 2..3).
  - `getActiveShortcut()` / `getUnlockedEdges()` selectors.
- `mapStore` adjacency (`src/stores/mapStore.ts`): `isAdjacent` now also honors unlocked shortcut edges (consulting `economyStore.getUnlockedEdges()`), and `moveToZone` uses `isAdjacent` so unlocked shortcuts enable direct travel + fog reveal.
- `engine/tokenEconomy.ts`: central orchestration. `awardTaskReward(task)` and `awardWheelReward(baseTokens)` credit tier-multiplied tokens + earn celebrations (used by the breadcrumb-tasks and spinning-wheel features). `unlockShortcut` / `claimFlashSale` wrap the store actions + fire spend feedback. `showTokenFeedback(kind, amount, message)` drives the overlay. All sources/sinks flow through the single `playerStore.tokens` (VAL-TOKEN-019).
- `Celebration` overlay generalized (`src/components/overlays/Celebration.tsx`): now supports `kind: 'earn' | 'spend'`. Earn = gold coin, +N, upward burst, gold particles. Spend = red minus, -N, downward fall, red particles. Visually distinct (VAL-TOKEN-017).
- `ShortcutUnlock` overlay + `ShortcutEntryButton` (`src/components/overlays/ShortcutUnlock.tsx`): a floating amethyst entry button always shows the live deficit teaser price (the persistent "always short" spend opportunity). The glass overlay shows the active buyable shortcut at its frozen cost (Unlock enabled when affordable), a "next up" live-deficit teaser (always unaffordable), and the unlocked-routes list. Maybe Later / backdrop / Escape dismiss.
- `FlashSale` overlay + `FlashSaleEntryButton` (`src/components/overlays/FlashSale.tsx`): a minimal flash-sale spending path (foundation for the flash-sales feature). "Deal Radar" button triggers a deficit-priced sale; the overlay shows store name, discount, item, ticking countdown (self-contained keyed `Countdown` child), social proof, frozen token cost, Grab Deal (calls `claimFlashSale`), and Maybe Later.
- `EventScheduler` tick now calls `economy.refreshLiveDeficitPrice()` each second so the persistent teaser recalculates with the balance (VAL-TOKEN-018).
- `StatusBar` token count now pulses (scale + color flash, keyed remount) on every change, green-gold for earn / red for spend, reinforcing real-time updates (VAL-TOKEN-002/003).
- `types/index.ts`: added `Shortcut`, `TokenFeedbackKind`, `CelebrationData`, extended `FlashSale` with optional item/social-proof/claimed fields, extended `EconomyState` with `shortcuts` + `liveDeficitPrice`, and added `shortcut-unlock` / `flash-sale` to `OverlayType`.

**Key decisions:**
- Deficit-engine spending model: spend offers (shortcuts, flash sales) carry a tokenCost FROZEN at the deficit price (balance + 2..3) the moment the offer becomes active, so the user is always 2-3 tokens short at offer time and must earn a couple more to afford it (VAL-TOKEN-010/011). A separate live `liveDeficitPrice` (recalculated every scheduler tick) is shown persistently on the entry button and the "next up" card so there is always an unaffordable spend opportunity visible (VAL-TOKEN-011/018). After a purchase the next offer is re-frozen at the new deficit price (VAL-TOKEN-018).
- Shortcut adjacency lives in `economyStore` (token spending) but is consulted by `mapStore.isAdjacent` so unlocked shortcuts enable direct map travel — no circular dependency (economyStore → playerStore only).
- `awardTokens` centralizes tier-multiplied earning so task/wheel rewards (provided here as infrastructure for later features) and exploration rewards all apply the multiplier consistently (VAL-TOKEN-012..015).
- The `FlashSale` overlay is intentionally minimal and documented as a foundation; the dedicated flash-sales feature layers proximity triggering, synthetic timers, personalization, and refractory periods on top of the canonical `claimFlashSale` spending action.
- CDP `Target.createTarget` is blocked in this environment, so manual verification used the production build (`npm run build` compiles all routes including `/mall` with the new components, TypeScript clean), curl (`/` → 200, `/mall` → 200 guarded), and grep of compiled chunks confirming the new testids/components are bundled.

**Verification:**
- `npx tsc --noEmit` — clean (exit 0).
- `npx eslint .` — 0 errors (1 import/no-anonymous-default-export warning fixed).
- `npx vitest run` — 253/253 passing across 28 test files (44 new tests: playerStore.awardTokens tier multipliers, economyStore shortcuts/deficit/flash-sale spending, mapStore shortcut adjacency, engine tokenEconomy earn/spend/tier/feedback, Celebration earn-vs-spend, ShortcutUnlock overlay, FlashSale overlay; mall-route-guard icon mock updated for new Phosphor icons).
- `npm run build` — Compiled successfully; all routes prerendered.
- `npm run dev` — Ready on port 3000; `curl http://localhost:3000` → 200; new component testids present in client chunks.

## Milestone 3: Economy & Engagement — Breadcrumb Task System

### Feature: breadcrumb-tasks

**What was built:**
- `src/engine/taskGenerator.ts` — canonical breadcrumb task auto-generation. Pure `generateTask()` produces tasks that reference REAL map locations: every task carries a `targetZone` (a real zone id from mallData), and `visit-stores` tasks carry `targetStores` (real store ids within that zone). Four weighted templates cover all three task types (explore-zone, find-token, visit-stores) plus a premium Food Court secret-token variant. Chain escalation: `reward = baseReward + chainLevel`, `difficulty = base + floor(chainLevel/2)`. Time-gating: ~30% of tasks after chain level 0 carry a 15-minute `gateUntil`. Best-effort avoidance of regenerating the just-completed task's exact type+zone (VAL-TASK-019). `generateInitialTasks()` seeds 2-3 varied, never-gated tasks at chain level 0 so the panel is never empty on first load.
- `src/engine/taskEngine.ts` — orchestrates completion by the CORRECT action only (VAL-TASK-018): `onPlayerEnterZone` completes explore-zone tasks whose targetZone matches; `onZoneRevealed` completes find-token tasks whose targetZone matches (token found on first fog clear); `onStoreVisited` records the visit in mapStore and completes visit-stores tasks once all target stores are visited. Each completion calls `taskStore.completeTask` (auto-generates a new escalated task — VAL-TASK-002/008/009) then `awardTaskReward` (tier-multiplied reward + celebration — VAL-TASK-014/015/021). Time-gated tasks are rejected before the gate elapses (VAL-TASK-010).
- `src/stores/taskStore.ts` — refactored to delegate generation to `taskGenerator`; `generateNextTask` reads current revealed zones (so find-token targets stay solvable) and avoids the last completed task; `reset` re-seeds and resets the id counter.
- `src/stores/mapStore.ts` + `src/types/index.ts` — added `visitedStores: string[]` and a `visitStore(storeId)` action to track which stores the player has opened (for visit-stores tasks).
- `src/components/tasks/TaskPanel.tsx` — full rewrite replacing the placeholder. Double-bezel expandable/collapsible bottom panel (toggle via `uiStore.toggleBottomPanel`). Renders the active task list (2-4 at once) as cards, each showing a type-colored icon (Compass/teal, Coin/gold, Storefront/amethyst), the human-readable description referencing a real zone, the token reward (+N, gold), and a live 15-min countdown for time-gated tasks (VAL-TASK-011). Task count badge in the handle. Framer Motion layout animations with `cubic-bezier(0.32,0.72,0,1)`.
- `src/components/mall/MallMap.tsx` — wired the task engine into navigation: on zone entry `onPlayerEnterZone` runs (explore-zone), on first fog reveal `onZoneRevealed` runs (find-token), on store-marker click `onStoreVisited` runs (visit-stores). Task-completion celebrations are sequenced 700ms after the exploration celebration so both feedbacks are visible.

**Key decisions:**
- Task completion is driven by real player actions (zone entry, fog reveal, store open), not arbitrary clicks — satisfying VAL-TASK-018. `find-token` completes on first reveal (token found there) while `explore-zone` completes on any entry, giving a real behavioral distinction.
- Generation prefers unrevealed zones for `find-token` so the task is always solvable (the token is found on first reveal).
- The `awardTaskReward` path applies the tier multiplier (1x/1.5x/2x/3x) and shows the earn celebration, reusing the existing token-economy single-balance flow (VAL-TOKEN-019).

**Verification:**
- `npx tsc --noEmit` — clean (exit 0).
- `npx eslint .` — 0 errors.
- `npx vitest run` — 280/280 passing across 30 test files (30 new tests: taskGenerator target/reward/chain/time-gate/avoid, taskEngine completion-by-correct-action/tier-multiplier/time-gate/never-empty, TaskPanel cards/reward/expand-collapse/countdown, updated taskStore targetZone assertions).
- `npm run dev` — Ready on port 3000; `curl /` and `curl /mall` → 200; no compile errors in dev log; design tokens (gold/amethyst/teal/bezel-card) present in compiled CSS.
- agent-browser CDP `Target.createTarget` is blocked in this environment (per AGENTS.md); fell back to curl-based verification plus the React Testing Library component tests which render TaskPanel with real task data and assert description, reward, count, expand/collapse, and time-gate countdown rendering.

### Feature: flash-sales

**What was built:**
- `src/engine/flashSaleEngine.ts` — the flash sale orchestrator implementing the proximity-triggered, synthetic-timer, personalized dark-pattern sale system:
  - **Proximity triggering**: `proximityCandidateStores` gathers stores in the player's current zone plus adjacent *revealed* zones; `selectProximityStore` picks one near the player (VAL-SALE-001, -017).
  - **Personalization**: `getPreferredCategory` maps the survey `style` answer to a store category (bold→tech, classic→fashion, trendy→accessories, cozy→food); the selected store prefers the user's category (VAL-SALE-009). `buildAndPushSale` sets `personalized=true` when matched and layers a category-flavored item description.
  - **Synthetic timers**: sales carry `syntheticTickMs` (1400ms, slower than a real second) so the countdown does not run 1:1 with wall-clock (VAL-SALE-006).
  - **Deficit-engineered cost**: `calculateDeficitPrice` (balance + 2..3) is frozen per sale so the deal is always just out of reach (VAL-SALE-008).
  - **Social proof**: amplified `socialProof` number 12–71 with "people viewing this deal" label (VAL-SALE-010).
  - **Refractory period**: a module-level registry (`markRefractory`/`isRefractory`) blocks a dismissed/claimed store from re-triggering for 45s (VAL-SALE-019).
  - **Probability increases with time-in-mall**: `saleProbabilityForSession` rises linearly from 0.06 at minute 0 to a 0.22 cap (VAL-SALE-014). `triggerProximityFlashSale` rolls this chance each check.
  - **Dismiss / expire**: `dismissFlashSale` (Maybe Later) removes the sale + refractories the store without charging; `expireFlashSale` removes the sale on natural timer expiry with no charge (VAL-SALE-012, -020).
- `src/types/index.ts` — added `FlashSale.syntheticTickMs` for the synthetic countdown.
- `src/engine/EventScheduler.ts` — the 1s game loop now runs a proximity flash-sale check every 2nd tick. When a sale triggers and no overlay is open, it surfaces the flash-sale overlay directly (VAL-SALE-018); otherwise the sale stays pending and the Deal Radar button surfaces it. Added `onFlashSaleTriggered` handler and `resetFlashSaleEngine` on teardown.
- `src/components/overlays/FlashSale.tsx` — reworked overlay:
  - Shows store name + category, discount, item description, synthetic countdown, token cost, and social proof.
  - Countdown uses `sale.syntheticTickMs` and pauses while the claimed state shows.
  - "Maybe Later" / X / Escape / backdrop dismiss via `dismissFlashSale` (no charge + refractory).
  - "Grab Deal" deducts tokens via `claimFlashSale` and shows an inline "Deal Claimed!" state before the spend celebration takes over (VAL-SALE-015).
  - `FlashSaleEntryButton` is now proximity-driven: it surfaces *pending* sales (with a count badge) rather than manually spawning random sales.
- `src/engine/tokenEconomy.ts` — `claimFlashSale` now marks the claimed store refractory and shows a "Deal Claimed! -N Tokens" spend confirmation.

**Key decisions:**
- Refractory state lives in the engine module (session-only) rather than bloating `economyStore`; it is exposed via accessors and reset on scheduler teardown / tests.
- Personalization reuses the existing survey `style` question (no new survey field needed); the four aesthetics map deterministically to the five store categories.
- The synthetic timer is implemented as a slower tick interval rather than a wall-clock-inaccurate label, which both satisfies the "may not reflect real duration" requirement and keeps the countdown visually decrementing.
- Browser automation remained blocked (CDP `Target.createTarget`), so verification used the curl fallback: `/` and `/mall` return 200 with no compile/runtime errors in the dev log, plus the full unit/component suite.

**Verification:**
- `npx tsc --noEmit` — clean (exit 0).
- `npx eslint .` — clean (exit 0).
- `npx vitest run` — 337/337 passing (19 new flashSaleEngine tests, 9 FlashSale overlay tests, 12 EventScheduler tests, plus all prior suites).
- `npm run dev` — Ready on port 3000; `curl /` and `curl /mall` return 200; dev log clean of errors/warnings.

### Feature: fix-flash-sale-timer

**What was built:**
- Fixed blocking scrutiny issue: hidden pending flash sales now age out in background. Previously the countdown was driven solely by the overlay's React `Countdown` component (only mounted when the sale overlay was open), so sales that triggered while another overlay was open never expired.
  - Added `tickFlashSaleTimers()` to `flashSaleEngine.ts`: computes remaining seconds for ALL active sales from `createdAt` + `syntheticTickMs` + `initialCountdownSeconds`, updates `countdownSeconds` in the store, and expires sales at zero — regardless of overlay state.
  - Added `initialCountdownSeconds` field to the `FlashSale` type, frozen at creation in `economyStore.triggerFlashSale`.
  - Added `updateFlashSaleCountdowns` batch action to `economyStore` for efficient store updates.
  - Wired `tickFlashSaleTimers()` into `EventScheduler.tick()` as step 6 (before the proximity trigger).
  - Fixed `expireFlashSale()` to only hide the overlay when the expired sale is the one currently shown (previously it always hid the overlay, which would dismiss a different sale's overlay when a hidden sale expired).
  - Simplified the `Countdown` component in `FlashSale.tsx` to a pure display reading the live store value (no local interval); the scheduler is now the single source of truth for countdown progression.
- Fixed non-blocking issue: inline "Deal Claimed!" state was preempted by the immediate celebration overlay switch. The celebration is now delayed ~1s so the claimed confirmation is visible before transitioning.
  - Added `showFeedback` option to `tokenEconomy.claimFlashSale()` (defaults to true for backward compat).
  - `FlashSale.tsx` `onGrab` now calls `claimFlashSale(id, { showFeedback: false })`, shows the claimed state, then after 1000ms calls `showTokenFeedback("spend", ...)` to transition to the celebration overlay.

**Key decisions:**
- The background timer uses deterministic elapsed-time computation (`floor((now - createdAt) / syntheticTickMs)`) rather than per-tick decrementing, making it resilient to skipped/duplicate ticks and matching the synthetic timer rate.
- The `Countdown` component was simplified to a pure display + expiry safety net (the scheduler handles all ticking), eliminating the dual-timer inconsistency between the overlay's local state and the store.

**Verification:**
- `npx tsc --noEmit` — clean (exit 0).
- `npx eslint .` — clean (exit 0).
- `npx vitest run` — 356/356 passing (7 new background timer expiry tests in flashSaleEngine, 1 EventScheduler background expiry test, updated FlashSale grab test for delayed celebration, plus all prior suites).
