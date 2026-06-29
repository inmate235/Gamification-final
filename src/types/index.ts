/**
 * Shared TypeScript types for the MurkyCorps Mall App.
 * All game-state types live here per architecture.md.
 */

/* ============================================================================
   Player
   ========================================================================== */

export type Tier = "bronze" | "silver" | "gold" | "neodymium";
export type BartleType = "achiever" | "explorer" | "socializer" | "killer";

export interface Perk {
  id: string;
  name: string;
  description: string;
  type: "trial" | "gifted" | "earned";
  expiresAt?: number; // epoch ms; undefined = permanent
  source?: string; // phantom name for gifted perks
}

export interface ComebackBonus {
  /** True while the 2x token multiplier is active (VAL-STREAK-012). */
  active: boolean;
  /** Epoch ms when the 30-minute comeback bonus expires. */
  expiresAt: number;
}

/**
 * Rescue bargain 2x token boost granted by accepting the Layer 3 exit-friction
 * rescue bargain (VAL-EXIT-016, VAL-EXIT-027). Active for the 5-minute stay
 * window promised by the bargain. Independent of the streak comeback bonus so
 * the two do not stack multiplicatively (awardTokens takes the max).
 */
export interface RescueBoost {
  active: boolean;
  /** Epoch ms when the 5-minute 2x rescue boost expires. */
  expiresAt: number;
}

export interface StreakState {
  count: number;
  lastVisit: number; // epoch ms
  broken: boolean;
  recoveryWindow: boolean;
  /**
   * Number of consecutive days missed since the streak broke. Used by the
   * tier-demotion escalation: at Day 3 the player's tier is demoted by one
   * level (VAL-TIER-021, VAL-TIER-022).
   */
  missedDays: number;
  /**
   * Epoch ms when the 48-hour recovery window started (VAL-STREAK-010,
   * VAL-STREAK-011, VAL-STREAK-017). 0 when no recovery window is active.
   */
  recoveryWindowStart: number;
  /**
   * The streak count at the moment the streak broke, used for partial
   * restoration during recovery (VAL-STREAK-013: lose 2 days instead of all).
   * 0 when no break has occurred.
   */
  preBreakCount: number;
  /**
   * Comeback bonus state — 2x tokens for 30 min when the user returns within
   * the recovery window (VAL-STREAK-012). Null when no comeback bonus has
   * been granted.
   */
  comebackBonus: ComebackBonus | null;
  /**
   * Streak protection flag set by accepting the Layer 3 rescue bargain
   * (VAL-EXIT-015, VAL-EXIT-028). While true, the streak will not be marked
   * broken for that session even if the user leaves without a next-day visit.
   */
  streakProtected: boolean;
}

/**
 * A snapshot of the most recent streak-miss penalty applied by the engine
 * (VAL-STREAK-005..008). Stored on the player store so the
 * StreakPenaltyNotification component can display the ACTUAL capped token
 * loss rather than a recomputed estimate (the Day-1 penalty is capped at the
 * player's current balance, so the notification must never overstate the
 * real deduction). Null when no penalty has been applied yet.
 */
export interface StreakPenaltySnapshot {
  type: "token-loss" | "perk-loss" | "tier-demotion";
  missedDay: number;
  message: string;
  /** Actual tokens lost (token-loss only), capped at the current balance. */
  tokensLost?: number;
  /** Name of the perk lost (perk-loss only). */
  perkLostName?: string;
  /** Previous tier (tier-demotion only). */
  previousTier?: Tier;
  /** New tier after demotion (tier-demotion only). */
  newTier?: Tier;
}

export interface PlayerState {
  tokens: number;
  tier: Tier;
  tierXP: number;
  streak: StreakState;
  bartleType: BartleType | null;
  surveyAnswers: Record<string, string>;
  perks: Perk[];
  trialPerks: Perk[];
  /**
   * Rescue bargain 2x token boost (VAL-EXIT-016, VAL-EXIT-027). Null when no
   * rescue boost is active. Awarded by accepting the Layer 3 exit-friction
   * bargain; active for the 5-minute stay window.
   */
  rescueBoost: RescueBoost | null;
  /**
   * Snapshot of the most recently applied streak-miss penalty, for UI
   * notification (VAL-STREAK-005..008). Carries the actual capped token loss
   * so the notification never overstates the deduction. Null when no penalty
   * has been applied.
   */
  lastStreakPenalty: StreakPenaltySnapshot | null;
}

/* ============================================================================
   Map / Mall
   ========================================================================== */

export interface Zone {
  id: string;
  name: string;
  description: string;
  polygonPoints: string; // SVG points string
  center: { x: number; y: number };
  adjacentZoneIds: string[];
  revealed: boolean;
}

