import { describe, it, expect } from "vitest";
import { espnGameRef, hasBoxScore, homeFirst, parseBoxScore } from "./espnBoxScore";

describe("espnGameRef", () => {
  it("reads sport and game from the stored link", () => {
    expect(espnGameRef("https://www.espn.com/nhl/game/_/gameId/401892431", "NHL")).toEqual({ path: "hockey/nhl", id: "401892431" });
    expect(espnGameRef("https://www.espn.com/wnba/game/_/gameId/401918019", "WNBA")).toEqual({ path: "basketball/wnba", id: "401918019" });
  });
  it("takes the soccer league from the label, and skips unknown ones", () => {
    expect(espnGameRef("https://www.espn.com/soccer/match/_/gameId/401884788", "Bundesliga")).toEqual({ path: "soccer/ger.1", id: "401884788" });
    expect(espnGameRef("https://www.espn.com/soccer/match/_/gameId/1", "Premier League")).toBeNull();
  });
  it("is null for other providers", () => {
    expect(espnGameRef("https://www.mlb.com/gameday/849848", "MLB")).toBeNull();
    expect(espnGameRef("https://www.football-data.org/matches/1", "Premier League")).toBeNull();
  });
});

describe("homeFirst", () => {
  const box = parseBoxScore({
    boxscore: {
      teams: [
        { team: { displayName: "Eagles" }, statistics: [{ label: "Yards", displayValue: "375" }] },
        { team: { displayName: "Bears" }, statistics: [{ label: "Yards", displayValue: "524" }] },
      ],
      players: [{ team: { displayName: "Eagles" }, statistics: [] }, { team: { displayName: "Bears" }, statistics: [] }],
    },
  });
  it("puts the home team in the left column and first in the tabs", () => {
    const out = homeFirst(box, "Bears");
    expect(out.statTeams).toEqual(["Bears", "Eagles"]);
    expect(out.teamStats[0]).toEqual({ label: "Yards", home: "524", away: "375" });
    expect(out.teams.map((t) => t.team)).toEqual(["Bears", "Eagles"]);
  });
  it("leaves an already-correct order alone", () => {
    expect(homeFirst(box, "Eagles").statTeams).toEqual(["Eagles", "Bears"]);
  });
});

describe("parseBoxScore", () => {
  const summary = {
    boxscore: {
      teams: [
        { statistics: [{ label: "Possession", displayValue: "50.8" }, { label: "Fouls", displayValue: "14" }] },
        { statistics: [{ label: "Possession", displayValue: "49.2" }, { label: "Fouls", displayValue: "9" }] },
      ],
      players: [
        {
          team: { displayName: "Dream" },
          statistics: [{ labels: ["MIN", "PTS"], athletes: [{ athlete: { displayName: "Naz Hillmon" }, stats: ["22", "6"] }], totals: ["", "63"] }],
        },
        { team: { displayName: "Mystics" }, statistics: [{ name: "passing", labels: ["YDS"], athletes: [], totals: [] }] },
      ],
    },
    keyEvents: [
      { type: { type: "kickoff" }, clock: { displayValue: "" } },
      { type: { type: "yellow-card" }, clock: { displayValue: "11'" }, shortText: "Antonio Nusa Yellow Card", team: { displayName: "RB Leipzig" } },
      { type: { type: "goal" }, clock: { displayValue: "44'" }, text: "Goal! Patrik Schick scores", team: { displayName: "Bayer Leverkusen" } },
    ],
    rosters: [{ team: { displayName: "Bayer Leverkusen" }, formation: "4-2-3-1", roster: [{ starter: true, jersey: "1", athlete: { displayName: "Mark Flekken" }, position: { abbreviation: "G" } }, { starter: false, jersey: "40", athlete: { displayName: "Sub" } }] }],
  };
  const box = parseBoxScore(summary);

  it("reads player tables, dropping empty groups", () => {
    expect(box.teams[0].groups[0]).toMatchObject({ title: "Players", labels: ["MIN", "PTS"], totals: ["", "63"] });
    expect(box.teams[0].groups[0].rows[0]).toEqual({ name: "Naz Hillmon", stats: ["22", "6"] });
    expect(box.teams[1].groups).toHaveLength(0);
  });
  it("pairs team stats", () => {
    expect(box.teamStats).toEqual([{ label: "Possession", home: "50.8", away: "49.2" }, { label: "Fouls", home: "14", away: "9" }]);
  });
  it("keeps goals and cards, not kick-off", () => {
    expect(box.events.map((e) => e.kind)).toEqual(["yellow", "goal"]);
    expect(box.events[1]).toMatchObject({ clock: "44'", team: "Bayer Leverkusen" });
  });
  it("reads lineups", () => {
    expect(box.lineups[0]).toMatchObject({ formation: "4-2-3-1", starters: [{ jersey: "1", name: "Mark Flekken", position: "G" }], bench: [{ jersey: "40", name: "Sub" }] });
  });
  it("is empty for a bare summary", () => {
    expect(hasBoxScore(parseBoxScore({}))).toBe(false);
    expect(hasBoxScore(box)).toBe(true);
  });
});
