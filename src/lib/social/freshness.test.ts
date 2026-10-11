import { describe, it, expect } from "vitest";
import { FRESHNESS_HALF_LIFE_HOURS, freshnessMultiplier } from "./freshness";

const now = new Date("2026-10-05T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("freshnessMultiplier", () => {
  it("is 1 for a story published now, in the future or with no date", () => {
    expect(freshnessMultiplier(now, now)).toBe(1);
    expect(freshnessMultiplier(hoursAgo(-5), now)).toBe(1);
    expect(freshnessMultiplier(null, now)).toBe(1);
    expect(freshnessMultiplier(undefined, now)).toBe(1);
  });
  it("halves every half-life", () => {
    expect(freshnessMultiplier(hoursAgo(FRESHNESS_HALF_LIFE_HOURS), now)).toBeCloseTo(0.5, 5);
    expect(freshnessMultiplier(hoursAgo(FRESHNESS_HALF_LIFE_HOURS * 2), now)).toBeCloseTo(0.25, 5);
  });
  it("makes an hour-old story outrank a 20-hour-old one with the same score", () => {
    expect(freshnessMultiplier(hoursAgo(1), now)).toBeGreaterThan(freshnessMultiplier(hoursAgo(20), now) * 5);
  });
  it("ignores an invalid date", () => {
    expect(freshnessMultiplier(new Date("nope"), now)).toBe(1);
  });
});

describe("reelIsFresh", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  it("allows a story from the last day and refuses an older one", async () => {
    const { reelIsFresh, reelMaxAgeHours } = await import("./freshness");
    expect(reelIsFresh(hoursAgo(1), null, now, 24)).toBe(true);
    expect(reelIsFresh(hoursAgo(23), null, now, 24)).toBe(true);
    expect(reelIsFresh(hoursAgo(30), null, now, 24)).toBe(false);
    expect(reelIsFresh(null, hoursAgo(120), now, 24)).toBe(false); // falls back to created
    expect(reelIsFresh(hoursAgo(500), null, now, 0)).toBe(true); // 0 = rule off
    expect(reelMaxAgeHours({})).toBe(6);
    expect(reelMaxAgeHours({ REEL_MAX_AGE_HOURS: "6" })).toBe(6);
    expect(reelMaxAgeHours({ REEL_MAX_AGE_HOURS: "x" })).toBe(6);
  });
});

describe("per-Page reel age limits", () => {
  it("gives Football, Spanish and Fight 12 hours and everything else 6", async () => {
    const { reelMaxAgeHours } = await import("./freshness");
    expect(reelMaxAgeHours({}, "football")).toBe(12);
    expect(reelMaxAgeHours({}, "es")).toBe(12);
    expect(reelMaxAgeHours({}, "fight")).toBe(12);
    expect(reelMaxAgeHours({}, "india-cricket")).toBe(6);
    expect(reelMaxAgeHours({})).toBe(6);
    expect(reelMaxAgeHours({ REEL_MAX_AGE_HOURS: "3" }, "football")).toBe(3); // the variable wins everywhere
  });
});

describe("star stories keep their freshness", () => {
  it("a Messi or Ronaldo story is ranked as at most an hour old", () => {
    expect(freshnessMultiplier(hoursAgo(20), now, "Messi scores again")).toBeCloseTo(freshnessMultiplier(hoursAgo(1), now), 5);
    expect(freshnessMultiplier(hoursAgo(20), now, "Cristiano Ronaldo signs")).toBeGreaterThan(0.85);
  });
  it("other stories, and Messina or Ronaldinho, decay as usual", () => {
    expect(freshnessMultiplier(hoursAgo(20), now, "Messina sign a striker")).toBeLessThan(0.15);
    expect(freshnessMultiplier(hoursAgo(20), now, "Ronaldinho tribute")).toBeLessThan(0.15);
    expect(freshnessMultiplier(hoursAgo(20), now)).toBeLessThan(0.15);
  });
  it("a brand-new story is unaffected", () => {
    expect(freshnessMultiplier(now, now, "Messi scores again")).toBe(1);
  });
});

describe("star stories and the reel age limit", () => {
  it("isStarStory matches Messi, Ronaldo and Cristiano as whole words only", async () => {
    const { isStarStory } = await import("./freshness");
    expect(isStarStory("Messi scores again")).toBe(true);
    expect(isStarStory("Cristiano Ronaldo hits 950 goals")).toBe(true);
    expect(isStarStory("Messina sign a striker")).toBe(false);
    expect(isStarStory("Ronaldinho tribute match")).toBe(false);
    expect(isStarStory(null)).toBe(false);
  });
});
