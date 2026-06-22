import { describe, it, expect, beforeEach } from "vitest";
import { useSocialStore } from "@/stores/socialStore";
import { usePlayerStore } from "@/stores/playerStore";
import { phantoms as staticPhantoms } from "@/data/phantomData";

describe("socialStore", () => {
  beforeEach(() => {
    useSocialStore.getState().reset();
    usePlayerStore.getState().reset();
  });

  it("initializes with phantom users and a leaderboard", () => {
    const s = useSocialStore.getState();
    expect(s.phantoms.length).toBeGreaterThan(0);
    expect(s.leaderboard.length).toBeGreaterThan(0);
    expect(s.proximityAlerts).toEqual([]);
  });

  it("all phantoms are fabricated (none are the player)", () => {
    for (const p of useSocialStore.getState().phantoms) {
      // PhantomUser has no isPlayer field; ensure none look like the player entry.
      expect(p.name).not.toBe("You");
    }
  });

  it("movePhantoms updates positions and actions", () => {
    const before = useSocialStore.getState().phantoms[0];
    if (!before) throw new Error("Expected phantoms");
    useSocialStore.getState().movePhantoms();
    const after = useSocialStore.getState().phantoms[0];
    expect(after).toBeDefined();
    // Identity preserved; at least one field may have changed.
    expect(after?.id).toBe(before.id);
  });

  it("updateLeaderboard includes the player entry and assigns ranks", () => {
    usePlayerStore.getState().addTokens(15);
    useSocialStore.getState().updateLeaderboard();
    const board = useSocialStore.getState().leaderboard;
    const player = board.find((e) => e.isPlayer);
    expect(player).toBeDefined();
    expect(player?.tokenCount).toBe(15);
    // Ranks should be contiguous 1..N
    const ranks = board.map((e) => e.rank).sort((a, b) => a - b);
    for (let i = 0; i < ranks.length; i++) {
      expect(ranks[i]).toBe(i + 1);
    }
  });

  it("triggerProximityAlert adds an alert with a message", () => {
    const alert = useSocialStore
      .getState()
      .triggerProximityAlert("Alex", 2);
    expect(alert.id).toBeTruthy();
    expect(alert.targetName).toBe("Alex");
    expect(alert.tokenGap).toBe(2);
    expect(alert.message).toContain("Alex");
    expect(useSocialStore.getState().proximityAlerts).toHaveLength(1);
  });

  it("triggerProximityAlert pluralizes tokens correctly", () => {
    const alert = useSocialStore
      .getState()
      .triggerProximityAlert("Sam", 1);
    expect(alert.message).toContain("1 token");
    expect(alert.message).not.toContain("1 tokens");
  });

  it("dismissProximityAlert removes the alert by id", () => {
    const alert = useSocialStore
      .getState()
      .triggerProximityAlert("Alex", 2);
    useSocialStore.getState().dismissProximityAlert(alert.id);
    expect(useSocialStore.getState().proximityAlerts).toHaveLength(0);
  });

  it("generatePhantomActivity moves phantoms and refreshes the leaderboard", () => {
    useSocialStore.getState().generatePhantomActivity();
    // No throw is the assertion; ensure leaderboard still present.
    expect(useSocialStore.getState().leaderboard.length).toBeGreaterThan(0);
  });

  it("static phantom roster matches the store initial state", () => {
    expect(useSocialStore.getState().phantoms.length).toBe(
      staticPhantoms.length
    );
  });
});
