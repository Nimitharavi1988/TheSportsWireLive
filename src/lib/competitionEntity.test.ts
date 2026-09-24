import { describe, it, expect } from "vitest";
import { competitionToEntity, isHappeningNow } from "./competitionEntity";

describe("competitionToEntity", () => {
  it("formats a bilateral cricket series", () => {
    expect(competitionToEntity({ key: "india-vs-west-indies-odi", label: "India vs West Indies • ODI", category: "cricket" })).toMatchObject({
      kind: "series",
      slug: "india-vs-west-indies-odi",
      subtitle: "ODI series",
      href: "/series/india-vs-west-indies-odi",
      initials: "IW",
    });
  });

  it("labels a mixed-sport event as multi-sport", () => {
    expect(competitionToEntity({ key: "asian-games-2026", label: "Asian Games 2026", category: null })).toMatchObject({
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
  const during = new Date("2026-09-25T12:00:00Z");
  const after = new Date("2026-10-10T12:00:00Z");

  it("never counts an event without a season, however busy (IPL off-season news)", () => {
    expect(isHappeningNow({ key: "ipl", recentCount: 50 }, during)).toBe(false);
  });

  it("counts an event only within its season dates", () => {
    expect(isHappeningNow({ key: "asian-games-2026", recentCount: 0 }, during)).toBe(true);
    expect(isHappeningNow({ key: "asian-games-2026", recentCount: 50 }, after)).toBe(false);
  });

  it("needs recent volume for a bilateral series", () => {
    expect(isHappeningNow({ key: "india-vs-west-indies-odi", recentCount: 12 }, during)).toBe(true);
    expect(isHappeningNow({ key: "india-vs-pakistan-t20i", recentCount: 1 }, during)).toBe(false);
  });
});