export interface Store {
  id: string;
  name: string;
  category: StoreCategory;
  zoneId: string;
  position: { x: number; y: number };
  icon: string;
  reviews: Review[];
  visitorCount: number; // amplified count
  dealInfo?: DealInfo;
}

export type StoreCategory =
  | "fashion"
  | "tech"
  | "lifestyle"
  | "food"
  | "accessories";

export interface Review {
  id: string;
  authorName: string;
  avatarSeed: string;
  rating: number; // always 4-5
  text: string;
  date: string;
}

export interface DealInfo {
  title: string;
  discount: string;
  tokenCost: number;
  countdownSeconds: number;
  personalized: boolean;
}

export interface PlayerPosition {
  x: number;
  y: number;
  zoneId: string;
}

export type FogState = Record<string, boolean>; // zoneId -> revealed

export interface MapState {
  zones: Zone[];
  stores: Store[];
  playerPosition: PlayerPosition;
  fogState: FogState;
  explorationPercent: number;
  /**
   * Map of storeId -> epoch-ms timestamp of the most recent visit this
   * session. A visit-stores task only counts a store whose `visitedAt` is
   * >= the task's `assignedAt`, so historical visits from before the task
   * was assigned cannot retroactively complete it.
   */
  visitedStores: Record<string, number>;
}

/* ============================================================================
   Tasks
   ========================================================================== */

export type TaskType = "explore-zone" | "find-token" | "visit-stores";

export interface Task {
  id: string;
  type: TaskType;
  description: string;
  targetZone?: string;
  targetStores?: string[];
  reward: number;
  timeGated: boolean;
  gateUntil?: number; // epoch ms when gate elapses
  difficulty: number;
  chainLevel: number;
  /**
   * Epoch ms when the task was assigned (created). Used by visit-stores
   * completion so that only store visits occurring AT OR AFTER this moment
   * count toward fulfilling the task — historical visits from before the
   * task existed must not retroactively complete it.
   */
  assignedAt: number;
}

export interface TaskState {
  activeTasks: Task[];
  completedTasks: Task[];
  taskChain: number;
}

/* ============================================================================
   Economy
   ========================================================================== */

export interface FlashSale {
  id: string;
  storeId: string;
  discount: string;
  tokenCost: number;
  countdownSeconds: number;
  personalized: boolean;
  // Extended fields used by the token-economy spending path and the minimal
  // flash-sale overlay. The full flash-sale feature (proximity triggering,
  // synthetic timers, personalization) populates these; they remain optional
  // so the bare economyStore skeleton stays backward compatible.
  itemDescription?: string;
  discountPercent?: number;
  socialProof?: number;
  claimed?: boolean;
  createdAt?: number;
  /**
   * Synthetic countdown tick interval in ms. Per DECISIONS 4.5.1 the flash
   * sale timer is synthetic and may not reflect real duration. The displayed
   * countdown decrements once per `syntheticTickMs`, which is intentionally
   * slower than a real second so the timer does not run 1:1 with wall-clock
   * (VAL-SALE-006). Defaults to 1000 when unset.
   */
  syntheticTickMs?: number;
  /**
   * The countdown value the sale started with. Stored separately from
   * `countdownSeconds` (which is decremented over time) so the EventScheduler
   * can compute the remaining time from `createdAt` and `syntheticTickMs`
   * even for sales whose overlay was never opened. When unset, it defaults to
   * `countdownSeconds` at creation time.
   */
  initialCountdownSeconds?: number;
}

/**
 * A real-money token pack purchasable from the Buy Tokens tab. Prices are
 * shown in an obfuscated "gems" currency (non-round conversion to USD) so
 * users cannot easily compute the real-world cost per token. The
 * `fakeRetailPrice` is a crossed-out anchor that never represented an actual
 * price; `bonusPercent` is baked into `tokenAmount` already but displayed as
 * an extra "bonus" to create urgency.
 */
export interface TokenPack {
  id: string;
  name: string;
  description: string;
  /** Tokens the user receives (already includes the fake "bonus"). */
  tokenAmount: number;
  /** Real-world USD price. */
  price: number;
  /** Obfuscated currency price (gems). 137 gems ≈ $1.99 — deliberately non-round. */
  gemsPrice: number;
  /** Crossed-out anchor price (never a real price). */
  fakeRetailPrice: number;
  /** Fake "bonus" percentage (already baked into tokenAmount). */
  bonusPercent: number;
  badge?: string;
  highlighted?: boolean;
  /** Fake scarcity stock count (decremented over time, "restocked" cyclically). */
  stockLeft?: number;
  /** Whether this pack has the fake "first purchase 300% bonus" applied. */
  firstPurchaseBonus?: boolean;
}

export type RewardDensityPhase = "hook" | "chase";

export interface SpinningWheelState {
  available: boolean;
  lastSpin: number; // epoch ms
  spinCount: number;
  extraSpins: number;
  lastSpinNearMiss: boolean;
}

