import { describe, it, expect } from "vitest";
import { dayWindow, matchFits, parseMatchQuery } from "./matchQuery";
import type { ScoreMatch } from "./scoreboardModel";

describe("parseMatchQuery", () => {
  it("keeps team and competition words", () => {
    expect(parseMatchQuery("India West Indies")).toEqual({ words: ["india", "west", "indies"] });
    expect(parseMatchQuery("Real Sociedad")).toEqual({ words: ["real", "sociedad"] });
  });
  it("folds accents and drops filler like vs and scores", () => {
    expect(parseMatchQuery("Atlético vs Real Madrid scores")).toEqual({ words: ["atletico", "real", "madrid"] });
  });
  it("reads state, day and sport words", () => {
    expect(parseMatchQuery("live cricket")).toEqual({ words: [], state: "live", sport: "cricket" });
    expect(parseMatchQuery("arsenal fixtures")).toEqual({ words: ["arsenal"], state: "upcoming" });
    expect(parseMatchQuery("nba today")).toEqual({ words: [], sport: "basketball", day: "today" });
    expect(parseMatchQuery("man city results")).toEqual({ words: ["man", "city"], state: "final" });
    expect(parseMatchQuery("soccer tomorrow")).toEqual({ words: [], sport: "football", day: "tomorrow" });
  });
  it("is null when there is nothing to search on", () => {
    expect(parseMatchQuery("scores")).toBeNull();
    expect(parseMatchQuery("the vs a")).toBeNull();
    expect(parseMatchQuery("")).toBeNull();
  });
});

const side = (name: string) => ({ name, crestUrl: null, score: null, record: null, winner: false });
const game = (home: string, away: string, over: Partial<ScoreMatch> = {}): ScoreMatch => ({
  id: home + away, slug: "s", sport: "cricket", leagueLabel: "West Indies tour of India", state: "live", clock: null, note: null, kickoffAt: null, venue: null, broadcast: null,
  home: side(home), away: side(away), matchKey: null, source: "ESPN", updatedAt: "2026-09-30T00:00:00Z", ...over,
});

describe("matchFits", () => {
  const q = (s: string) => parseMatchQuery(s)!;
  it("matches words at the start of a team or competition name", () => {
    expect(matchFits(game("India", "West Indies"), q("india"))).toBe(true);
    expect(matchFits(game("Manchester United", "Fulham", { sport: "football", leagueLabel: "Premier League" }), q("man utd"))).toBe(true);
    expect(matchFits(game("Manchester United", "Fulham", { sport: "football", leagueLabel: "Premier League" }), q("man united"))).toBe(true);
    expect(matchFits(game("Romania", "Fiji"), q("man"))).toBe(false);
  });
  it("applies state and sport", () => {
    expect(matchFits(game("India", "West Indies"), q("live"))).toBe(true);
    expect(matchFits(game("India", "West Indies", { state: "final" }), q("live"))).toBe(false);
    expect(matchFits(game("India", "West Indies", { state: "final" }), q("india results"))).toBe(true);
    expect(matchFits(game("India", "West Indies"), q("football"))).toBe(false);
  });
});

describe("dayWindow", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  it("brackets today around now", () => {
    const w = dayWindow("today", now);
    expect(w.from).toBeLessThan(now);
    expect(w.to).toBeGreaterThan(now);
  });
  it("puts tomorrow ahead and yesterday behind", () => {
    expect(dayWindow("tomorrow", now).from).toBeGreaterThan(now);
    expect(dayWindow("yesterday", now).to).toBeLessThan(now);
  });
});
