import { describe, it, expect } from "vitest";
import {
  getCorridorPath,
  EXPLORE_REWARD,
  FIRST_TOKEN_BONUS,
  FOOD_COURT_SECRET_REWARD,
  ZONE_ENTRANCE,
  ZONE_EAST_WING,
  ZONE_FOOD_COURT,
  getZoneById,
} from "@/data/mallData";

describe("corridor + reward helpers", () => {
  it("getCorridorPath returns 3 points: from center, midpoint, to center", () => {
    const path = getCorridorPath(ZONE_ENTRANCE, ZONE_EAST_WING);
    const from = getZoneById(ZONE_ENTRANCE)!.center;
    const to = getZoneById(ZONE_EAST_WING)!.center;
    expect(path).toHaveLength(3);
    expect(path[0]).toEqual(from);
    expect(path[2]).toEqual(to);
    // Midpoint is the average of the two centers.
    expect(path[1].x).toBe(Math.round((from.x + to.x) / 2));
    expect(path[1].y).toBe(Math.round((from.y + to.y) / 2));
  });

  it("getCorridorPath handles food court (furthest zone) path", () => {
    const path = getCorridorPath(ZONE_EAST_WING, ZONE_FOOD_COURT);
    expect(path).toHaveLength(3);
    expect(path[0]).toEqual(getZoneById(ZONE_EAST_WING)!.center);
    expect(path[2]).toEqual(getZoneById(ZONE_FOOD_COURT)!.center);
  });

  it("reward constants are positive integers", () => {
    expect(EXPLORE_REWARD).toBeGreaterThan(0);
    expect(FIRST_TOKEN_BONUS).toBeGreaterThan(0);
    expect(FOOD_COURT_SECRET_REWARD).toBeGreaterThan(EXPLORE_REWARD);
  });
});