export interface EconomyState {
  flashSales: FlashSale[];
  spinningWheel: SpinningWheelState;
  rewardDensity: { phase: RewardDensityPhase; sessionMinutes: number };
  deficitMultiplier: number;
  /** Real-money token packs purchasable from the Buy Tokens tab. */
  tokenPacks: TokenPack[];
  /**
   * Fake "limited-time" bonus event that cycles endlessly. The multiplier
   * rotates between 30/50/75/100% and the countdown resets on each cycle,
   * creating perpetual urgency that never actually expires.
   */
  bonusEventMultiplier: number;
  /** Epoch ms when the current bonus event "expires" (resets on expiry). */
  bonusEventEndsAt: number;
  /**
   * Fake "first purchase bonus" flag. Never actually set to true — the
   * 300% first-purchase bait persists every session.
   */
  firstPurchaseBonusUsed: boolean;
  /**
   * The live deficit price (current balance + 2..3), recalculated every
   * scheduler tick. Used for the persistent "always short" spend teaser so
   * the user is never presented with a comfortably affordable next reward.
   */
  liveDeficitPrice: number;
}

/* ============================================================================
   Social
   ========================================================================== */

/**
 * The ranking metric the leaderboard is currently sorted by. Users can switch
 * between these to compare on multiple axes (VAL-LEADER-019).
 */
export type LeaderboardMetric = "tokens" | "time" | "exploration";

export interface PhantomUser {
  id: string;
  name: string;
  avatarSeed: string;
  tier: Tier;
  tokenCount: number;
  position: { x: number; y: number; zoneId: string };
  currentAction: string;
  lastActivity: string;
  /**
   * Fabricated time-in-mall in synthetic minutes. Used by the leaderboard's
   * time metric (VAL-LEADER-004). Evolves slowly over time so phantom scores
   * are not frozen (VAL-LEADER-016).
   */
  timeInMall: number;
  /**
   * Fabricated exploration percentage. Used by the leaderboard's exploration
   * metric (VAL-LEADER-006).
   */
  explorationPercent: number;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  avatarSeed: string;
  tier: Tier;
  tokenCount: number;
  isPlayer: boolean;
  /** Time-in-mall metric in synthetic minutes (VAL-LEADER-004). */
  timeInMall: number;
  /** Exploration percentage metric (VAL-LEADER-006). */
  explorationPercent: number;
}

export interface ProximityAlert {
  id: string;
  message: string;
  targetName: string;
  tokenGap: number;
  /** The rank position the user is chasing (e.g. 5 for "#5"). */
  rank: number;
  /** The metric the alert was generated for. */
  metric: LeaderboardMetric;
}

export interface SocialState {
  phantoms: PhantomUser[];
  leaderboard: LeaderboardEntry[];
  proximityAlerts: ProximityAlert[];
  /** Currently selected leaderboard sort metric (VAL-LEADER-019). */
  activeMetric: LeaderboardMetric;
}

/* ============================================================================
   Session
   ========================================================================== */

export type ExitFrictionLayer = 0 | 1 | 2 | 3;

export interface GameEvent {
  id: string;
  type: EventType;
  scheduledFor: number; // epoch ms
  payload?: Record<string, unknown>;
  processed: boolean;
}

export type EventType =
  | "flash-sale-trigger"
  | "wheel-available"
  | "phantom-move"
  | "leaderboard-update"
  | "perk-expiry"
  | "streak-check"
  | "deficit-recalc"
  | "reward-density-shift";

export interface SessionState {
  sessionStart: number;
  sessionMinutes: number;
  exitAttempts: number;
  exitFrictionLayer: ExitFrictionLayer;
  eventQueue: GameEvent[];
  /**
   * True after the user successfully leaves the mall (final "Leave anyway" on
   * Layer 3). While true the MallExperience renders a goodbye / "come back
   * soon" screen instead of the mall, and a "Return to Mall" control resets
   * it (VAL-EXIT-017, VAL-EXIT-032).
   */
  exited: boolean;
}

/* ============================================================================
   Onboarding
   ========================================================================== */

/**
 * The forward-only onboarding flow step.
 * - 'invite': user is at `/` and has not yet validated an invite code.
 * - 'survey': invite code validated; user may be at `/survey` or beyond.
 * - 'mall':   survey completed; user may be at `/mall`.
 *
 * The step only advances forward (invite -> survey -> mall) and is used by
 * route guards to prevent bypassing onboarding via direct URL navigation.
 */
export type OnboardingStep = "invite" | "survey" | "mall";

export interface OnboardingState {
  onboardingStep: OnboardingStep;
}

/* ============================================================================
   UI
   ========================================================================== */

export type OverlayType =
  | "none"
  | "spinning-wheel"
  | "flash-sale"
  | "store-detail"
  | "tier-upgrade"
  | "tier-perks"
  | "exit-friction"
  | "celebration"
  | "shortcut-unlock"
  | "leaderboard"
  | "shop";

