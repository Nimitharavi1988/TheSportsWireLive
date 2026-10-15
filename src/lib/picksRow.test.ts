import { describe, expect, it } from "vitest";
import { pickRowOrder, startsInLabel } from "./picksRow";

const at = (hours: number) => new Date(Date.UTC(2026, 9, 14, 12 + hours));
const m = (home: string, away: string, leagueLabel: string, category: string, hours: number) => ({ homeTeam: home, awayTeam: away, leagueLabel, category, kickoffAt: at(hours) });

describe("pickRowOrder", () => {
  it("puts the bigger competition first, then the soonest kickoff", () => {
    const list = [
      m("Pumas", "Cruz Azul", "Liga MX", "football", 1),
      m("Chiefs", "Bills", "NFL · Week 5", "american-football", 5),
      m("Arsenal", "Chelsea", "Premier League", "football", 3),
    ];
    expect(pickRowOrder(list).map((x) => x.homeTeam)).toEqual(["Arsenal", "Chiefs", "Pumas"]);
  });
  it("keeps one entry per matchup (a doubleheader repeats the teams)", () => {
    const list = [
      m("Brewers", "Dodgers", "MLB", "baseball", 2),
      m("Brewers", "Dodgers", "MLB", "baseball", 20),
      m("Rays", "Guardians", "MLB", "baseball", 4),
    ];
    expect(pickRowOrder(list).map((x) => `${x.homeTeam}@${x.kickoffAt.getUTCHours() - 12}`)).toEqual(["Brewers@2", "Rays@4"]);
  });
  it("returns at most the limit, skips games without both teams, and handles an empty list", () => {
    const list = Array.from({ length: 6 }, (_, i) => m(`Home${i}`, `Away${i}`, "NBA", "basketball", i));
    expect(pickRowOrder(list)).toHaveLength(3);
    expect(pickRowOrder(list, 2)).toHaveLength(2);
    expect(pickRowOrder([{ ...list[0], homeTeam: null }])).toEqual([]);
    expect(pickRowOrder([])).toEqual([]);
  });
});

describe("startsInLabel", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60000);
  it("counts down under a day and names tomorrow after that", () => {
    expect(startsInLabel(at(45), now)).toBe("Starts in 45m");
    expect(startsInLabel(at(200), now)).toBe("Starts in 3h 20m");
    expect(startsInLabel(at(60), now)).toBe("Starts in 1h 00m");
    expect(startsInLabel(at(60 * 26), now)).toBe("Starts tomorrow");
  });
  it("rounds a partial minute up and returns null once started", () => {
    expect(startsInLabel(new Date(now.getTime() + 30 * 1000), now)).toBe("Starts in 1m");
    expect(startsInLabel(now, now)).toBeNull();
    expect(startsInLabel(at(-5), now)).toBeNull();
  });
});
