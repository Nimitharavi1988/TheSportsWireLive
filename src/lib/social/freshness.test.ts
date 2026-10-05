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
