import { describe, it, expect } from "vitest";
import { COLLEGE_FOOTBALL, WNBA, espnEventToItem, espnMatchNote, type EspnLeagueEvent } from "./espnLeagueData";

// Shapes as returned live by ESPN on 2026-09-26.
const team = (displayName: string, location: string, id: string) => ({ id, displayName, location, logo: `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png` });

const cfbLive: EspnLeagueEvent = {
  id: "401",
  date: "2026-09-26T00:00Z",
  status: { type: { state: "in", shortDetail: "Halftime", completed: false }, period: 2, displayClock: "0:00" } as never,
  competitions: [{
    competitors: [
      { homeAway: "home", score: "21", curatedRank: { current: 5 }, records: [{ type: "total", summary: "3-0" }], team: team("Indiana Hoosiers", "Indiana", "84") },
      { homeAway: "away", score: "10", curatedRank: { current: 99 }, records: [{ type: "total", summary: "2-0" }], team: team("Northwestern Wildcats", "Northwestern", "77") },
    ],
    venue: { fullName: "Memorial Stadium (Bloomington, IN)" },
    broadcasts: [{ names: ["FOX"] }],
    notes: [],
  }],
};

const cfbPre: EspnLeagueEvent = {
  ...cfbLive,
  id: "402",
  date: "2026-09-26T23:30Z",
  status: { type: { state: "pre", shortDetail: "9/26 - 7:30 PM EDT", completed: false } } as never,
  competitions: [{
    ...cfbLive.competitions[0],
    competitors: [
      { homeAway: "home", curatedRank: { current: 14 }, records: [{ type: "total", summary: "3-0" }], team: team("Tennessee Volunteers", "Tennessee", "2633") },
      { homeAway: "away", curatedRank: { current: 1 }, records: [{ type: "total", summary: "3-0" }], team: team("Texas Longhorns", "Texas", "251") },
    ],
  }],
};

const wnbaPlayoff: EspnLeagueEvent = {
  id: "501",
  date: "2026-09-27T18:00Z",
  status: { type: { state: "pre", shortDetail: "9/27 - 2:00 PM EDT", completed: false } } as never,
  competitions: [{
    competitors: [
      { homeAway: "home", records: [{ type: "total", summary: "33-11" }], team: team("Minnesota Lynx", "Minnesota", "8") },
      { homeAway: "away", records: [{ type: "total", summary: "26-18" }], team: team("New York Liberty", "New York", "9") },
    ],
    venue: { fullName: "Target Center" },
    broadcasts: [{ names: ["ABC"] }],
    notes: [{ headline: "First Round - Game 1" }],
    series: { summary: "Series starts 9/27" },
  }],
};

describe("espnEventToItem", () => {
  it("keeps a live college game scheduled with its running score and clock", () => {
    const item = espnEventToItem(cfbLive, COLLEGE_FOOTBALL)!;
    expect(item).toMatchObject({
      category: "college-football",
      sourceName: "ESPN College Football",
      leagueLabel: "College Football",
      matchStatus: "scheduled",
      homeScore: 21,
      awayScore: 10,
      homeRecord: "3-0",
      broadcast: "FOX",
      venue: "Memorial Stadium (Bloomington, IN)",
      dedupeKey: "espn-cfb-401",
      matchNote: "No. 5 Indiana",
    });
    expect(item.matchClock).toBeTruthy();
  });

  it("dates a US night game in Eastern time, not the next UTC day", () => {
    const item = espnEventToItem(cfbPre, COLLEGE_FOOTBALL)!;
    expect(item.title).toBe("Preview: Tennessee Volunteers vs Texas Longhorns — Sep 26");
    expect(item.body).toContain("No. 14 Tennessee Volunteers face No. 1 Texas Longhorns in college football");
    expect(item.body).toMatch(/Kickoff is Sat, Sep 26, 2026, 7:30 PM EDT/);
    expect(item.matchNote).toBe("No. 14 Tennessee · No. 1 Texas");
  });

  it("writes a final with the winner", () => {
    const final = { ...cfbLive, status: { type: { state: "post", shortDetail: "Final", completed: true } } as never };
    const item = espnEventToItem(final, COLLEGE_FOOTBALL)!;
    expect(item.title).toBe("Indiana Hoosiers 21-10 Northwestern Wildcats");
    expect(item.matchStatus).toBe("finished");
    expect(item.body).toContain("Indiana Hoosiers won 21-10.");
    expect(item.matchClock).toBeNull();
  });

  it("carries the WNBA playoff round and series status", () => {
    const item = espnEventToItem(wnbaPlayoff, WNBA)!;
    expect(item).toMatchObject({ category: "wnba", leagueLabel: "WNBA", dedupeKey: "espn-wnba-501", matchNote: "First Round - Game 1 · Series starts 9/27" });
    expect(item.body).toContain("Tip-off is");
    expect(item.sourceUrl).toBe("https://www.espn.com/wnba/game/_/gameId/501");
  });

  it("skips events without both teams or a known state", () => {
    expect(espnEventToItem({ ...wnbaPlayoff, status: { type: { state: "postponed" } } as never }, WNBA)).toBeNull();
    expect(espnEventToItem({ ...wnbaPlayoff, competitions: [{ competitors: [] }] }, WNBA)).toBeNull();
  });
});

describe("espnMatchNote", () => {
  it("never shows ranks for an unranked matchup or for the WNBA", () => {
    const unranked = { ...cfbLive, competitions: [{ ...cfbLive.competitions[0], competitors: cfbLive.competitions[0].competitors.map((c) => ({ ...c, curatedRank: { current: 99 } })) }] };
    expect(espnMatchNote(unranked, COLLEGE_FOOTBALL)).toBeUndefined();
    expect(espnMatchNote({ ...wnbaPlayoff, competitions: [{ ...wnbaPlayoff.competitions[0], notes: [], series: undefined }] }, WNBA)).toBeUndefined();
  });
});
