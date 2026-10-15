import { describe, expect, it } from "vitest";
import { isEventOver } from "./eventOver";

// The 2026 Asian Games season in eventTagging.ts is 2026-09-19 to 2026-10-04.
describe("isEventOver", () => {
  const key = "asian-games-2026";
  it("is not over while the Games run and through the grace days", () => {
    expect(isEventOver(key, new Date("2026-09-25T12:00:00Z"))).toBe(false);
    expect(isEventOver(key, new Date("2026-10-04T23:00:00Z"))).toBe(false);
    expect(isEventOver(key, new Date("2026-10-06T12:00:00Z"))).toBe(false);
  });
  it("is over once the grace days have passed", () => {
    expect(isEventOver(key, new Date("2026-10-07T12:00:00Z"))).toBe(true);
    expect(isEventOver(key, new Date("2026-10-15T12:00:00Z"))).toBe(true);
  });
  it("honours a different grace period", () => {
    expect(isEventOver(key, new Date("2026-10-06T12:00:00Z"), 1)).toBe(true);
    expect(isEventOver(key, new Date("2026-10-04T12:00:00Z"), 0)).toBe(false);
  });
  it("never reports an event with no known season as over", () => {
    expect(isEventOver("some-unknown-event", new Date("2030-01-01T00:00:00Z"))).toBe(false);
  });
});
