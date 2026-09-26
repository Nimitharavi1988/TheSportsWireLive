import { describe, it, expect } from "vitest";
import { applyLiveCricket, liveCricketFromEspn } from "./cricketRealtime";
import type { ScoreMatch } from "./scoreboardModel";

// ESPN payload shape as returned live on 2026-09-26.
const espn = {
  sports: [{ leagues: [{ name: "County Championship Division One", events: [{
    id: "1", date: "2026-09-24T09:30:00Z", endDate: "2026-09-27T17:00:00Z", status: "in",
    fullStatus: { longSummary: "Leicestershire trail by 150 runs", dayNumber: 3 },
    competitors: [
      { homeAway: "home" as const, displayName: "Warwickshire", score: "372" },
      { homeAway: "away" as const, displayName: "Leicestershire", score: "125 & 97/3 (30 ov)" },
    ],
  }] }] }],
};

// A CricketData-stored card for the same match, teams in the opposite order.
const side = (name: string, score: string | null) => ({ name, crestUrl: null, score, record: null, winner: false });
const card: ScoreMatch = {
  id: "a", slug: "a", sport: "cricket", leagueLabel: "County Championship", state: "paused", clock: "Stumps · Day 2",
  note: "Day 2: Stumps", kickoffAt: "2026-09-24T09:30:00.000Z", venue: null, broadcast: null,
  home: side("Leicestershire", "125 & 55/3 (13)"), away: side("Warwickshire", "372"),
  matchKey: "cricket:2026-09-24:leicestershire-v-warwickshire", source: "CricketData.org", updatedAt: "2026-09-26T00:00:00Z",
};

describe("cricket real-time layer", () => {
  it("updates a card from the other provider, mapping scores by team", () => {
    const live = liveCricketFromEspn(espn);
    const m = applyLiveCricket(card, live, "2026-09-26T10:00:00Z");
    expect(m.state).toBe("live");
    expect(m.home.score).toBe("125 & 97/3 (30 ov)");
    expect(m.away.score).toBe("372");
    expect(m.clock).toBe("Day 3");
    expect(m.updatedAt).toBe("2026-09-26T10:00:00Z");
  });

  it("leaves unmatched and non-cricket cards alone", () => {
    const live = liveCricketFromEspn(espn);
    const other = { ...card, matchKey: "cricket:2026-09-24:kent-v-essex" };
    expect(applyLiveCricket(other, live, "x")).toBe(other);
    expect(applyLiveCricket({ ...card, sport: "hockey" }, live, "x").state).toBe("paused");
  });
});
