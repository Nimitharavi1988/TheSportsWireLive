import { describe, it, expect } from "vitest";
import { detectEvent, detectEvents, leagueWeight, matchPriority, EVENT_HOT_MS } from "./priority";
import type { ScoreMatch } from "./scoreboardModel";

const NOW = Date.parse("2026-09-30T18:00:00Z");
const side = (name: string, score: string | null) => ({ name, crestUrl: null, score, record: null, winner: false });
const m = (over: Partial<ScoreMatch> & { id: string }): ScoreMatch => ({
  slug: over.id, sport: "football", leagueLabel: "Premier League", state: "live", clock: "60'", note: null, kickoffAt: null, venue: null, broadcast: null,
  home: side("Arsenal", "1"), away: side("Chelsea", "1"), matchKey: null, source: "ESPN", updatedAt: "2026-09-30T18:00:00Z", ...over,
});

describe("leagueWeight", () => {
  it("ranks marquee competitions above minor ones", () => {
    expect(leagueWeight("UEFA Champions League")).toBeGreaterThan(leagueWeight("MLS"));
    expect(leagueWeight("MLS")).toBeGreaterThan(leagueWeight("NCAA Women's Volleyball"));
    expect(leagueWeight("NBA")).toBe(300);
  });
});

describe("marquee teams", () => {
  const cricket = (home: string, away: string, over: Partial<ScoreMatch> = {}) =>
    m({ id: home + away, sport: "cricket", leagueLabel: "West Indies tour of India 2026/27", home: side(home, null), away: side(away, null), ...over });
  it("ranks a finished India v West Indies above a live India A v Australia A", () => {
    const big = cricket("India", "West Indies", { state: "final" });
    const minor = cricket("India A", "Australia A", { state: "live", leagueLabel: "Australia A tour of India 2026/27" });
    expect(matchPriority(big, NOW)).toBeGreaterThan(matchPriority(minor, NOW));
  });
  it("does not count women, A sides or qualifiers", () => {
    expect(leagueWeight("ICC Men's T20 World Cup Sub Regional Asia Qualifier A 2026/27", "cricket")).toBe(100);
    expect(leagueWeight("Pakistan Women's Under-19s T20 Tri-Series", "cricket")).toBe(100);
    expect(leagueWeight("ICC Men's T20 World Cup", "cricket")).toBe(300);
  });
  it("keeps a marquee game days out but not a minor one", () => {
    const far = "2026-10-03T08:30:00Z";
    const big = cricket("India", "West Indies", { state: "upcoming", kickoffAt: far });
    const minor = cricket("Limpopo", "Dolphins", { state: "upcoming", kickoffAt: far, leagueLabel: "Domestic T20" });
    expect(matchPriority(big, NOW)).toBeLessThan(matchPriority(m({ id: "live-minor", sport: "cricket", leagueLabel: "Domestic T20" }), NOW));
    expect(matchPriority(big, NOW)).toBeGreaterThan(matchPriority(minor, NOW) + 500);
    expect(matchPriority(minor, NOW)).toBeLessThan(matchPriority(cricket("Limpopo", "Dolphins", { state: "final", leagueLabel: "Domestic T20" }), NOW) + 1);
  });
  it("lifts a big football derby", () => {
    const g = (h: string, a: string) => m({ id: h + a, home: side(h, "0"), away: side(a, "0") });
    expect(matchPriority(g("Liverpool FC", "Arsenal FC"), NOW)).toBeGreaterThan(matchPriority(g("Brentford", "Fulham"), NOW) + 1000);
  });
});

describe("marquee results age", () => {
  const big = (kickoffAt: string) => m({ id: "big" + kickoffAt, sport: "cricket", leagueLabel: "Tour", state: "final", kickoffAt, home: side("India", null), away: side("West Indies", null) });
  const live = m({ id: "live", sport: "baseball", leagueLabel: "MLB" });
  it("keeps a fresh marquee result above a live game", () => {
    expect(matchPriority(big("2026-09-30T12:00:00Z"), NOW)).toBeGreaterThan(matchPriority(live, NOW));
  });
  it("lets live games lead once the result is more than 12 hours old", () => {
    const old = big("2026-09-29T12:00:00Z");
    expect(matchPriority(old, NOW)).toBeLessThan(matchPriority(live, NOW));
    expect(matchPriority(old, NOW)).toBeGreaterThan(matchPriority(m({ id: "minor", state: "final", leagueLabel: "Domestic", home: side("Brentford", "1"), away: side("Fulham", "0") }), NOW));
  });
});

describe("matchPriority", () => {
  it("puts live above starting-soon above final", () => {
    const live = matchPriority(m({ id: "a" }), NOW);
    const soon = matchPriority(m({ id: "b", state: "upcoming", kickoffAt: "2026-09-30T19:00:00Z" }), NOW);
    const done = matchPriority(m({ id: "c", state: "final" }), NOW);
    expect(live).toBeGreaterThan(soon);
    expect(soon).toBeGreaterThan(done);
  });
  it("lets a big live game beat a minor live one, and a fresh event beat both", () => {
    const big = m({ id: "a", leagueLabel: "Premier League" });
    const minor = m({ id: "b", leagueLabel: "NCAA Men's Volleyball" });
    expect(matchPriority(big, NOW)).toBeGreaterThan(matchPriority(minor, NOW));
    const ev = { kind: "score" as const, label: "Goal", at: NOW - 1000 };
    expect(matchPriority(minor, NOW, ev)).toBeGreaterThan(matchPriority(big, NOW));
  });
  it("lets an event go cold", () => {
    const ev = { kind: "score" as const, label: "Goal", at: NOW - EVENT_HOT_MS - 1 };
    expect(matchPriority(m({ id: "a" }), NOW, ev)).toBe(matchPriority(m({ id: "a" }), NOW));
  });
});

describe("detectEvent", () => {
  it("flags a goal with the new score", () => {
    const ev = detectEvent(m({ id: "a" }), m({ id: "a", home: side("Arsenal", "2") }), NOW);
    expect(ev?.kind).toBe("score");
    expect(ev?.label).toBe("Goal · Arsenal 2–1 Chelsea");
  });
  it("flags kick-off and full time", () => {
    expect(detectEvent(m({ id: "a", state: "upcoming" }), m({ id: "a" }), NOW)?.kind).toBe("kickoff");
    expect(detectEvent(m({ id: "a" }), m({ id: "a", state: "final" }), NOW)?.kind).toBe("final");
  });
  it("ignores unchanged cards and basketball baskets", () => {
    expect(detectEvent(m({ id: "a" }), m({ id: "a" }), NOW)).toBeNull();
    const bb = { sport: "basketball", leagueLabel: "NBA" } as const;
    expect(detectEvent(m({ id: "a", ...bb }), m({ id: "a", ...bb, home: side("Arsenal", "3") }), NOW)).toBeNull();
  });
  it("flags a cricket wicket", () => {
    const c = { sport: "cricket", leagueLabel: "Test" } as const;
    const prev = m({ id: "a", ...c, home: side("England", "287/5 (48.2 ov)") });
    const next = m({ id: "a", ...c, home: side("England", "287/6 (48.3 ov)") });
    expect(detectEvent(prev, next, NOW)?.kind).toBe("wicket");
  });
});

describe("detectEvents", () => {
  it("only reports cards present in both polls", () => {
    const found = detectEvents([m({ id: "a" })], [m({ id: "a", home: side("Arsenal", "2") }), m({ id: "new" })], NOW);
    expect([...found.keys()]).toEqual(["a"]);
  });
});
