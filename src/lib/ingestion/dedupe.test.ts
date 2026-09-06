import { describe, it, expect } from "vitest";
import { computeDedupeHash } from "./dedupe";

describe("computeDedupeHash", () => {
  it("produces the same hash for the same title and day, regardless of exact time", () => {
    const a = computeDedupeHash("Arsenal beat Chelsea 2-1", new Date("2026-09-06T08:00:00Z"));
    const b = computeDedupeHash("Arsenal beat Chelsea 2-1", new Date("2026-09-06T22:00:00Z"));
    expect(a).toBe(b);
  });

  it("is case- and punctuation-insensitive", () => {
    const a = computeDedupeHash("Arsenal beat Chelsea, 2-1!", new Date("2026-09-06T08:00:00Z"));
    const b = computeDedupeHash("arsenal beat chelsea 21", new Date("2026-09-06T08:00:00Z"));
    expect(a).toBe(b);
  });

  it("produces a different hash for a different day", () => {
    const a = computeDedupeHash("Arsenal beat Chelsea 2-1", new Date("2026-09-06T08:00:00Z"));
    const b = computeDedupeHash("Arsenal beat Chelsea 2-1", new Date("2026-09-07T08:00:00Z"));
    expect(a).not.toBe(b);
  });

  it("produces a different hash for a different title", () => {
    const a = computeDedupeHash("Arsenal beat Chelsea 2-1", new Date("2026-09-06T08:00:00Z"));
    const b = computeDedupeHash("Liverpool beat Everton 3-0", new Date("2026-09-06T08:00:00Z"));
    expect(a).not.toBe(b);
  });
});
