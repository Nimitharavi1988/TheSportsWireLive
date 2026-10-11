import { describe, expect, it } from "vitest";
import { isPredictable, isPredictionClosed, matchOutcome, predictionOptions } from "./predictions";

const base = { homeTeam: "Arsenal", awayTeam: "Chelsea", leagueLabel: "Premier League", seriesLabel: null };

describe("isPredictable", () => {
  it("accepts tier 1 and 2 competitions", () => {
    expect(isPredictable({ ...base, category: "football" })).toBe(true);
    expect(isPredictable({ ...base, category: "american-football", leagueLabel: "NFL · Week 4" })).toBe(true);
    expect(isPredictable({ ...base, category: "college-football", leagueLabel: "College Football" })).toBe(true);
  });
  it("skips women's fixtures, minor leagues and minor cricket sides", () => {
    expect(isPredictable({ ...base, category: "football", homeTeam: "Canada Women", awayTeam: "Denmark Women", leagueLabel: "Women's International Friendly" })).toBe(false);
    expect(isPredictable({ ...base, category: "football", leagueLabel: "Liga Profesional Argentina" })).toBe(false);
    expect(isPredictable({ ...base, category: "football", leagueLabel: "Liga MX" })).toBe(true);
    expect(isPredictable({ ...base, category: "cricket", homeTeam: "Oman", awayTeam: "Nepal", leagueLabel: "ICC Men's Cricket World Cup League 2" })).toBe(false);
  });
  it("skips minor competitions, minor cricket and missing teams", () => {
    expect(isPredictable({ ...base, category: "volleyball", leagueLabel: "Club Friendly" })).toBe(false);
    expect(isPredictable({ ...base, category: "cricket", leagueLabel: "South Africa Domestic T20/Pro20" })).toBe(false);
    expect(isPredictable({ ...base, category: "football", homeTeam: null })).toBe(false);
    expect(isPredictable({ ...base, category: "football", awayTeam: "arsenal" })).toBe(false);
  });
  it("accepts senior international cricket", () => {
    expect(isPredictable({ ...base, category: "cricket", homeTeam: "India", awayTeam: "West Indies", leagueLabel: "West Indies tour of India 2026/27 T20I" })).toBe(true);
  });
});

describe("predictionOptions", () => {
  it("adds a draw only for football", () => {
    expect(predictionOptions("Arsenal", "Chelsea", "football").map((o) => o.outcome)).toEqual(["home", "draw", "away"]);
    expect(predictionOptions("Chiefs", "Bills", "american-football").map((o) => o.outcome)).toEqual(["home", "away"]);
    expect(predictionOptions("India", "Pakistan", "cricket").map((o) => o.outcome)).toEqual(["home", "away"]);
  });
});

describe("matchOutcome", () => {
  const score = (category: string, homeScore: number | null, awayScore: number | null) =>
    matchOutcome({ category, homeTeam: "A", awayTeam: "B", homeScore, awayScore, matchNote: null });
  it("reads scores for non-cricket sports", () => {
    expect(score("football", 2, 1)).toBe("home");
    expect(score("football", 0, 3)).toBe("away");
    expect(score("football", 1, 1)).toBe("draw");
    expect(score("basketball", null, 90)).toBeNull();
  });
  it("reads the result line for cricket", () => {
    const cricket = (matchNote: string | null) =>
      matchOutcome({ category: "cricket", homeTeam: "India", awayTeam: "West Indies", homeScore: null, awayScore: null, matchNote });
    expect(cricket("India won by 14 runs")).toBe("home");
    expect(cricket("West Indies won by 3 wickets (with 21 balls remaining)")).toBe("away");
    expect(cricket("Match tied")).toBeNull();
    expect(cricket("No result")).toBeNull();
    expect(cricket(null)).toBeNull();
  });
  it("voids when team names do not match the result line", () => {
    expect(matchOutcome({ category: "cricket", homeTeam: "Titans Women", awayTeam: "Lions Women", homeScore: null, awayScore: null, matchNote: "Titans WMN won by 10 wickets" })).toBeNull();
  });
});

describe("isPredictionClosed", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const before = new Date("2026-10-11T11:00:00Z");
  const after = new Date("2026-10-11T13:00:00Z");
  it("takes picks until kickoff, then closes", () => {
    expect(isPredictionClosed({ kind: "prediction", resolvedAt: null }, after, now)).toBe(false);
    expect(isPredictionClosed({ kind: "prediction", resolvedAt: null }, before, now)).toBe(true);
  });
  it("is closed once resolved, and never closes editorial polls", () => {
    expect(isPredictionClosed({ kind: "prediction", resolvedAt: now }, after, now)).toBe(true);
    expect(isPredictionClosed({ kind: "editorial", resolvedAt: null }, before, now)).toBe(false);
  });
});
