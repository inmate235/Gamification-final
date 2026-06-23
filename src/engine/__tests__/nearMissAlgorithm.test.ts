import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  WHEEL_SEGMENTS,
  SEGMENT_COUNT,
  BIG_PRIZE_INDEX,
  NEAR_MISS_INDEX,
  SEGMENT_ANGLE,
  computeSpinResult,
  applySpinReward,
  computeTargetRotation,
} from "@/engine/nearMissAlgorithm";
import { usePlayerStore } from "@/stores/playerStore";
import { useEconomyStore } from "@/stores/economyStore";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";
import type { Tier } from "@/types";

describe("engine/nearMissAlgorithm", () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
    useEconomyStore.getState().reset();
    useMapStore.getState().reset();
    useUIStore.getState().reset();
  });

  /* --- Constants / layout --- */

  describe("wheel layout", () => {
    it("has exactly 7 prize segments", () => {
      expect(SEGMENT_COUNT).toBe(7);
      expect(WHEEL_SEGMENTS).toHaveLength(7);
    });

    it("includes all required prize types", () => {
      const types = WHEEL_SEGMENTS.map((s) => s.type);
      expect(types).toContain("tokens");
      expect(types).toContain("map-reveal");
      expect(types).toContain("flash-sale");
      expect(types).toContain("nothing");
    });

    it("includes token prizes 1, 3, 5, and 10", () => {
      const tokenAmounts = WHEEL_SEGMENTS.filter((s) => s.type === "tokens").map((s) => s.tokens);
      expect(tokenAmounts).toContain(1);
      expect(tokenAmounts).toContain(3);
      expect(tokenAmounts).toContain(5);
      expect(tokenAmounts).toContain(10);
    });

    it("big prize (10 tokens) is at index 0", () => {
      expect(BIG_PRIZE_INDEX).toBe(0);
      expect(WHEEL_SEGMENTS[0]?.tokens).toBe(10);
    });

    it("near-miss index is adjacent to big prize", () => {
      // Index 6 is counter-clockwise adjacent to index 0 (modular)
      const diff = Math.abs(NEAR_MISS_INDEX - BIG_PRIZE_INDEX);
      expect(diff === 1 || diff === SEGMENT_COUNT - 1).toBe(true);
    });

    it("segment angle is 360/7", () => {
      expect(SEGMENT_ANGLE).toBeCloseTo(360 / 7, 5);
    });
  });

  /* --- computeSpinResult --- */

  describe("computeSpinResult", () => {
    it("returns a valid segment index 0..6", () => {
      for (let i = 0; i < 100; i++) {
        const result = computeSpinResult("bronze");
        expect(result.segmentIndex).toBeGreaterThanOrEqual(0);
        expect(result.segmentIndex).toBeLessThan(SEGMENT_COUNT);
        expect(result.segment).toBeDefined();
      }
    });

    it("40% threshold produces ~40% near-miss rate over a large sample", () => {
      const spy = vi.spyOn(Math, "random").mockReturnValue(0.39); // just under 0.40
      const r = computeSpinResult("bronze");
      expect(r.nearMiss).toBe(true);
      expect(r.segmentIndex).toBe(NEAR_MISS_INDEX);
      spy.mockRestore();
    });

    it("r >= 0.40 produces a non-near-miss result", () => {
      const spy = vi.spyOn(Math, "random").mockReturnValue(0.41);
      const r = computeSpinResult("bronze");
      expect(r.nearMiss).toBe(false);
      spy.mockRestore();
    });

    it("near-miss rate is between 30% and 50% over 1000 spins", () => {
      let nearMissCount = 0;
      for (let i = 0; i < 1000; i++) {
        const r = computeSpinResult("bronze");
        if (r.nearMiss) nearMissCount++;
      }
      const rate = nearMissCount / 1000;
      expect(rate).toBeGreaterThanOrEqual(0.3);
      expect(rate).toBeLessThanOrEqual(0.5);
    });

    it("all prize types are achievable over many spins", () => {
      const seen = new Set<string>();
      for (let i = 0; i < 2000; i++) {
        seen.add(computeSpinResult("bronze").segment.type);
      }
      expect(seen.has("tokens")).toBe(true);
      expect(seen.has("map-reveal")).toBe(true);
      expect(seen.has("flash-sale")).toBe(true);
      expect(seen.has("nothing")).toBe(true);
    });

    it("near-miss always lands on the adjacent-to-big-prize segment", () => {
      for (let i = 0; i < 100; i++) {
        const spy = vi.spyOn(Math, "random").mockReturnValue(0.01 + (i / 100) * 0.39);
        const r = computeSpinResult("bronze");
        if (r.nearMiss) {
          expect(r.segmentIndex).toBe(NEAR_MISS_INDEX);
        }
        spy.mockRestore();
      }
    });
  });

  /* --- Neodymium tier advantage --- */

  describe("tier advantage (VAL-WHEEL-016)", () => {
    it("neodymium has a higher win rate than bronze over a large sample", () => {
      function winRate(tier: Tier, samples: number): number {
        let wins = 0;
        for (let i = 0; i < samples; i++) {
          const r = computeSpinResult(tier);
          if (r.segment.type !== "nothing") wins++;
        }
        return wins / samples;
      }

      const bronzeRate = winRate("bronze", 5000);
      const neoRate = winRate("neodymium", 5000);
      expect(neoRate).toBeGreaterThan(bronzeRate);
    });
  });

  /* --- applySpinReward --- */

  describe("applySpinReward", () => {
    it("credits token prizes with the tier multiplier", () => {
      usePlayerStore.getState().setTier("gold"); // 2x
      const result = {
        segmentIndex: 0,
        segment: WHEEL_SEGMENTS[0]!, // 10 tokens
        nearMiss: false,
      };
      const outcome = applySpinReward(result);
      expect(outcome.type).toBe("tokens");
      expect(outcome.tokensCredited).toBe(20); // 10 * 2x
      expect(usePlayerStore.getState().tokens).toBe(20);
    });

    it("credits neodymium 3x multiplier on token prizes (VAL-WHEEL-017)", () => {
      usePlayerStore.getState().setTier("neodymium");
      const result = {
        segmentIndex: 1,
        segment: WHEEL_SEGMENTS[1]!, // 5 tokens
        nearMiss: false,
      };
      const outcome = applySpinReward(result);
      expect(outcome.tokensCredited).toBe(15); // 5 * 3x
      expect(usePlayerStore.getState().tokens).toBe(15);
    });

    it("reveals a fogged zone on map-reveal prize", () => {
      const result = {
        segmentIndex: 2,
        segment: WHEEL_SEGMENTS[2]!,
        nearMiss: false,
      };
      const foggedBefore = Object.values(useMapStore.getState().fogState).filter(Boolean).length;
      const outcome = applySpinReward(result);
      expect(outcome.type).toBe("map-reveal");
      expect(outcome.zoneName).toBeDefined();
      const foggedAfter = Object.values(useMapStore.getState().fogState).filter(Boolean).length;
      expect(foggedAfter).toBeGreaterThan(foggedBefore);
    });

    it("grants token consolation when all zones are already revealed", () => {
      // Reveal all zones
      const zones = useMapStore.getState().zones;
      for (const z of zones) {
        useMapStore.getState().revealZone(z.id);
      }
      const result = {
        segmentIndex: 2,
        segment: WHEEL_SEGMENTS[2]!,
        nearMiss: false,
      };
      const outcome = applySpinReward(result);
      expect(outcome.tokensCredited).toBeGreaterThan(0);
    });

    it("triggers a flash sale on flash-sale prize", () => {
      const result = {
        segmentIndex: 4,
        segment: WHEEL_SEGMENTS[4]!,
        nearMiss: false,
      };
      const salesBefore = useEconomyStore.getState().flashSales.length;
      const outcome = applySpinReward(result);
      expect(outcome.type).toBe("flash-sale");
      expect(useEconomyStore.getState().flashSales.length).toBeGreaterThan(salesBefore);
    });

    it("grants nothing on the nothing prize", () => {
      const tokensBefore = usePlayerStore.getState().tokens;
      const result = {
        segmentIndex: 6,
        segment: WHEEL_SEGMENTS[6]!,
        nearMiss: false,
      };
      const outcome = applySpinReward(result);
      expect(outcome.type).toBe("nothing");
      expect(outcome.tokensCredited).toBe(0);
      expect(usePlayerStore.getState().tokens).toBe(tokensBefore);
    });
  });

  /* --- computeTargetRotation --- */

  describe("computeTargetRotation", () => {
    it("returns a rotation greater than current", () => {
      const target = computeTargetRotation(0, 3);
      expect(target).toBeGreaterThan(0);
    });

    it("brings the target segment to the top pointer position", () => {
      // For target index i, rotation mod 360 should equal (360 - i * SEGMENT_ANGLE) % 360
      for (let i = 0; i < SEGMENT_COUNT; i++) {
        const rot = computeTargetRotation(0, i);
        const expected = (360 - i * SEGMENT_ANGLE) % 360;
        expect(rot % 360).toBeCloseTo(expected, 1);
      }
    });

    it("handles cumulative rotation (always increases)", () => {
      let current = 0;
      for (let i = 0; i < 5; i++) {
        const next = computeTargetRotation(current, i % SEGMENT_COUNT);
        expect(next).toBeGreaterThan(current);
        current = next;
      }
    });

    it("near-miss target (index 6) passes through big prize position", () => {
      // For index 6, the target rotation mod 360 ≈ 51.43°, which is just past 0°
      // (the big prize position). The wheel passes 0° (big prize) then clicks to 51.43°.
      const rot = computeTargetRotation(0, NEAR_MISS_INDEX);
      const mod360 = rot % 360;
      // Should be close to SEGMENT_ANGLE (one segment past 0°)
      expect(mod360).toBeCloseTo(SEGMENT_ANGLE, 1);
    });
  });
});
