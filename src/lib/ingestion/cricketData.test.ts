import { describe, it, expect } from "vitest";
import { isRealLogo, extractTeamLogos, GENERIC_PLACEHOLDER_IMG, inferCricketMatchStatus, extractTeamScoreLine } from "./cricketData";

describe("isRealLogo", () => {
  it("accepts a real CDN image URL", () => {
    expect(isRealLogo("https://g.cricapi.com/iapi/174-637945408285271060.webp?w=48")).toBe(true);
  });

  it("rejects the generic placeholder icon", () => {
    expect(isRealLogo(GENERIC_PLACEHOLDER_IMG)).toBe(false);
  });

  it("rejects missing/empty/non-string values", () => {
    expect(isRealLogo(undefined)).toBe(false);
    expect(isRealLogo(null)).toBe(false);
    expect(isRealLogo("")).toBe(false);
  });
});

describe("extractTeamLogos", () => {
  it("returns both crests when both teams have a real logo", () => {
    const match = {
      teamInfo: [
        { name: "Guyana Amazon Warriors", img: "https://g.cricapi.com/iapi/174-a.webp" },
        { name: "St Kitts and Nevis Patriots", img: "https://g.cricapi.com/iapi/277-b.webp" },
      ],
    };
    expect(extractTeamLogos(match)).toEqual({
      homeCrestUrl: "https://g.cricapi.com/iapi/174-a.webp",
      awayCrestUrl: "https://g.cricapi.com/iapi/277-b.webp",
    });
  });

  // The real, live-confirmed case: one team has a real logo, the other only
  // has the generic placeholder. Must return neither — a real badge next to
  // a generic icon looks broken, not just incomplete.
  it("returns nothing when only one team has a real logo", () => {
    const match = {
      teamInfo: [
        { name: "Barbados Tridents", img: GENERIC_PLACEHOLDER_IMG },
        { name: "Saint Lucia Kings", img: "https://g.cricapi.com/iapi/266-c.webp" },
      ],
    };
    expect(extractTeamLogos(match)).toEqual({});
  });

  it("returns nothing when teamInfo is missing or malformed", () => {
    expect(extractTeamLogos({})).toEqual({});
    expect(extractTeamLogos({ teamInfo: [] })).toEqual({});
    expect(extractTeamLogos({ teamInfo: [{ name: "Only One Team" }] })).toEqual({});
  });
});

describe("inferCricketMatchStatus", () => {
  it("recognizes a definitive result as finished", () => {
    expect(inferCricketMatchStatus("India won by 5 wickets")).toBe("finished");
    expect(inferCricketMatchStatus("Australia won by 42 runs")).toBe("finished");
    expect(inferCricketMatchStatus("Match drawn")).toBe("finished");
    expect(inferCricketMatchStatus("Match tied")).toBe("finished");
    expect(inferCricketMatchStatus("No result")).toBe("finished");
  });

  it("is case-insensitive", () => {
    expect(inferCricketMatchStatus("ENGLAND WON BY AN INNINGS")).toBe("finished");
  });

  it("treats an in-progress or not-yet-started match as scheduled", () => {
    expect(inferCricketMatchStatus("India elected to bat")).toBe("scheduled");
    expect(inferCricketMatchStatus("Match starts at 14:30 GMT")).toBe("scheduled");
    expect(inferCricketMatchStatus("England need 45 runs")).toBe("scheduled");
  });

  it("treats missing status as scheduled", () => {
    expect(inferCricketMatchStatus(undefined)).toBe("scheduled");
  });
});

describe("extractTeamScoreLine", () => {
  const score = [
    { inning: "St Kitts and Nevis Patriots Inning 1", r: 71, w: 6, o: 14.3 },
    { inning: "Barbados Tridents Inning 1", r: 120, w: 6, o: 18 },
  ];

  it("finds a team's own innings by matching the team name inside the inning label", () => {
    expect(extractTeamScoreLine(score, "St Kitts and Nevis Patriots")).toBe("71/6 (14.3)");
    expect(extractTeamScoreLine(score, "Barbados Tridents")).toBe("120/6 (18)");
  });

  it("is case-insensitive", () => {
    expect(extractTeamScoreLine(score, "barbados tridents")).toBe("120/6 (18)");
  });

  it("takes the most recent (last) innings for a team with more than one", () => {
    const multiInnings = [
      { inning: "England Inning 1", r: 300, w: 10, o: 90 },
      { inning: "England Inning 2", r: 150, w: 4, o: 40 },
    ];
    expect(extractTeamScoreLine(multiInnings, "England")).toBe("150/4 (40)");
  });

  it("returns undefined when the team hasn't batted yet (no matching innings)", () => {
    expect(extractTeamScoreLine(score, "Trinbago Knight Riders")).toBeUndefined();
  });

  it("returns undefined when score is missing or not an array", () => {
    expect(extractTeamScoreLine(undefined, "Barbados Tridents")).toBeUndefined();
    expect(extractTeamScoreLine(null, "Barbados Tridents")).toBeUndefined();
    expect(extractTeamScoreLine([], "Barbados Tridents")).toBeUndefined();
  });
});