/**
 * Payload for the celebration / token-feedback overlay.
 * - `earn` events render a gold +N upward burst (exploration, tasks, wheel,
 *   secret token).
 * - `spend` events render a purchase receipt card with balance animation and
 *   a post-purchase hook CTA that loops the impulse.
 * - `streak` events render a fire/gold milestone card on day increments.
 */
export type TokenFeedbackKind = "earn" | "spend" | "streak";

export interface CelebrationHook {
  label: string;
  action: "explore" | "wheel" | "shop" | "dismiss";
}

export interface CelebrationData {
  message: string;
  amount: number;
  kind?: TokenFeedbackKind;
  /** Deal/item name shown in the spend receipt card. */
  label?: string;
  /** Token balance before the transaction (for animated counter). */
  balanceBefore?: number;
  /** Token balance after the transaction. */
  balanceAfter?: number;
  /** Post-purchase hook CTA shown at the bottom of the spend receipt. */
  hook?: CelebrationHook;
}

/**
 * Payload for the tier-upgrade celebration overlay (VAL-TIER-006..008).
 * `newTier` is the tier the player was promoted to; `previousTier` is the
 * tier they came from (used for the staggered text reveal).
 */
export interface TierUpgradeData {
  newTier: Tier;
  previousTier: Tier;
}

/* ============================================================================
   Exit Friction
   ========================================================================== */

/**
 * Sunk-cost summary shown in the Layer 2 guilt-escalation screen
 * (VAL-EXIT-010, VAL-EXIT-023..025). Every value is drawn from a live store
 * so the rendered text always matches `overlayData` (VAL-EXIT-031).
 */
export interface ExitFrictionSunkCost {
  /** Cumulative tokens earned this session (playerStore.tierXP). */
  cumulativeTokensEarned: number;
  /** Total minutes spent in the mall (sessionStore.sessionMinutes). */
  timeSpentMinutes: number;
  /** Exploration progress percentage (mapStore.explorationPercent). */
  explorationPercent: number;
  /** Number of perks unlocked (earned + trial). */
  perksUnlocked: number;
  /** Number of tasks completed (taskStore.completedTasks.length). */
  tasksCompleted: number;
  /** Current leaderboard rank (socialStore). 0 when unranked. */
  leaderboardRank: number;
}

/**
 * A flash-sale miss item shown in Layer 1 (VAL-EXIT-005).
 */
export interface ExitFrictionMissedSale {
  storeName: string;
  discount: string;
  countdownSeconds: number;
}

/**
 * The rescue bargain offer details shown in Layer 3 (VAL-EXIT-013..016).
 */
export interface ExitFrictionBargain {
  /** Minutes the user is asked to stay (5). */
  stayMinutes: number;
  /** Whether a bonus spinning-wheel spin is offered. */
  bonusWheel: boolean;
  /** Whether streak protection is offered. */
  streakProtection: boolean;
  /** Token multiplier offered (2x). */
  tokenBoost: number;
}

/**
 * Payload stored in `uiStore.overlayData` while the exit-friction overlay is
 * active (VAL-EXIT-030, VAL-EXIT-031). The component re-derives these values
 * from the live stores on every render and syncs them back into overlayData
 * so the data and the rendered text can never diverge.
 */
export interface ExitFrictionData {
  layer: 1 | 2 | 3;
  /** Active flash sales the user would miss (Layer 1, VAL-EXIT-005). */
  missedSales: ExitFrictionMissedSale[];
  /** Current exploration percent (mapStore). */
  explorationPercent: number;
  /** Remaining unexplored percent (100 - explorationPercent). */
  unexploredPercent: number;
  /** Tokens short of the nearest shortcut/reward (deficit, VAL-EXIT-007). */
  tokensAwayFromShortcut: number;
  /** Current streak day count (playerStore.streak.count, VAL-EXIT-009). */
  streakCount: number;
  /** Sunk-cost summary (Layer 2, VAL-EXIT-010). */
  sunkCost: ExitFrictionSunkCost;
  /** Names of phantom friends still "inside" the mall (VAL-EXIT-011). */
  friendsInside: string[];
  /** Rescue bargain offer (Layer 3, VAL-EXIT-013). */
  bargain: ExitFrictionBargain;
}

export interface UIState {
  activeOverlay: OverlayType;
  overlayData: unknown;
  bottomPanelExpanded: boolean;
  isTimelineOpen: boolean;
  hasSeenTimelineOnboarding: boolean;
  isMuted: boolean;
  /** Whether sound effects are enabled (separate from feed video mute). */
  isSoundEnabled: boolean;
  /** Parallel celebration toast queue — independent of activeOverlay. */
  celebrationQueue: CelebrationData[];
}
