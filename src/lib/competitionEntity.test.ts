import { describe, it, expect } from "vitest";
import { competitionToEntity, isHappeningNow } from "./competitionEntity";

const beforeWiOdis = new Date("2026-09-25T12:00:00Z");
const afterEverything = new Date("2026-10-20T12:00:00Z");

describe("competitionToEntity", () => {
  it("formats a bilateral cricket series", () => {
    expect(competitionToEntity({ key: "india-vs-west-indies-odi", label: "India vs West Indies • ODI", category: "cricket" }, afterEverything)).toMatchObject({
      kind: "series",
      slug: "india-vs-west-indies-odi",
      subtitle: "ODI series",
      href: "/series/india-vs-west-indies-odi",
      initials: "IW",
    });
  });

  it("says when a scheduled series starts, until it does", () => {
    expect(competitionToEntity({ key: "india-vs-west-indies-odi", label: "India vs West Indies • ODI", category: "cricket" }, beforeWiOdis).subtitle).toBe(
      "ODI series · starts Sep 27"
    );
  });

  it("labels a mixed-sport event as multi-sport", () => {
    expect(competitionToEntity({ key: "asian-games-2026", label: "Asian Games 2026", category: null }, afterEverything)).toMatchObject({
      subtitle: "Multi-sport event",
      initials: "AG",
    });
  });

  it("labels a single-sport competition by its sport", () => {
    expect(competitionToEntity({ key: "ipl", label: "IPL", category: "cricket" })).toMatchObject({
      subtitle: "Cricket competition",
      initials: "IP",
    });
  });
});

describe("isHappeningNow", () => {
  const duringGames = new Date("2026-09-25T12:00:00Z");

  it("never counts an event without a season, however busy (IPL off-season news)", () => {
    expect(isHappeningNow({ key: "ipl", recentCount: 50 }, duringGames)).toBe(false);
  });

  it("counts an event only within its season dates", () => {
    expect(isHappeningNow({ key: "asian-games-2026", recentCount: 0 }, duringGames)).toBe(true);
    expect(isHappeningNow({ key: "asian-games-2026", recentCount: 50 }, afterEverything)).toBe(false);
  });

  it("counts a scheduled series from a week before it starts, whatever the volume", () => {
    expect(isHappeningNow({ key: "india-vs-west-indies-odi", recentCount: 1 }, beforeWiOdis)).toBe(true);
    expect(isHappeningNow({ key: "india-vs-west-indies-odi", recentCount: 1 }, new Date("2026-09-10T12:00:00Z"))).toBe(false);
    expect(isHappeningNow({ key: "india-vs-west-indies-odi", recentCount: 30 }, afterEverything)).toBe(false);
  });

  it("needs recent volume for an undated bilateral series", () => {
    expect(isHappeningNow({ key: "england-vs-sri-lanka-t20i", recentCount: 12 }, duringGames)).toBe(true);
    expect(isHappeningNow({ key: "india-vs-pakistan-t20i", recentCount: 1 }, duringGames)).toBe(false);
  });
});
