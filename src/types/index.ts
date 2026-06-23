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

export interface StreakState {
  count: number;
  lastVisit: number; // epoch ms
  broken: boolean;
  recoveryWindow: boolean;
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
  /** Store ids the player has opened (visited) this session. */
  visitedStores: string[];
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
}

/**
 * A token-purchasable shortcut that opens a faster route between two zones.
 * When `unlocked` becomes true the two zones are treated as adjacent by the
 * mapStore, and a distinct corridor line is drawn on the map.
 *
 * `tokenCost` is the deficit-engineered price FROZEN at the moment the
 * shortcut became the active offer (balance + 2..3 at that time). It is the
 * exact amount deducted on unlock. The live, always-just-out-of-reach teaser
 * price shown on the entry button is `economyStore.liveDeficitPrice` which
 * recalculates every scheduler tick.
 */
export interface Shortcut {
  id: string;
  name: string;
  description: string;
  fromZoneId: string;
  toZoneId: string;
  tokenCost: number; // frozen deficit price (balance + 2..3 at activation)
  unlocked: boolean;
}

export type RewardDensityPhase = "hook" | "chase";

export interface SpinningWheelState {
  available: boolean;
  lastSpin: number; // epoch ms
  spinCount: number;
}

export interface EconomyState {
  flashSales: FlashSale[];
  spinningWheel: SpinningWheelState;
  rewardDensity: { phase: RewardDensityPhase; sessionMinutes: number };
  deficitMultiplier: number;
  /** Token-purchasable shortcuts (faster routes between zones). */
  shortcuts: Shortcut[];
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

export interface PhantomUser {
  id: string;
  name: string;
  avatarSeed: string;
  tier: Tier;
  tokenCount: number;
  position: { x: number; y: number; zoneId: string };
  currentAction: string;
  lastActivity: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  avatarSeed: string;
  tier: Tier;
  tokenCount: number;
  isPlayer: boolean;
}

export interface ProximityAlert {
  id: string;
  message: string;
  targetName: string;
  tokenGap: number;
}

export interface SocialState {
  phantoms: PhantomUser[];
  leaderboard: LeaderboardEntry[];
  proximityAlerts: ProximityAlert[];
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
  | "exit-friction"
  | "celebration"
  | "shortcut-unlock";

/**
 * Payload for the celebration / token-feedback overlay.
 * - `earn` events render a gold +N upward burst (exploration, tasks, wheel,
 *   secret token).
 * - `spend` events render a distinct red -N downward dim (shortcut unlocks,
 *   flash sale purchases) so the two are visually distinguishable.
 */
export type TokenFeedbackKind = "earn" | "spend";

export interface CelebrationData {
  message: string;
  amount: number;
  kind?: TokenFeedbackKind;
}

export interface UIState {
  activeOverlay: OverlayType;
  overlayData: unknown;
  bottomPanelExpanded: boolean;
}
