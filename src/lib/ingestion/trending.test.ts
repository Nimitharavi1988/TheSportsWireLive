import { describe, it, expect } from "vitest";
import { computeTrendingScore } from "./trending";

describe("computeTrendingScore", () => {
  it("returns 0 for a title matching nothing", () => {
    expect(computeTrendingScore("A quiet Tuesday in the lower leagues", [])).toBe(0);
  });

  it("adds 10 per matching Google Trends keyword", () => {
    // "goalkeeper" avoids also tripping the superstar/event-keyword bonuses,
    // keeping this test isolated to the Trends signal alone.
    expect(computeTrendingScore("Backup goalkeeper starts tonight", ["goalkeeper"])).toBe(10);
    expect(
      computeTrendingScore("Backup goalkeeper and referee clash", ["goalkeeper", "referee"])
    ).toBe(20);
  });

  it("adds 8 for an event-type keyword (transfer/record/death) regardless of trends", () => {
    expect(computeTrendingScore("Player confirms transfer to new club", [])).toBe(8);
    expect(computeTrendingScore("Star sets new scoring record", [])).toBe(8);
  });

  it("adds 5 for a superstar player mention", () => {
    // Uses the real SUPERSTAR_SEARCH_TERMS list (players.ts) — Messi is on
    // it, an arbitrary unlisted name is not.
    expect(computeTrendingScore("Messi trains ahead of derby", [])).toBe(5);
    expect(computeTrendingScore("A completely unremarkable reserve player trains", [])).toBe(0);
  });

  it("adds weighted Reddit engagement when a tracked club/player term matches", () => {
    const engagement = new Map([["manchester city", 12]]);
    expect(computeTrendingScore("Manchester City win again", [], engagement)).toBe(12);
  });

  it("ignores Reddit engagement entries that don't match the title", () => {
    const engagement = new Map([["chelsea", 9]]);
    expect(computeTrendingScore("Arsenal win the derby", [], engagement)).toBe(0);
  });

  it("stacks all four signals when a title matches every kind", () => {
    // Trends keyword (+10) + event keyword "transfer" (+8) + superstar
    // "Messi" (+5) + Reddit engagement on "Messi" (+7) = 30.
    const engagement = new Map([["messi", 7]]);
    const score = computeTrendingScore("Messi confirms shock transfer", ["messi"], engagement);
    expect(score).toBe(10 + 8 + 5 + 7);
  });

  it("matching is case-insensitive throughout", () => {
    expect(computeTrendingScore("MESSI SIGNS NEW DEAL", ["messi"])).toBeGreaterThan(0);
  });
});
