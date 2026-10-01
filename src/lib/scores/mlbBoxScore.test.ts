import { describe, it, expect } from "vitest";
import { mlbGamePk, parseMlbBoxScore } from "./mlbBoxScore";

const batter = (name: string, order: string, pos: string, s: Record<string, number | string>, avg = ".271") => ({
  person: { fullName: name },
  position: { abbreviation: pos },
  battingOrder: order,
  stats: { batting: s },
  seasonStats: { batting: { avg } },
});
const pitcher = (name: string, s: Record<string, number | string>, era = "3.10") => ({ person: { fullName: name }, stats: { pitching: s }, seasonStats: { pitching: { era } } });

const side = (name: string) => ({
  team: { name },
  players: {
    ID1: batter("Ace Hitter", "100", "SS", { atBats: 4, runs: 1, hits: 2, rbi: 2, baseOnBalls: 0, strikeOuts: 1 }),
    ID2: batter("Pinch Hitter", "101", "PH", { atBats: 1, runs: 0, hits: 0, rbi: 0, baseOnBalls: 0, strikeOuts: 1 }),
    ID3: batter("Second Slot", "200", "CF", { atBats: 3, runs: 0, hits: 1, rbi: 0, baseOnBalls: 1, strikeOuts: 0 }),
    ID9: { person: { fullName: "On The Bench" }, position: { abbreviation: "C" }, stats: { batting: {} } },
    ID10: pitcher("Starter Arm", { inningsPitched: "6.0", hits: 5, runs: 2, earnedRuns: 2, baseOnBalls: 1, strikeOuts: 7, homeRuns: 1 }),
  },
  pitchers: [10],
  teamStats: {
    batting: { atBats: 38, runs: 5, hits: 11, rbi: 5, baseOnBalls: 3, strikeOuts: 9, avg: ".289" },
    pitching: { inningsPitched: "9.0", hits: 8, runs: 3, earnedRuns: 3, baseOnBalls: 2, strikeOuts: 10, homeRuns: 1 },
  },
});

const boxscore = { teams: { away: side("Boston Red Sox"), home: side("Baltimore Orioles") } };
const linescore = {
  innings: [
    { num: 1, away: { runs: 0 }, home: { runs: 2 } },
    { num: 2, away: { runs: 1 }, home: { runs: 0 } },
  ],
  teams: { away: { runs: 1, hits: 5, errors: 0 }, home: { runs: 2, hits: 8, errors: 1 } },
};

describe("mlbGamePk", () => {
  it("reads the game id from a gameday link", () => {
    expect(mlbGamePk("https://www.mlb.com/gameday/849848")).toBe("849848");
    expect(mlbGamePk("https://www.espn.com/nhl/game/_/gameId/401892431")).toBeNull();
  });
});

describe("parseMlbBoxScore", () => {
  const box = parseMlbBoxScore(boxscore, linescore);
  it("is credited to MLB, away team first", () => {
    expect(box.source).toBe("MLB");
    expect(box.teams.map((t) => t.team)).toEqual(["Boston Red Sox", "Baltimore Orioles"]);
  });
  it("lists batters in batting order, with substitutes under the player replaced and no bench-only players", () => {
    const batting = box.teams[0].groups[0];
    expect(batting.title).toBe("Batting");
    expect(batting.rows.map((r) => r.name)).toEqual(["Ace Hitter", "Pinch Hitter", "Second Slot"]);
    expect(batting.rows[0]).toMatchObject({ detail: "SS", stats: ["4", "1", "2", "2", "0", "1", ".271"] });
    expect(batting.rows[1].detail).toBe("PH · substitute");
    expect(batting.totals?.slice(0, 3)).toEqual(["38", "5", "11"]);
  });
  it("lists pitchers with innings and earned runs", () => {
    const pitching = box.teams[0].groups[1];
    expect(pitching.rows[0]).toMatchObject({ name: "Starter Arm", stats: ["6.0", "5", "2", "2", "1", "7", "1", "3.10"] });
  });
  it("builds a line score of at least nine innings with R/H/E", () => {
    expect(box.lineScore?.innings).toHaveLength(9);
    expect(box.lineScore?.rows[0]).toMatchObject({ team: "Boston Red Sox", totals: ["1", "5", "0"] });
    expect(box.lineScore?.rows[1].values.slice(0, 3)).toEqual(["2", "0", ""]);
    expect(box.lineScore?.rows[1].totals).toEqual(["2", "8", "1"]);
  });
  it("marks an unplayed bottom half X once the game is over", () => {
    const won = { ...linescore, innings: [{ num: 1, away: { runs: 0 }, home: { runs: 3 } }, { num: 2, away: { runs: 0 } }] };
    expect(parseMlbBoxScore(boxscore, won, true).lineScore?.rows[1].values.slice(0, 2)).toEqual(["3", "X"]);
    expect(parseMlbBoxScore(boxscore, won, false).lineScore?.rows[1].values.slice(0, 2)).toEqual(["3", ""]);
  });
  it("adds columns for extra innings", () => {
    const extras = { ...linescore, innings: Array.from({ length: 11 }, (_, i) => ({ num: i + 1, away: { runs: 0 }, home: { runs: 0 } })) };
    expect(parseMlbBoxScore(boxscore, extras).lineScore?.innings).toHaveLength(11);
  });
  it("has no line score before play starts", () => {
    expect(parseMlbBoxScore(boxscore, { innings: [], teams: {} }).lineScore).toBeUndefined();
  });
});
