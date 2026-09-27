import { describe, it, expect } from "vitest";
import { coversMatch, isBigMatch, matchTags, previewIdea, reportIdea, seriesForMatch, trendEntities, trendIdeas, type MatchRow } from "./storyIdeas";

const match = (over: Partial<MatchRow> = {}): MatchRow => ({
  id: "m1",
  category: "cricket",
  homeTeam: "India",
  awayTeam: "West Indies",
  kickoffAt: new Date("2026-09-27T08:00:00Z"),
  matchStatus: "finished",
  leagueLabel: "West Indies tour of India 2026/27",
  venue: "Greenfield International Stadium, Thiruvananthapuram",
  homeScoreText: "300/2 (41.4/50 ov, target 296)",
  awayScoreText: "295/7",
  homeScore: null,
  awayScore: null,
  matchNote: "India won by 8 wickets",
  ...over,
});

describe("isBigMatch", () => {
  it("keeps India, every NFL game, the Premier League and tracked clubs", () => {
    expect(isBigMatch(match())).toBe(true);
    expect(isBigMatch(match({ homeTeam: "Zimbabwe", awayTeam: "Ireland" }))).toBe(false);
    expect(isBigMatch(match({ category: "american-football", homeTeam: "Chicago Bears", awayTeam: "Philadelphia Eagles" }))).toBe(true);
    expect(isBigMatch(match({ category: "football", homeTeam: "Brentford", awayTeam: "Fulham", leagueLabel: "Premier League" }))).toBe(true);
    expect(isBigMatch(match({ category: "college-football", homeTeam: "Ohio State Buckeyes", awayTeam: "Illinois Fighting Illini", leagueLabel: null }))).toBe(true);
  });
  it("leaves out MLS even though its clubs are tracked", () => {
    expect(isBigMatch(match({ category: "football", homeTeam: "LA Galaxy", awayTeam: "Colorado Rapids", leagueLabel: "MLS" }))).toBe(false);
  });
});

describe("match ideas", () => {
  it("tags both sides and the ground, and finds the series", () => {
    expect(matchTags(match())).toEqual([
      { kind: "country", slug: "india" },
      { kind: "country", slug: "west-indies" },
      { kind: "venue", slug: "greenfield-international-stadium" },
    ]);
    const options = [{ key: "australia-vs-india-test" }, { key: "india-vs-west-indies-odi" }, { key: "india-vs-west-indies-t20i" }];
    expect(seriesForMatch(match(), options)).toBe("india-vs-west-indies-odi");
    expect(seriesForMatch(match({ seriesKey: "asian-games-2026" }), options)).toBe("asian-games-2026");
  });
  it("writes a report brief from the result and a preview brief from the fixture", () => {
    const r = reportIdea(match(), "india-vs-west-indies-odi");
    expect(r.key).toBe("report:m1");
    expect(r.storyKind).toBe("report");
    expect(r.reason).toContain("India won by 8 wickets");
    expect(r.brief).toContain("Result: India won by 8 wickets.");
    const p = previewIdea(match({ matchStatus: "scheduled" }), null);
    expect(p.storyKind).toBe("preview");
    expect(p.brief).toMatch(/^Preview: India v West Indies/);
  });
  it("leads with the score outside cricket (the note there is rankings)", () => {
    const r = reportIdea(match({ category: "college-football", homeTeam: "Ohio State Buckeyes", awayTeam: "Illinois Fighting Illini", homeScoreText: null, awayScoreText: null, homeScore: 42, awayScore: 19, matchNote: "No. 7 Ohio State" }), null);
    expect(r.reason).toMatch(/^Ohio State Buckeyes 42-19 Illinois Fighting Illini/);
    expect(r.brief).not.toContain("No. 7");
  });
});

describe("coversMatch", () => {
  const idea = reportIdea(match(), null);
  it("is covered by a report naming both sides written after the match", () => {
    expect(coversMatch({ title: "Kohli and Gill tons sink West Indies as India cruise", storyKind: "report", createdAt: new Date("2026-09-27T18:00:00Z") }, idea)).toBe(true);
  });
  it("isn't covered by a different kind, one side only, or a story from before", () => {
    expect(coversMatch({ title: "India v West Indies: what we learned", storyKind: "analysis", createdAt: new Date("2026-09-27T18:00:00Z") }, idea)).toBe(false);
    expect(coversMatch({ title: "Kohli's 55th ton for India", storyKind: "report", createdAt: new Date("2026-09-27T18:00:00Z") }, idea)).toBe(false);
    expect(coversMatch({ title: "India v West Indies", storyKind: "report", createdAt: new Date("2026-09-26T18:00:00Z") }, idea)).toBe(false);
  });
});

describe("trendIdeas", () => {
  const now = new Date("2026-09-27T20:00:00Z");
  const story = (title: string, sourceName: string, category = "cricket") => ({ title, slug: title.toLowerCase().replace(/\W+/g, "-"), sourceName, category, publishedAt: now });
  const entities = trendEntities();
  it("needs several stories from more than one outlet", () => {
    const four = ["Kohli hits 55th ton", "Kohli reaches 15,000", "Kohli on RoKo", "Kohli's dream"];
    expect(trendIdeas(four.map((t, i) => story(t, i % 2 ? "Sportstar" : "CricTracker")), entities).map((i) => i.key)).toContain("trend:player:virat-kohli");
    expect(trendIdeas(four.map((t) => story(t, "CricTracker")), entities)).toEqual([]);
  });
  it("matches whole words in the right sport only", () => {
    const titles = ["Kohlischeck wins", "Kohlis", "Kohli-like", "Kohli tipped"].map((t, i) => story(t, i % 2 ? "A" : "B", "football"));
    expect(trendIdeas(titles, entities)).toEqual([]);
  });
});
