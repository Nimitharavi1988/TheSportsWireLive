import { describe, it, expect } from "vitest";
import { mergeMatches, needsLiveUpdate } from "./liveUpdates";
import type { ScoreMatch } from "./scoreboardModel";

const NOW = Date.parse("2026-09-26T18:00:00Z");
const side = { name: "A", crestUrl: null, score: null, record: null, winner: false };
const m = (id: string, state: ScoreMatch["state"], kickoffAt: string | null = null): ScoreMatch => ({
  id, slug: id, sport: "hockey", leagueLabel: "NHL", state, clock: null, note: null, kickoffAt, venue: null, broadcast: null, home: side, away: side, matchKey: null, source: "ESPN", updatedAt: "2026-09-26T18:00:00Z",
});

describe("needsLiveUpdate", () => {
  it("watches games in play and ones about to start", () => {
    expect(needsLiveUpdate(m("a", "live"), NOW)).toBe(true);
    expect(needsLiveUpdate(m("b", "paused"), NOW)).toBe(true);
    expect(needsLiveUpdate(m("h", "started"), NOW)).toBe(true);
    expect(needsLiveUpdate(m("c", "upcoming", "2026-09-26T18:10:00Z"), NOW)).toBe(true);
    expect(needsLiveUpdate(m("d", "upcoming", "2026-09-26T17:50:00Z"), NOW)).toBe(true);
  });

  it("ignores finals and games starting later", () => {
    expect(needsLiveUpdate(m("e", "final"), NOW)).toBe(false);
    expect(needsLiveUpdate(m("f", "upcoming", "2026-09-26T20:00:00Z"), NOW)).toBe(false);
    expect(needsLiveUpdate(m("g", "upcoming", null), NOW)).toBe(false);
  });
});

describe("mergeMatches", () => {
  it("replaces updated cards and keeps the rest in order", () => {
    const merged = mergeMatches([m("a", "live"), m("b", "upcoming")], [m("a", "final")]);
    expect(merged.map((x) => `${x.id}:${x.state}`)).toEqual(["a:final", "b:upcoming"]);
  });
});
