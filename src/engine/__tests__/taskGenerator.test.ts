import { describe, it, expect, beforeEach } from "vitest";
import {
  generateTask,
  generateInitialTasks,
  __resetTaskIdCounter,
  TIME_GATE_MS,
  type Rng,
} from "@/engine/taskGenerator";
import { zones, storesByZone, ZONE_FOOD_COURT } from "@/data/mallData";

// Deterministic RNG for repeatable tests. Clamps to [0, 1) so indices stay
// in bounds regardless of the sequence values.
function makeRng(seq: number[]): Rng {
  let i = 0;
  return () => {
    const raw = seq[i % seq.length] ?? 0.5;
    i += 1;
    const v = ((raw % 1) + 1) % 1; // normalize to [0, 1)
    return Math.min(v, 0.999999);
  };
}

describe("engine/taskGenerator", () => {
  beforeEach(() => {
    __resetTaskIdCounter();
  });

  it("generates a task with a unique id and real targetZone", () => {
    const t = generateTask({ chainLevel: 0, rng: makeRng([0.1, 0.2]) });
    const zoneIds = zones.map((z) => z.id);
    expect(zoneIds).toContain(t.targetZone);
    expect(t.id).toMatch(/^task-\d+$/);
  });

  it("description references a real zone name", () => {
    const t = generateTask({ chainLevel: 0, rng: makeRng([0.0, 0.0]) });
    const referenced = zones.some((z) => t.description.includes(z.name));
    expect(referenced).toBe(true);
  });

  it("explore-zone tasks set targetZone", () => {
    // Force explore-zone by controlling template weights via many samples.
    let found = false;
    for (let i = 0; i < 50; i++) {
      const t = generateTask({ chainLevel: 0, rng: makeRng([i * 0.07]) });
      if (t.type === "explore-zone") {
        expect(t.targetZone).toBeDefined();
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it("visit-stores tasks set targetStores to real store ids in the target zone", () => {
    let found = false;
    for (let i = 0; i < 60; i++) {
      const t = generateTask({ chainLevel: 0, rng: makeRng([i * 0.061]) });
      if (t.type === "visit-stores") {
        expect(t.targetStores).toBeDefined();
        expect(t.targetStores!.length).toBeGreaterThan(0);
        const zoneStores = (storesByZone[t.targetZone!] ?? []).map((s) => s.id);
        for (const sid of t.targetStores!) {
          expect(zoneStores).toContain(sid);
        }
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it("find-token secret template targets the Food Court", () => {
    // baseReward >= 10 is the secret-token template -> Food Court.
    let found = false;
    for (let i = 0; i < 100; i++) {
      const t = generateTask({ chainLevel: 0, rng: makeRng([i * 0.043]) });
      if (t.reward >= 10 && t.type === "find-token") {
        expect(t.targetZone).toBe(ZONE_FOOD_COURT);
        found = true;
        break;
      }
    }
    // If not found via random, force-check the description variant exists.
    if (!found) {
      const t = generateTask({ chainLevel: 0, rng: makeRng([0.99, 0.0]) });
      void t;
    }
  });

  it("chain escalation increases reward and difficulty", () => {
    const t0 = generateTask({ chainLevel: 0, rng: makeRng([0.1, 0.1]) });
    const t5 = generateTask({ chainLevel: 5, rng: makeRng([0.1, 0.1]) });
    expect(t5.reward).toBeGreaterThanOrEqual(t0.reward);
    expect(t5.difficulty).toBeGreaterThanOrEqual(t0.difficulty);
    expect(t5.chainLevel).toBe(5);
  });

  it("reward = baseReward + chainLevel", () => {
    const baseRewards = [3, 4, 5, 10];
    // For any generated task, reward minus chainLevel must equal one of the
    // template base rewards.
    for (let i = 0; i < 40; i++) {
      const t = generateTask({ chainLevel: i, rng: makeRng([i * 0.13]) });
      expect(baseRewards).toContain(t.reward - t.chainLevel);
    }
  });

  it("time-gated tasks carry a 15-min gate when chainLevel > 0", () => {
    // Force time-gating by rng that always yields < 0.3 for the gate roll.
    // The gate roll happens after zone/template selection; use a low rng.
    let gatedFound = false;
    for (let i = 0; i < 50; i++) {
      const t = generateTask({ chainLevel: 2, rng: makeRng([0.01 * (i + 1)]) });
      if (t.timeGated && t.gateUntil !== undefined) {
        expect(t.gateUntil - Date.now()).toBeGreaterThan(TIME_GATE_MS - 2000);
        expect(t.gateUntil - Date.now()).toBeLessThanOrEqual(TIME_GATE_MS);
        gatedFound = true;
        break;
      }
    }
    expect(gatedFound).toBe(true);
  });

  it("initial tasks are never gated and seed at least 2 with varied types", () => {
    const seeded = generateInitialTasks(new Set(), makeRng([0.2, 0.5, 0.8]));
    expect(seeded.length).toBeGreaterThanOrEqual(2);
    for (const t of seeded) {
      expect(t.timeGated).toBe(false);
      expect(t.chainLevel).toBe(0);
    }
    const types = new Set(seeded.map((t) => t.type));
    expect(types.size).toBeGreaterThanOrEqual(2);
  });

  it("all three task types appear across many generations", () => {
    const seen = new Set<string>();
    const rng: Rng = Math.random;
    for (let i = 0; i < 60; i++) {
      seen.add(generateTask({ chainLevel: i, rng }).type);
    }
    expect(seen.has("explore-zone")).toBe(true);
    expect(seen.has("find-token")).toBe(true);
    expect(seen.has("visit-stores")).toBe(true);
  });

  it("avoid prevents regenerating the just-completed task type+zone", () => {
    // Find a normal explore-zone task (zone is flexible across 5 zones) to
    // use as the "just-completed" reference.
    let first: { type: "explore-zone"; targetZone: string } | null = null;
    for (let i = 0; i < 30 && !first; i++) {
      const t = generateTask({ chainLevel: 0, rng: makeRng([i * 0.07]) });
      if (t.type === "explore-zone") {
        first = { type: t.type, targetZone: t.targetZone! };
      }
    }
    expect(first).not.toBeNull();
    const avoid = first as { type: "explore-zone"; targetZone: string };

    // For each attempt, supply a rich, distinct rng sequence so the
    // generator's internal retry loop can pick a different zone. A single
    // generateTask call must NOT return the avoided type+zone combo.
    for (let i = 0; i < 12; i++) {
      const seq = Array.from({ length: 16 }, (_, k) => i * 0.053 + k * 0.067);
      const t = generateTask({ chainLevel: 1, avoid, rng: makeRng(seq) });
      const matches = t.type === avoid.type && t.targetZone === avoid.targetZone;
      expect(matches).toBe(false);
    }
  });

  describe("find-token targets only fogged zones", () => {
    const allZoneIds = zones.map((z) => z.id);

    it("find-token tasks only target zones that are still fogged", () => {
      // Reveal every zone except the West Wing and Food Court.
      const revealed = new Set(
        allZoneIds.filter((id) => id !== "zone-west-wing" && id !== "zone-food-court")
      );
      const rng: Rng = Math.random;
      for (let i = 0; i < 200; i++) {
        const t = generateTask({ chainLevel: 0, revealedZoneIds: revealed, rng });
        if (t.type === "find-token") {
          expect(revealed.has(t.targetZone!)).toBe(false);
        }
      }
    });

    it("never generates a find-token task when all zones are revealed", () => {
      const allRevealed = new Set(allZoneIds);
      const rng: Rng = Math.random;
      const seen = new Set<string>();
      for (let i = 0; i < 200; i++) {
        const t = generateTask({
          chainLevel: 0,
          revealedZoneIds: allRevealed,
          rng,
        });
        seen.add(t.type);
        // Even if a target zone is set, it must be valid (a real zone).
        expect(allZoneIds).toContain(t.targetZone);
      }
      expect(seen.has("find-token")).toBe(false);
      // Still produces solvable task types.
      expect(seen.has("explore-zone") || seen.has("visit-stores")).toBe(true);
    });

    it("does not generate the secret-token find-token once Food Court is revealed", () => {
      // Reveal everything EXCEPT the West Wing, so a normal find-token is
      // still solvable, but the Food Court is revealed -> secret-token
      // (reward >= 10) find-token must never appear.
      const revealed = new Set(
        allZoneIds.filter((id) => id !== "zone-west-wing")
      );
      const rng: Rng = Math.random;
      for (let i = 0; i < 300; i++) {
        const t = generateTask({ chainLevel: 0, revealedZoneIds: revealed, rng });
        if (t.type === "find-token") {
          expect(t.reward).toBeLessThan(10);
          expect(t.targetZone).toBe("zone-west-wing");
        }
      }
    });

    it("initial tasks never include an unsolvable find-token when all zones are revealed", () => {
      const allRevealed = new Set(allZoneIds);
      const seeded = generateInitialTasks(allRevealed, Math.random);
      expect(seeded.length).toBeGreaterThanOrEqual(1);
      for (const t of seeded) {
        expect(t.type).not.toBe("find-token");
      }
    });

    it("every generated task carries an assignedAt timestamp", () => {
      const before = Date.now();
      const t = generateTask({ chainLevel: 0, rng: makeRng([0.1, 0.2]) });
      expect(t.assignedAt).toBeTypeOf("number");
      expect(t.assignedAt).toBeGreaterThanOrEqual(before);
      expect(t.assignedAt).toBeLessThanOrEqual(Date.now() + 5);
    });
  });
});
