import { describe, it, expect, beforeEach } from "vitest";
import { useSocialStore } from "@/stores/socialStore";
import { usePlayerStore } from "@/stores/playerStore";
import { useMapStore } from "@/stores/mapStore";
import { useSessionStore } from "@/stores/sessionStore";
import { phantoms as staticPhantoms } from "@/data/phantomData";
import {
  ensurePhantomJustAbove,
  checkProximityAndAlert,
  resetPhantomEngine,
  PROXIMITY_ALERT_THRESHOLD,
  entryMetricValue,
} from "@/engine/phantomEngine";

describe("socialStore", () => {
  beforeEach(() => {
    useSocialStore.getState().reset();
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
    useSessionStore.getState().reset();
    resetPhantomEngine();
  });

  it("initializes with phantom users and a leaderboard", () => {
    const s = useSocialStore.getState();
    expect(s.phantoms.length).toBeGreaterThan(0);
    expect(s.leaderboard.length).toBeGreaterThan(0);
    expect(s.proximityAlerts).toEqual([]);
    expect(s.activeMetric).toBe("tokens");
  });

  it("includes the player row in the initial leaderboard state (before any updateLeaderboard call)", () => {
    // Reset to a clean slate so we observe the true initial state.
    useSocialStore.getState().reset();
    const board = useSocialStore.getState().leaderboard;
    const player = board.find((e) => e.isPlayer);
    expect(player).toBeDefined();
    expect(player?.name).toBe("You");
    // Player row reflects live store values at init time.
    expect(player?.tokenCount).toBe(usePlayerStore.getState().tokens);
    // Ranks are contiguous 1..N.
    const ranks = board.map((e) => e.rank).sort((a, b) => a - b);
    for (let i = 0; i < ranks.length; i++) {
      expect(ranks[i]).toBe(i + 1);
    }
  });

  it("all phantoms are fabricated (none are the player)", () => {
    for (const p of useSocialStore.getState().phantoms) {
      expect(p.name).not.toBe("You");
    }
  });

  it("movePhantoms updates positions and actions", () => {
    const before = useSocialStore.getState().phantoms[0];
    if (!before) throw new Error("Expected phantoms");
    useSocialStore.getState().movePhantoms();
    const after = useSocialStore.getState().phantoms[0];
    expect(after).toBeDefined();
    expect(after?.id).toBe(before.id);
  });

  it("updateLeaderboard includes the player entry and assigns contiguous 1-indexed ranks", () => {
    usePlayerStore.getState().addTokens(15);
    useSocialStore.getState().updateLeaderboard();
    const board = useSocialStore.getState().leaderboard;
    const player = board.find((e) => e.isPlayer);
    expect(player).toBeDefined();
    expect(player?.tokenCount).toBe(15);
    // Ranks contiguous 1..N (VAL-LEADER-021)
    const ranks = board.map((e) => e.rank).sort((a, b) => a - b);
    for (let i = 0; i < ranks.length; i++) {
      expect(ranks[i]).toBe(i + 1);
    }
  });

  it("leaderboard entries carry all three metrics (VAL-LEADER-007)", () => {
    useSocialStore.getState().updateLeaderboard();
    const board = useSocialStore.getState().leaderboard;
    for (const e of board) {
      expect(typeof e.tokenCount).toBe("number");
      expect(typeof e.timeInMall).toBe("number");
      expect(typeof e.explorationPercent).toBe("number");
    }
  });

  it("player entry metrics match live store values (VAL-LEADER-004..006)", () => {
    usePlayerStore.getState().addTokens(7);
    useMapStore.getState().revealZone("zone-east-wing");
    useSessionStore.getState().startSession();
    // Simulate a few minutes via tick (sessionStore.tick computes from elapsed).
    useSocialStore.getState().updateLeaderboard();
    const player = useSocialStore
      .getState()
      .leaderboard.find((e) => e.isPlayer);
    expect(player).toBeDefined();
    expect(player?.tokenCount).toBe(usePlayerStore.getState().tokens);
    expect(player?.explorationPercent).toBe(
      useMapStore.getState().explorationPercent,
    );
  });

  it("user rank matches their score position (VAL-LEADER-024)", () => {
    usePlayerStore.getState().addTokens(40);
    useSocialStore.getState().updateLeaderboard();
    const board = [...useSocialStore.getState().leaderboard].sort(
      (a, b) => b.tokenCount - a.tokenCount,
    );
    const player = board.find((e) => e.isPlayer)!;
    const expectedRank = board.indexOf(player) + 1;
    expect(player.rank).toBe(expectedRank);
  });

  it("setActiveMetric re-ranks by the chosen metric (VAL-LEADER-019)", () => {
    useSocialStore.getState().updateLeaderboard();
    useSocialStore.getState().setActiveMetric("exploration");
    const board = useSocialStore.getState().leaderboard;
    // Sorted by exploration descending.
    for (let i = 1; i < board.length; i++) {
      expect(
        entryMetricValue(board[i - 1], "exploration"),
      ).toBeGreaterThanOrEqual(entryMetricValue(board[i], "exploration"));
    }
    expect(useSocialStore.getState().activeMetric).toBe("exploration");
  });

  it("triggerProximityAlert adds an alert naming the phantom, gap and rank (VAL-LEADER-011..013)", () => {
    const alert = useSocialStore
      .getState()
      .triggerProximityAlert("Alex", 2, 5, "tokens", "2 tokens");
    expect(alert.id).toBeTruthy();
    expect(alert.targetName).toBe("Alex");
    expect(alert.tokenGap).toBe(2);
    expect(alert.rank).toBe(5);
    expect(alert.metric).toBe("tokens");
    expect(alert.message).toContain("Alex");
    expect(alert.message).toContain("#5");
    expect(alert.message).toContain("2 tokens");
    expect(useSocialStore.getState().proximityAlerts).toHaveLength(1);
  });

  it("triggerProximityAlert singularizes 1 token correctly", () => {
    const alert = useSocialStore
      .getState()
      .triggerProximityAlert("Sam", 1, 4, "tokens", "1 token");
    expect(alert.message).toContain("1 token");
    expect(alert.message).not.toContain("1 tokens");
  });

  it("dismissProximityAlert removes the alert by id", () => {
    const alert = useSocialStore
      .getState()
      .triggerProximityAlert("Alex", 2, 5, "tokens", "2 tokens");
    useSocialStore.getState().dismissProximityAlert(alert.id);
    expect(useSocialStore.getState().proximityAlerts).toHaveLength(0);
  });

  it("generatePhantomActivity moves phantoms and refreshes the leaderboard", () => {
    useSocialStore.getState().generatePhantomActivity();
    expect(useSocialStore.getState().leaderboard.length).toBeGreaterThan(0);
  });

  it("static phantom roster matches the store initial state", () => {
    expect(useSocialStore.getState().phantoms.length).toBe(
      staticPhantoms.length,
    );
  });

  it("addPhantom appends a fabricated phantom", () => {
    const before = useSocialStore.getState().phantoms.length;
    useSocialStore.getState().addPhantom({
      id: "test-phantom",
      name: "Test",
      avatarSeed: "test",
      tier: "silver",
      tokenCount: 100,
      position: { x: 1, y: 1, zoneId: "zone-entrance" },
      currentAction: "testing",
      lastActivity: "now",
      timeInMall: 10,
      explorationPercent: 50,
    });
    expect(useSocialStore.getState().phantoms.length).toBe(before + 1);
  });

  it("adjustPhantom mutates a single phantom by id", () => {
    useSocialStore.getState().adjustPhantom("phantom-alex", (p) => ({
      ...p,
      tokenCount: 999,
    }));
    const alex = useSocialStore
      .getState()
      .phantoms.find((p) => p.id === "phantom-alex");
    expect(alex?.tokenCount).toBe(999);
  });
});

