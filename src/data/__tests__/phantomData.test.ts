import { describe, it, expect } from "vitest";
import {
  phantoms,
  initialLeaderboard,
  getPhantomById,
  phantomJustAbove,
  samplePhantomAction,
} from "@/data/phantomData";

describe("phantomData", () => {
  it("contains a non-empty roster of phantom personas", () => {
    expect(phantoms.length).toBeGreaterThan(0);
  });

  it("every phantom has a name, tier, token count, and position", () => {
    for (const p of phantoms) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(["bronze", "silver", "gold", "neodymium"]).toContain(p.tier);
      expect(p.tokenCount).toBeGreaterThanOrEqual(0);
      expect(typeof p.position.x).toBe("number");
      expect(typeof p.position.y).toBe("number");
      expect(p.position.zoneId.length).toBeGreaterThan(0);
      expect(p.currentAction.length).toBeGreaterThan(0);
    }
  });

  it("phantom ids are unique", () => {
    const ids = phantoms.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("initial leaderboard has contiguous 1-indexed ranks", () => {
    const ranks = initialLeaderboard.map((e) => e.rank).sort((a, b) => a - b);
    for (let i = 0; i < ranks.length; i++) {
      expect(ranks[i]).toBe(i + 1);
    }
  });

  it("getPhantomById returns the matching phantom or undefined", () => {
    const first = phantoms[0];
    if (!first) throw new Error("Expected phantoms");
    expect(getPhantomById(first.id)?.id).toBe(first.id);
    expect(getPhantomById("does-not-exist")).toBeUndefined();
  });

  it("phantomJustAbove returns a phantom with more tokens than the argument", () => {
    const minTokens = Math.min(...phantoms.map((p) => p.tokenCount));
    const above = phantomJustAbove(minTokens);
    expect(above).toBeDefined();
    expect(above?.tokenCount).toBeGreaterThan(minTokens);
  });

  it("samplePhantomAction returns a non-empty action string", () => {
    const action = samplePhantomAction(() => 0.5);
    expect(action.length).toBeGreaterThan(0);
  });
});
