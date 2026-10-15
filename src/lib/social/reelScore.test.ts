import { describe, it, expect } from "vitest";
import { scoreStripFor } from "./reelScore";
import type { ScoreMatch } from "../scores/scoreboardModel";

const NOW = new Date("2026-10-15T20:00:00Z");
function match(over: Partial<Omit<ScoreMatch, "home" | "away">> & { home?: string; away?: string; hs?: string | null; as?: string | null; hoursAgo?: number }): ScoreMatch {
  const { home: _h, away: _a, hs: _hs, as: _as, hoursAgo: _ago, ...rest } = over;
  return {
    id: "m", slug: "m", sport: "cricket", leagueLabel: "India v West Indies", state: "final", clock: null, note: null,
    kickoffAt: new Date(NOW.getTime() - (over.hoursAgo ?? 4) * 3_600_000).toISOString(), venue: null, broadcast: null, matchKey: null, source: "x", updatedAt: NOW.toISOString(),
    home: { name: over.home ?? "India", crestUrl: null, score: over.hs === undefined ? "247/3" : over.hs, record: null, winner: false },
    away: { name: over.away ?? "West Indies", crestUrl: null, score: over.as === undefined ? "223" : over.as, record: null, winner: false },
    ...rest,
  } as ScoreMatch;
}

describe("scoreStripFor", () => {
  it("returns the score of the one match whose two sides the title names", () => {
    const s = scoreStripFor("West Indies stun India in Ranchi", [match({})], NOW);
    expect(s).toEqual({ home: "India", away: "West Indies", homeScore: "247/3", awayScore: "223", label: "FINAL", league: "India v West Indies" });
  });
  it("understands cricket abbreviations in the title", () => {
    expect(scoreStripFor("IND vs WI 4th T20I: who opens?", [match({})], NOW)).not.toBeNull();
  });
  it("needs both sides, not just one", () => {
    expect(scoreStripFor("India name squad for Australia tour", [match({})], NOW)).toBeNull();
  });
  it("shows the live clock, or LIVE (EN VIVO in Spanish) when there is none", () => {
    expect(scoreStripFor("India v West Indies live", [match({ state: "live", clock: "17.2 ov" })], NOW)?.label).toBe("17.2 ov");
    expect(scoreStripFor("India v West Indies live", [match({ state: "live", clock: null })], NOW)?.label).toBe("LIVE");
    expect(scoreStripFor("India v West Indies live", [match({ state: "live", clock: null })], NOW, "es")?.label).toBe("EN VIVO");
  });
  it("skips a match that has not started, has no score, or is too old", () => {
    expect(scoreStripFor("India v West Indies", [match({ state: "upcoming" })], NOW)).toBeNull();
    expect(scoreStripFor("India v West Indies", [match({ hs: null })], NOW)).toBeNull();
    expect(scoreStripFor("India v West Indies", [match({ hoursAgo: 30 })], NOW)).toBeNull();
  });
  it("leaves the strip off when two games of the same pairing are in the window (a series on consecutive days)", () => {
    expect(scoreStripFor("India v West Indies", [match({ hoursAgo: 4 }), match({ hoursAgo: 10, id: "m2" })], NOW)).toBeNull();
  });
  it("is unaffected by other matches in the list", () => {
    const other = match({ home: "Australia", away: "England", hs: "300", as: "250" });
    expect(scoreStripFor("West Indies stun India", [other, match({})], NOW)?.home).toBe("India");
  });
});