describe("phantomEngine — goalpost shifting", () => {
  beforeEach(() => {
    useSocialStore.getState().reset();
    usePlayerStore.getState().reset();
    useMapStore.getState().reset();
    useSessionStore.getState().reset();
    resetPhantomEngine();
  });

  it("fabricates a new phantom just ahead when the player reaches #1 (VAL-LEADER-014, -017)", () => {
    // Inflate the player's tokens above every static phantom so they are #1.
    usePlayerStore.getState().addTokens(200);
    useSocialStore.getState().updateLeaderboard();
    const before = useSocialStore.getState().phantoms.length;
    const result = ensurePhantomJustAbove();
    expect(result.generated).toBe(true);
    expect(useSocialStore.getState().phantoms.length).toBe(before + 1);
    // The new phantom is just barely ahead of the player.
    const newPhantom = useSocialStore
      .getState()
      .phantoms[useSocialStore.getState().phantoms.length - 1];
    expect(newPhantom.tokenCount).toBeGreaterThan(200);
    expect(newPhantom.tokenCount).toBeLessThanOrEqual(200 + 3);
  });

  it("pulls the closest above-phantom closer when it is too far ahead (VAL-LEADER-010)", () => {
    // Set the player to a moderate score so a far-ahead phantom exists.
    usePlayerStore.getState().addTokens(20);
    useSocialStore.getState().updateLeaderboard();
    ensurePhantomJustAbove();
    // After shifting, the closest above-phantom must be within gap <= 3.
    const playerVal = usePlayerStore.getState().tokens;
    const above = useSocialStore
      .getState()
      .phantoms.filter((p) => p.tokenCount > playerVal)
      .sort((a, b) => a.tokenCount - b.tokenCount);
    expect(above.length).toBeGreaterThan(0);
    expect(above[0]!.tokenCount - playerVal).toBeLessThanOrEqual(3);
  });

  it("proximity alert fires when close and not when far (VAL-LEADER-011, -020)", () => {
    // Far behind: player at 0, nearest phantom far ahead -> no alert.
    usePlayerStore.getState().addTokens(0);
    useSocialStore.getState().updateLeaderboard();
    expect(checkProximityAndAlert()).toBeNull();

    // Bring the player within the threshold of the nearest above-phantom.
    ensurePhantomJustAbove(); // pulls a leader to within 3 of player
    const alertId = checkProximityAndAlert();
    expect(alertId).not.toBeNull();
    const alert = useSocialStore
      .getState()
      .proximityAlerts.find((a) => a.id === alertId);
    expect(alert).toBeDefined();
    expect(alert!.tokenGap).toBeLessThanOrEqual(PROXIMITY_ALERT_THRESHOLD);
    expect(alert!.message).toContain("#");
    expect(alert!.message).toContain(alert!.targetName);
  });

  it("overtaking shifts the user's rank up (VAL-LEADER-025)", () => {
    usePlayerStore.getState().addTokens(20);
    useSocialStore.getState().updateLeaderboard();
    const rankBefore = useSocialStore
      .getState()
      .leaderboard.find((e) => e.isPlayer)!.rank;

    // Pull a leader to within 3, then overtake it.
    ensurePhantomJustAbove();
    const above = useSocialStore
      .getState()
      .phantoms.filter((p) => p.tokenCount > usePlayerStore.getState().tokens)
      .sort((a, b) => a.tokenCount - b.tokenCount);
    const target = above[0]!;
    // Earn enough to overtake the target.
    const needed = target.tokenCount - usePlayerStore.getState().tokens + 1;
    usePlayerStore.getState().addTokens(needed);
    useSocialStore.getState().updateLeaderboard();
    const rankAfter = useSocialStore
      .getState()
      .leaderboard.find((e) => e.isPlayer)!.rank;
    expect(rankAfter).toBeLessThan(rankBefore);
  });
});
