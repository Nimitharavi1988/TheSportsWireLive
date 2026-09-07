import { describe, it, expect } from "vitest";
import { isRealLogo, extractTeamLogos, GENERIC_PLACEHOLDER_IMG } from "./cricketData";

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
