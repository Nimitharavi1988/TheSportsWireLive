import { describe, it, expect } from "vitest";
import { buildNameIndex, linksForNames, normalizeName, scorecardNames } from "./playerLinks";
import type { Scorecard } from "./cricketScorecard";

describe("normalizeName", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalizeName("  Vaibhav  Sooryavanshi ")).toBe("vaibhav sooryavanshi");
    expect(normalizeName("José Buttler-Smith")).toBe("jose buttler smith");
  });
});

describe("linksForNames", () => {
  const players = buildNameIndex([
    { name: "Virat Kohli", href: "/player/virat-kohli" },
    { name: "Abhishek Sharma", href: "/player/abhishek-sharma" },
    { name: "Mohammed Shami", href: "/player/shami-a" },
    { name: "Mohammed Shami", href: "/player/shami-b" },
  ]);
  const athletes = buildNameIndex([
    { name: "Harmanpreet Kaur", href: "/athlete/harmanpreet-kaur" },
    { name: "Virat Kohli", href: "/athlete/virat-kohli-athlete" },
  ]);

  it("links an exact full-name match, whatever the case", () => {
    expect(linksForNames(["Virat Kohli", "abhishek sharma"], [players, athletes])).toEqual({
      "Virat Kohli": "/player/virat-kohli",
      "abhishek sharma": "/player/abhishek-sharma",
    });
  });
  it("prefers a player page, then falls back to an athlete page", () => {
    const links = linksForNames(["Virat Kohli", "Harmanpreet Kaur"], [players, athletes]);
    expect(links["Virat Kohli"]).toBe("/player/virat-kohli");
    expect(links["Harmanpreet Kaur"]).toBe("/athlete/harmanpreet-kaur");
  });
  it("never links a partial name, an unknown name, or an ambiguous one", () => {
    expect(linksForNames(["Abhishek", "A Sharma", "Somebody Else", "Mohammed Shami"], [players, athletes])).toEqual({});
  });
  it("does not fall through to a less certain page when the better one is ambiguous", () => {
    const athleteShami = buildNameIndex([{ name: "Mohammed Shami", href: "/athlete/mohammed-shami" }]);
    expect(linksForNames(["Mohammed Shami"], [players, athleteShami])).toEqual({});
  });
});

describe("scorecardNames", () => {
  const card = {
    innings: [
      {
        number: 1, team: "India", total: "10/0 (1 ov)", result: null, extrasRuns: 0, extras: null,
        batting: [{ name: "Abhishek Sharma", dismissal: null, runs: 4, balls: 3, fours: 1, sixes: 0, strikeRate: "133.3" }],
        didNotBat: ["Sanju Samson", ""],
        bowling: [{ name: "Wanindu Hasaranga", overs: "1", maidens: "0", runs: "10", wickets: "0", economy: "10" }],
      },
    ],
    yetToBat: [{ team: "Sri Lanka", players: ["Pathum Nissanka", "Sanju Samson"] }],
  } as unknown as Scorecard;
  it("lists every name once, batters, bowlers and those yet to bat", () => {
    expect(scorecardNames(card).sort()).toEqual(["Abhishek Sharma", "Pathum Nissanka", "Sanju Samson", "Wanindu Hasaranga"]);
  });
});
