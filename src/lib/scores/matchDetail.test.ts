import { describe, it, expect } from "vitest";
import { matchDetailKey, needsDetailFetch } from "./matchDetail";

const NOW = new Date("2026-10-01T05:00:00Z");
const at = (iso: string) => new Date(iso);

describe("matchDetailKey", () => {
  it("is keyed by the match's article id", () => {
    expect(matchDetailKey("abc123")).toBe("match-detail:abc123");
  });
});

describe("needsDetailFetch", () => {
  it("waits for the match to start (a few minutes of slack for early data)", () => {
    expect(needsDetailFetch({ matchStatus: "scheduled", kickoffAt: at("2026-10-01T06:00:00Z") }, null, NOW)).toBe(false);
    expect(needsDetailFetch({ matchStatus: "scheduled", kickoffAt: at("2026-10-01T05:03:00Z") }, null, NOW)).toBe(true);
    expect(needsDetailFetch({ matchStatus: "scheduled", kickoffAt: null }, null, NOW)).toBe(false);
  });
  it("refreshes a match in play on every run, whatever is stored", () => {
    const row = { matchStatus: "scheduled", kickoffAt: at("2026-10-01T04:30:00Z") };
    expect(needsDetailFetch(row, null, NOW)).toBe(true);
    expect(needsDetailFetch(row, { final: false }, NOW)).toBe(true);
  });
  it("takes one copy after a match finishes, then stops", () => {
    const row = { matchStatus: "finished", kickoffAt: at("2026-10-01T00:00:00Z") };
    expect(needsDetailFetch(row, null, NOW)).toBe(true);
    // The stored copy was taken while it was still being played: take the final one.
    expect(needsDetailFetch(row, { final: false }, NOW)).toBe(true);
    expect(needsDetailFetch(row, { final: true }, NOW)).toBe(false);
  });
});
