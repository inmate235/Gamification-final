import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn() utility", () => {
  it("merges plain class strings", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("resolves conditional classes", () => {
    expect(cn("base", false && "no", true && "yes")).toBe("base yes");
  });

  it("dedupes conflicting Tailwind classes (last wins)", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined and null gracefully", () => {
    expect(cn("base", undefined, null, "tail")).toBe("base tail");
  });
});
