import { describe, it, expect } from "vitest";
import { pickHomeMatches } from "./homeMatches";
import type { MatchRow } from "./scores/scoreboardModel";

const NOW = new Date("2026-10-02T21:00:00Z");
const row = (id: string, category: string, league: string, home: string, away: string, kickoff: string, matchStatus: string | null = null): MatchRow => ({
  id, slug: id, title: id, summary: "", category, sourceName: "ESPN", scoreSource: null,
  homeTeam: home, awayTeam: away, homeCrestUrl: null, awayCrestUrl: null,
  homeScore: null, awayScore: null, homeScoreText: null, awayScoreText: null,
  matchStatus, kickoffAt: new Date(kickoff), updatedAt: NOW, venue: null, seriesLabel: null,
  leagueLabel: league, matchClock: null, matchNote: null, homeRecord: null, awayRecord: null, broadcast: null,
});

describe("pickHomeMatches", () => {
  // Ten minor cricket games listed first (as the trending order had them), then US and football games.
  const cricket = Array.from({ length: 10 }, (_, i) =>
    row(`c${i}`, "cricket", "CSA Women Pro50", `Women ${i}`, `Other ${i}`, "2026-10-03T05:00:00Z")
  );
  const others = [
    row("nhl1", "hockey", "NHL", "Detroit Red Wings", "New York Rangers", "2026-10-02T22:30:00Z"),
    row("nhl2", "hockey", "NHL", "Carolina Hurricanes", "Washington Capitals", "2026-10-02T23:00:00Z"),
    row("cfb1", "college-football", "College Football", "Virginia Tech Hokies", "Pittsburgh Panthers", "2026-10-02T23:00:00Z"),
    row("nl1", "football", "UEFA Nations League", "Croatia", "England", "2026-10-03T16:00:00Z"),
  ];

  it("puts tonight's US games and the Nations League ahead of minor cricket", () => {
    const picked = pickHomeMatches([...cricket, ...others], 6, NOW, 3).map((r) => r.id);
    expect(picked.slice(0, 4).sort()).toEqual(["cfb1", "nhl1", "nhl2", "nl1"]);
  });

  it("caps a busy sport and fills the rest from what is left", () => {
    const picked = pickHomeMatches([...cricket, ...others], 10, NOW, 3);
    expect(picked).toHaveLength(10);
    expect(picked.filter((r) => r.category === "cricket")).toHaveLength(6); // 3 within the cap + 3 filled in
    const strict = pickHomeMatches([...cricket, ...others], 6, NOW, 3);
    expect(strict.filter((r) => r.category === "cricket")).toHaveLength(2);
  });

  it("returns fewer than the limit when there are fewer games, and skips rows without teams", () => {
    const noTeams = { ...others[0], id: "x", homeTeam: null };
    expect(pickHomeMatches([noTeams, others[1]], 10, NOW, 3).map((r) => r.id)).toEqual(["nhl2"]);
    expect(pickHomeMatches([], 10, NOW, 3)).toEqual([]);
  });
});
