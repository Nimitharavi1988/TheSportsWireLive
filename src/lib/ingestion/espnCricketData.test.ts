import { describe, it, expect } from "vitest";
import { espnCricketEventToItem, type EspnCricketEvent } from "./espnCricketData";

// Shapes as returned live by ESPN on 2026-09-26.
const asianGames: EspnCricketEvent = {
  id: "1552770",
  date: "2026-09-26T00:00:00Z",
  endDate: "2026-09-26T00:00:00Z",
  status: "in",
  summary: "Nepal need 20 runs from 18 balls",
  location: "Korogi Sports Park, Nisshin",
  fullStatus: { longSummary: "Nepal need 20 runs from 18 balls", dayNumber: 1 },
  competitors: [
    { homeAway: "home", displayName: "Japan", score: "168/7 (20 ov)", logo: "https://a.espncdn.com/i/teamlogos/cricket/500/32.png" },
    { homeAway: "away", displayName: "Nepal", score: "149/4 (17 ov)", logo: "https://a.espncdn.com/i/teamlogos/cricket/500/33.png" },
  ],
};

describe("espnCricketEventToItem", () => {
  it("maps a live international with text scores and the status line", () => {
    const item = espnCricketEventToItem(asianGames, "Asian Games Men's Cricket Competition")!;
    expect(item).toMatchObject({
      title: "Japan vs Nepal, Asian Games Men's Cricket Competition",
      sourceName: "ESPN Cricket",
      category: "cricket",
      homeTeam: "Japan",
      awayTeam: "Nepal",
      homeScoreText: "168/7 (20 ov)",
      awayScoreText: "149/4 (17 ov)",
      matchStatus: "scheduled",
      matchNote: "Nepal need 20 runs from 18 balls",
      dedupeKey: "espn-cricket-1552770",
    });
  });

  it("treats a result line as finished even while ESPN still says in", () => {
    const item = espnCricketEventToItem({ ...asianGames, fullStatus: { longSummary: "No result" }, summary: "No result" }, "Asian Games")!;
    expect(item.matchStatus).toBe("finished");
  });

  it("prefixes the day on a multi-day match, so stumps read as paused", () => {
    const county = { ...asianGames, endDate: "2026-09-27T17:00:00Z", fullStatus: { longSummary: "Stumps - Kent lead by 97 runs", dayNumber: 2 } };
    expect(espnCricketEventToItem(county, "County Championship")!.matchNote).toBe("Day 2: Stumps - Kent lead by 97 runs");
  });

  it("carries no scores before the start", () => {
    const pre = { ...asianGames, status: "pre", competitors: asianGames.competitors.map((c) => ({ ...c, score: "" })) };
    const item = espnCricketEventToItem(pre, "Asian Games")!;
    expect(item.homeScoreText).toBeUndefined();
    expect(item.matchNote).toBeNull();
  });
});

describe("espnCricketEventToItem edge cases (seen live 2026-09-26)", () => {
  it("skips a knockout slot whose teams are still TBA", () => {
    const tba = { ...asianGames, competitors: asianGames.competitors.map((c) => ({ ...c, displayName: "TBA" })) };
    expect(espnCricketEventToItem(tba, "Asian Games")).toBeNull();
  });

  it("treats an empty logo as no logo", () => {
    const noLogo = { ...asianGames, competitors: asianGames.competitors.map((c) => ({ ...c, logo: "" })) };
    const item = espnCricketEventToItem(noLogo, "Asian Games")!;
    expect(item.homeCrestUrl).toBeUndefined();
    expect(item.awayCrestUrl).toBeUndefined();
  });

  it("an 'in' event that hasn't begun has no scores but keeps its status line", () => {
    const delayed = {
      ...asianGames,
      status: "in",
      summary: "Match scheduled to begin at 14:00 local time (13:00 GMT)",
      fullStatus: { longSummary: "Match scheduled to begin at 14:00 local time (13:00 GMT)", dayNumber: 1 },
      competitors: asianGames.competitors.map((c) => ({ ...c, score: "" })),
    };
    const item = espnCricketEventToItem(delayed, "Asian Games")!;
    expect(item.homeScoreText).toBeUndefined();
    expect(item.matchStatus).toBe("scheduled");
    expect(item.matchNote).toBe("Match scheduled to begin at 14:00 local time (13:00 GMT)");
  });
});
