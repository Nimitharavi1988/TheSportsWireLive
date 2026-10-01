import { describe, it, expect } from "vitest";
import { matchRefreshValues, placeholderResolution, supersedingRefreshValues } from "./matchRefresh";
import type { RawMatchItem } from "./footballData";

const now = new Date("2026-09-27T19:00:00Z");

function item(overrides: Partial<RawMatchItem>): RawMatchItem {
  return {
    title: "Preview: Buffalo Bills vs Los Angeles Chargers — Sep 27",
    summary: "Buffalo Bills face Los Angeles Chargers in the NFL on Sep 27.",
    body: "Kickoff is Sun, Sep 27.",
    sourceUrl: "https://www.espn.com/nfl/game/_/gameId/1",
    sourceName: "ESPN NFL",
    category: "american-football",
    publishedAt: now,
    homeTeam: "Buffalo Bills",
    awayTeam: "Los Angeles Chargers",
    kickoffAt: new Date("2026-09-27T17:00:00Z"),
    dedupeKey: "espn-nfl-1",
    ...overrides,
  };
}

describe("matchRefreshValues", () => {
  it("writes the running score and clock for a live game without touching its text", () => {
    const v = matchRefreshValues(item({ homeScore: 24, awayScore: 17, matchStatus: "scheduled", matchClock: "Q3 · 8:42" }), "scheduled", now);
    expect(v).toMatchObject({ homeScore: 24, awayScore: 17, matchClock: "Q3 · 8:42", matchStatus: "scheduled", updatedAt: now });
    expect(v).not.toHaveProperty("title");
    expect(v).not.toHaveProperty("summary");
    expect(v.matchKey).toBe("american-football:2026-09-27:buffalo-bills-v-los-angeles-chargers");
  });

  it("rewrites the text once, at the final whistle, and clears the clock", () => {
    const final = item({ title: "Buffalo Bills 27-24 Los Angeles Chargers", matchStatus: "finished", homeScore: 27, awayScore: 24, matchClock: null });
    const v = matchRefreshValues(final, "scheduled", now);
    expect(v).toMatchObject({ title: "Buffalo Bills 27-24 Los Angeles Chargers", matchStatus: "finished", matchClock: null });
    expect(matchRefreshValues(final, "finished", now)).not.toHaveProperty("title");
  });

  it("refreshes CricketData summary/body every poll", () => {
    const v = matchRefreshValues(item({ sourceName: "CricketData.org", category: "cricket", summary: "Day 2: India lead by 40 runs." }), "scheduled", now);
    expect(v).toMatchObject({ summary: "Day 2: India lead by 40 runs." });
    expect(v).not.toHaveProperty("title");
  });
});

describe("supersedingRefreshValues", () => {
  const espn = item({
    sourceName: "ESPN Cricket", category: "cricket", homeTeam: "Glamorgan", awayTeam: "Essex",
    homeScoreText: "505", awayScoreText: "129 & 116/1 (35 ov) (f/o)", matchStatus: "scheduled",
    matchNote: "Day 3: Essex trail by 260 runs", summary: "Glamorgan face Essex.", body: "Scores: ...",
  });

  it("writes the score, status and live text, and records where the score came from", () => {
    const v = supersedingRefreshValues(espn, { homeTeam: "Glamorgan" }, now);
    expect(v).toMatchObject({ homeScoreText: "505", awayScoreText: "129 & 116/1 (35 ov) (f/o)", matchNote: "Day 3: Essex trail by 260 runs", scoreSource: "ESPN Cricket", updatedAt: now });
    // The owner keeps its identity.
    expect(v).not.toHaveProperty("title");
    expect(v).not.toHaveProperty("matchKey");
    expect(v).not.toHaveProperty("leagueLabel");
  });

  it("maps scores by team when the owner lists the teams the other way round", () => {
    const v = supersedingRefreshValues(espn, { homeTeam: "Essex" }, now);
    expect(v.homeScoreText).toBe("129 & 116/1 (35 ov) (f/o)");
    expect(v.awayScoreText).toBe("505");
  });
});

// The Asian Games semi-finals, 2026-09-30: stored as "TBA v TBA" and rejected
// as placeholders; ESPN later named India v Sri Lanka.
describe("placeholder fixtures", () => {
  const semi = (o: Partial<RawMatchItem> = {}) =>
    item({
      title: "India vs Sri Lanka, Asian Games Men's Cricket Competition",
      summary: "India face Sri Lanka in the Asian Games Men's Cricket Competition on Oct 1.",
      body: "India face Sri Lanka at Korogi Sports Park, Nisshin.",
      sourceName: "ESPN Cricket",
      category: "cricket",
      homeTeam: "India",
      awayTeam: "Sri Lanka",
      homeCrestUrl: "https://crest/india.png",
      awayCrestUrl: undefined,
      dedupeKey: "espn-cricket-1552777",
      ...o,
    });
  const rejectedTba = { homeTeam: "TBA", awayTeam: "TBA", status: "rejected", rejectionReason: "placeholder fixture (teams TBA)" };

  it("gives the row its real teams, title and crests, and reopens it for auto-approve", () => {
    const v = placeholderResolution(rejectedTba, semi(), now);
    expect(v).toMatchObject({
      homeTeam: "India",
      awayTeam: "Sri Lanka",
      title: "India vs Sri Lanka, Asian Games Men's Cricket Competition",
      homeCrestUrl: "https://crest/india.png",
      status: "pending_review",
      rejectionReason: null,
    });
    // A slug naming the real teams (the rejected page was never public).
    expect(v?.slug).toMatch(/^india-vs-sri-lanka-asian-games-men-s-cricket-competition-\d+$/);
  });

  it("is applied by matchRefreshValues alongside the score refresh", () => {
    const v = matchRefreshValues(semi({ matchStatus: "scheduled" }), "scheduled", now, rejectedTba);
    expect(v).toMatchObject({ homeTeam: "India", awayTeam: "Sri Lanka", status: "pending_review", matchStatus: "scheduled" });
    expect(v.matchKey).toBe("cricket:2026-09-27:india-v-sri-lanka");
  });

  it("fixes the names but leaves the status of a row that was not rejected as a placeholder", () => {
    const published = placeholderResolution({ ...rejectedTba, status: "published", rejectionReason: null }, semi(), now);
    expect(published).toMatchObject({ homeTeam: "India", awayTeam: "Sri Lanka" });
    expect(published).not.toHaveProperty("status");
    expect(published).not.toHaveProperty("slug");
    const other = placeholderResolution({ ...rejectedTba, rejectionReason: "profanity" }, semi(), now);
    expect(other).not.toHaveProperty("status");
  });

  it("does nothing while the source still says TBA, or for a normal row", () => {
    expect(placeholderResolution(rejectedTba, semi({ homeTeam: "TBA", awayTeam: "TBA" }), now)).toBeNull();
    expect(placeholderResolution(rejectedTba, semi({ awayTeam: "TBC" }), now)).toBeNull();
    expect(placeholderResolution({ homeTeam: "India", awayTeam: "Sri Lanka", status: "published", rejectionReason: null }, semi(), now)).toBeNull();
    expect(placeholderResolution(undefined, semi(), now)).toBeNull();
    // Non-match rows carry no teams at all.
    expect(placeholderResolution({ homeTeam: null, awayTeam: null, status: "published", rejectionReason: null }, semi(), now)).toBeNull();
  });

  it("resolves a row where only one side was a placeholder", () => {
    expect(placeholderResolution({ ...rejectedTba, homeTeam: "India" }, semi(), now)).toMatchObject({ awayTeam: "Sri Lanka", status: "pending_review" });
  });
});
