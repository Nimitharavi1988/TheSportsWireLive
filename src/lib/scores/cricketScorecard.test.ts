import { describe, it, expect } from "vitest";
import { espnCricketIds, parseCricketScorecard, parseInningsFromRosters, parseYetToBat, type EspnCricketSummary } from "./cricketScorecard";

const summary: EspnCricketSummary = {
  rosters: [{ team: { abbreviation: "IND-A Women", displayName: "India A Women" } }],
  matchcards: [
    {
      headline: "Batting", inningsNumber: "3", teamName: "IND-A Women", runs: "134", total: "(2 wkts; 27.5 ovs)", extras: "(b 6, lb 9)",
      playerDetails: [
        { playerName: "S Shubha", dismissal: "caught", runs: "27", ballsFaced: "50", fours: "3", sixes: "0" },
        { playerName: "YH Bhatia", dismissal: "not out", runs: "33", ballsFaced: "40", fours: "6", sixes: "0" },
        { playerName: "AB Sharma", dismissal: "", runs: "", ballsFaced: "", fours: "", sixes: "" },
      ],
    },
    {
      headline: "Bowling", inningsNumber: "3", teamName: "AUS-A Women",
      playerDetails: [{ playerName: "T Flintoff", overs: "4.0", maidens: "1", conceded: "14", wickets: "0", economyRate: "3.5" }],
    },
    { headline: "Batting", inningsNumber: "1", teamName: "AUS-A Women", runs: "176", total: "(10 wkts; 60.1 ovs)", playerDetails: [{ playerName: "X", dismissal: "bowled", runs: "4", ballsFaced: "0" }] },
  ],
};

describe("espnCricketIds", () => {
  it("reads series and game from an ESPN link", () => {
    expect(espnCricketIds("https://www.espn.in/cricket/series/24289/game/1529228/india-vs-west-indies-2nd-odi-24289")).toEqual({ series: "24289", game: "1529228" });
  });
  it("is null for other providers", () => {
    expect(espnCricketIds("https://www.cricapi.com/match/abc")).toBeNull();
  });
});

describe("parseCricketScorecard", () => {
  const innings = parseCricketScorecard(summary);
  it("orders innings and pairs batting with the bowling side", () => {
    expect(innings.map((i) => i.number)).toEqual([1, 3]);
    expect(innings[1].bowling[0]).toMatchObject({ name: "T Flintoff", overs: "4.0", wickets: "0" });
  });
  it("formats the total, names the team in full and keeps extras", () => {
    expect(innings[1]).toMatchObject({ team: "India A Women", total: "134/2 (27.5 ov)", extras: "(b 6, lb 9)" });
    expect(innings[0].total).toBe("176 (60.1 ov)");
  });
  it("computes strike rate and separates those who did not bat", () => {
    expect(innings[1].batting[1]).toMatchObject({ name: "YH Bhatia", dismissal: "not out", strikeRate: "82.5" });
    expect(innings[1].didNotBat).toEqual(["AB Sharma"]);
    expect(innings[0].batting[0].strikeRate).toBeNull();
  });
});

// Two innings of a Test, as ESPN nests them: header linescores per competitor
// and each player's stats per period. Period 1: India bat, Australia bowl.
const stat = (o: Record<string, string>) => ({ linescores: [{ statistics: { categories: [{ stats: Object.entries(o).map(([name, displayValue]) => ({ name, displayValue })) }] } }] });
const player = (name: string, byPeriod: Record<number, Record<string, string>>) => ({
  athlete: { displayName: name },
  linescores: Object.entries(byPeriod).map(([period, o]) => ({ period: Number(period), ...stat(o) })),
});
const full: EspnCricketSummary = {
  header: {
    competitions: [
      {
        competitors: [
          { team: { displayName: "India" }, linescores: [{ period: 1, isBatting: true, runs: 150, wickets: 10, overs: 40.2, description: "all out" }] },
          { team: { displayName: "Australia" }, linescores: [{ period: 1, isBatting: false }, { period: 2, isBatting: true, runs: 90, wickets: 3, overs: 20, description: "" }] },
        ],
      },
    ],
  },
  rosters: [
    {
      team: { displayName: "India" },
      roster: [
        player("Shubman Gill", { 1: { batted: "1", battingPosition: "2", runs: "100", ballsFaced: "80", fours: "10", sixes: "3", notouts: "0", dismissalCard: "c" } }),
        player("Rohit Sharma", { 1: { batted: "1", battingPosition: "1", runs: "40", ballsFaced: "50", fours: "4", sixes: "0", notouts: "1", dismissalCard: "not out" } }),
        player("Jasprit Bumrah", { 1: { batted: "0" }, 2: { overs: "6", maidens: "2", conceded: "10", wickets: "2", economyRate: "1.66", bowlingPosition: "1" } }),
      ],
    },
    {
      team: { displayName: "Australia" },
      roster: [player("Pat Cummins", { 1: { overs: "10", maidens: "1", conceded: "30", wickets: "4", economyRate: "3.00", bowlingPosition: "1" } })],
    },
  ],
};

describe("parseInningsFromRosters", () => {
  const innings = parseInningsFromRosters(full);
  it("builds every innings, in order, from header and rosters", () => {
    expect(innings.map((i) => [i.number, i.team, i.total])).toEqual([[1, "India", "150 (40.2 ov)"], [2, "Australia", "90/3 (20 ov)"]]);
    expect(innings[0].result).toBe("all out");
  });
  it("orders batters by batting position and names the dismissal", () => {
    expect(innings[0].batting.map((b) => [b.name, b.dismissal])).toEqual([["Rohit Sharma", "not out"], ["Shubman Gill", "caught"]]);
  });
  it("works out extras as total minus the batters' runs", () => {
    expect(innings[0].extrasRuns).toBe(10);
  });
  it("takes bowling figures from the fielding side's players", () => {
    expect(innings[0].bowling).toEqual([{ name: "Pat Cummins", overs: "10", maidens: "1", runs: "30", wickets: "4", economy: "3.00" }]);
    expect(innings[1].bowling[0]).toMatchObject({ name: "Jasprit Bumrah", wickets: "2" });
  });
});

describe("parseYetToBat", () => {
  const live: EspnCricketSummary = {
    header: { competitions: [{ competitors: [{ team: { displayName: "India" } }, { team: { displayName: "Sri Lanka" } }] }] },
    rosters: [
      { team: { displayName: "India" }, roster: [{ athlete: { displayName: "Abhishek Sharma" } }] },
      { team: { displayName: "Sri Lanka" }, roster: [{ athlete: { displayName: "Pathum Nissanka" } }, { athlete: { displayName: "Kusal Mendis" } }, { athlete: {} }] },
    ],
  };
  const india = [{ number: 1, team: "India" }] as never;
  it("names the side that has not batted, with its players", () => {
    expect(parseYetToBat(live, india)).toEqual([{ team: "Sri Lanka", players: ["Pathum Nissanka", "Kusal Mendis"] }]);
  });
  it("has nothing once both sides have batted", () => {
    expect(parseYetToBat(live, [{ number: 1, team: "India" }, { number: 2, team: "Sri Lanka" }] as never)).toEqual([]);
  });
  it("is empty without a header to read teams from", () => {
    expect(parseYetToBat({ rosters: live.rosters }, india)).toEqual([]);
  });
});
