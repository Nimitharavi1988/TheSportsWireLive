import { describe, it, expect } from "vitest";
import { deriveState, toScoreMatch, type MatchRow } from "./scoreboardModel";

const now = new Date("2026-09-27T19:00:00Z");
const hours = (h: number) => new Date(now.getTime() + h * 3600_000);

function row(overrides: Partial<MatchRow>): MatchRow {
  return {
    id: "a1",
    slug: "bills-chargers",
    title: "Preview: Buffalo Bills vs Los Angeles Chargers — Sep 27",
    summary: "Buffalo Bills face Los Angeles Chargers in the NFL on Sep 27.",
    category: "american-football",
    sourceName: "ESPN NFL",
    homeTeam: "Buffalo Bills",
    awayTeam: "Los Angeles Chargers",
    homeCrestUrl: null,
    awayCrestUrl: null,
    homeScore: null,
    awayScore: null,
    homeScoreText: null,
    awayScoreText: null,
    matchStatus: "scheduled",
    kickoffAt: hours(-2),
    updatedAt: now,
    venue: "Highmark Stadium, Orchard Park, NY",
    seriesLabel: null,
    leagueLabel: "NFL · Week 3",
    matchClock: null,
    matchNote: null,
    homeRecord: "2-0",
    awayRecord: "0-2",
    broadcast: "FOX",
    ...overrides,
  };
}

describe("deriveState", () => {
  it("reads finished as final and future kickoffs as upcoming", () => {
    expect(deriveState(row({ matchStatus: "finished" }), now)).toBe("final");
    expect(deriveState(row({ kickoffAt: hours(3) }), now)).toBe("upcoming");
  });

  it("treats a started game as live inside the window, unknown after it", () => {
    expect(deriveState(row({ kickoffAt: hours(-2) }), now)).toBe("live");
    expect(deriveState(row({ kickoffAt: hours(-6) }), now)).toBeNull();
    expect(deriveState(row({ kickoffAt: hours(-6), matchClock: "OT · 2:00" }), now)).toBe("live");
  });

  it("keeps cricket live only while its source keeps updating it", () => {
    const test = { category: "cricket", sourceName: "CricketData.org", kickoffAt: hours(-50) };
    expect(deriveState(row({ ...test, updatedAt: hours(-0.5) }), now)).toBe("live");
    expect(deriveState(row({ ...test, updatedAt: hours(-3) }), now)).toBeNull();
  });
});

describe("toScoreMatch", () => {
  it("builds a live card with clock, scores and no winner yet", () => {
    const m = toScoreMatch(row({ homeScore: 24, awayScore: 17, matchClock: "Q3 · 8:42" }), now)!;
    expect(m).toMatchObject({ state: "live", clock: "Q3 · 8:42", leagueLabel: "NFL · Week 3", broadcast: null });
    expect(m.home).toMatchObject({ score: "24", record: "2-0", winner: false });
    expect(m.away).toMatchObject({ score: "17", winner: false });
  });

  it("marks the winner on a final and drops the clock", () => {
    const m = toScoreMatch(row({ matchStatus: "finished", homeScore: 14, awayScore: 35, matchClock: "Q4 · 0:10" }), now)!;
    expect(m.clock).toBeNull();
    expect(m.home.winner).toBe(false);
    expect(m.away.winner).toBe(true);
  });

  it("shows TV and no scores for an upcoming game", () => {
    const m = toScoreMatch(row({ kickoffAt: hours(4), homeScore: 0, awayScore: 0 }), now)!;
    expect(m).toMatchObject({ state: "upcoming", broadcast: "FOX" });
    expect(m.home.score).toBeNull();
  });

  it("uses cricket score text and reads the winner from the result note", () => {
    const m = toScoreMatch(
      row({
        category: "cricket",
        sourceName: "CricketData.org",
        homeTeam: "England",
        awayTeam: "Sri Lanka",
        matchStatus: "finished",
        homeScoreText: "301/7 (50 ov)",
        awayScoreText: "276 (48.3 ov)",
        matchNote: "England won by 25 runs",
        leagueLabel: null,
        seriesLabel: "England vs Sri Lanka • ODI",
      }),
      now
    )!;
    expect(m.home).toMatchObject({ score: "301/7 (50 ov)", winner: true });
    expect(m.away.winner).toBe(false);
    expect(m.leagueLabel).toBe("England vs Sri Lanka • ODI");
    expect(m.note).toBe("England won by 25 runs");
  });

  it("falls back to the status in an older CricketData summary", () => {
    const m = toScoreMatch(
      row({
        category: "cricket",
        sourceName: "CricketData.org",
        homeTeam: "Yorkshire",
        awayTeam: "Somerset",
        matchStatus: "finished",
        homeScoreText: "212 & 275",
        awayScoreText: "201 & 101",
        summary: "Yorkshire won by 185 runs. yorkshire Inning 1: 212/10 (65.4 ov)",
        title: "Yorkshire vs Somerset, 63rd Match, County Championship Division One 2026",
        leagueLabel: null,
      }),
      now
    )!;
    expect(m.note).toBe("Yorkshire won by 185 runs");
    expect(m.home.winner).toBe(true);
    expect(m.leagueLabel).toBe("County Championship Division One 2026");
  });

  it("skips rows without both teams or with an unknown state", () => {
    expect(toScoreMatch(row({ awayTeam: null }), now)).toBeNull();
    expect(toScoreMatch(row({ kickoffAt: hours(-8) }), now)).toBeNull();
  });
});
