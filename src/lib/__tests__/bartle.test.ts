import { describe, it, expect } from "vitest";
import {
  SURVEY_QUESTIONS,
  classifyBartleType,
  classifyBartleTypeSafe,
} from "@/lib/bartle";
import type { BartleType } from "@/types";

describe("bartle classification", () => {
  it("defines exactly 3 survey questions", () => {
    expect(SURVEY_QUESTIONS).toHaveLength(3);
  });

  it("each question has at least 2 options with scores", () => {
    for (const q of SURVEY_QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      for (const opt of q.options) {
        expect(opt.scores).toBeDefined();
        expect(Object.keys(opt.scores).length).toBeGreaterThan(0);
      }
    }
  });

  it("returns null when answers are incomplete", () => {
    expect(classifyBartleType({})).toBeNull();
    expect(classifyBartleType({ style: "bold" })).toBeNull();
    expect(classifyBartleType({ style: "bold", social: "friends" })).toBeNull();
  });

  it("returns a valid Bartle type for complete answers", () => {
    const validTypes: BartleType[] = [
      "achiever",
      "explorer",
      "socializer",
      "killer",
    ];
    const answers = {
      style: "bold",
      social: "friends",
      motivation: "deals",
    };
    const result = classifyBartleType(answers);
    expect(validTypes).toContain(result);
  });

  it("classifies a deals-focused solo classic shopper as achiever", () => {
    const answers = {
      style: "classic", // achiever 3, socializer 1
      social: "solo", // achiever 2, explorer 2
      motivation: "deals", // achiever 3, killer 1
    };
    // achiever = 8, explorer = 2, socializer = 1, killer = 1
    expect(classifyBartleType(answers)).toBe("achiever");
  });

  it("classifies a discovery-focused trendy solo shopper as explorer", () => {
    const answers = {
      style: "trendy", // explorer 3, socializer 1
      social: "solo", // achiever 2, explorer 2
      motivation: "discovery", // explorer 3, socializer 1
    };
    // explorer = 8, achiever = 2, socializer = 2
    expect(classifyBartleType(answers)).toBe("explorer");
  });

  it("classifies a friends cozy shopper as socializer", () => {
    const answers = {
      style: "cozy", // socializer 3, explorer 1
      social: "friends", // socializer 3, killer 1
      motivation: "discovery", // explorer 3, socializer 1
    };
    // socializer = 7, explorer = 4, killer = 1
    expect(classifyBartleType(answers)).toBe("socializer");
  });

  it("classifies a bold friends deals shopper as killer", () => {
    const answers = {
      style: "bold", // killer 3, explorer 1
      social: "friends", // socializer 3, killer 1
      motivation: "deals", // achiever 3, killer 1
    };
    // killer = 5, achiever = 3, socializer = 3, explorer = 1
    expect(classifyBartleType(answers)).toBe("killer");
  });

  it("breaks ties deterministically (achiever > explorer > socializer > killer)", () => {
    // Construct a tie between achiever and explorer:
    // style: classic → achiever 3, socializer 1
    // social: solo → achiever 2, explorer 2
    // motivation: discovery → explorer 3, socializer 1
    // achiever = 5, explorer = 5, socializer = 2 → tie → achiever wins
    const answers = {
      style: "classic",
      social: "solo",
      motivation: "discovery",
    };
    expect(classifyBartleType(answers)).toBe("achiever");
  });

  it("classifyBartleTypeSafe returns the same valid result", () => {
    const answers = {
      style: "bold",
      social: "friends",
      motivation: "deals",
    };
    expect(classifyBartleTypeSafe(answers)).toBe(
      classifyBartleType(answers)
    );
  });

  it("classifyBartleTypeSafe returns null for incomplete answers", () => {
    expect(classifyBartleTypeSafe({ style: "bold" })).toBeNull();
  });

  it("ignores unknown option ids gracefully", () => {
    const answers = {
      style: "nonexistent",
      social: "friends",
      motivation: "deals",
    };
    // style contributes nothing; social + motivation still classify
    const result = classifyBartleType(answers);
    expect(result).not.toBeNull();
  });

  it("all 4 Bartle types are reachable through some answer combination", () => {
    const combos: Record<string, string>[] = [
      { style: "classic", social: "solo", motivation: "deals" }, // achiever
      { style: "trendy", social: "solo", motivation: "discovery" }, // explorer
      { style: "cozy", social: "friends", motivation: "discovery" }, // socializer
      { style: "bold", social: "friends", motivation: "deals" }, // killer
    ];
    const results = new Set(combos.map((c) => classifyBartleType(c)));
    expect(results.has("achiever")).toBe(true);
    expect(results.has("explorer")).toBe(true);
    expect(results.has("socializer")).toBe(true);
    expect(results.has("killer")).toBe(true);
  });
});
