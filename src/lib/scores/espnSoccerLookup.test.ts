import { describe, it, expect } from "vitest";
import { pickEvent, sameClub, SOCCER_LEAGUE_CODES, type EspnScoreboardEvent } from "./espnSoccerLookup";

describe("sameClub", () => {
  it("matches the names the two providers really use", () => {
    expect(sameClub("Real Sociedad de Fútbol", "Real Sociedad")).toBe(true);
    expect(sameClub("Sport Lisboa e Benfica", "Benfica")).toBe(true);
    expect(sameClub("Olympique de Marseille", "Marseille")).toBe(true);
    expect(sameClub("Paris Saint-Germain FC", "Paris Saint-Germain")).toBe(true);
    expect(sameClub("FC Internazionale Milano", "Inter Milan")).toBe(true);
    expect(sameClub("FC Bayern München", "Bayern Munich")).toBe(true);
    expect(sameClub("Club Atlético de Madrid", "Atletico Madrid")).toBe(true);
    expect(sameClub("Wolverhampton Wanderers FC", "Wolverhampton Wanderers")).toBe(true);
    expect(sameClub("Brighton & Hove Albion FC", "Brighton & Hove Albion")).toBe(true);
    expect(sameClub("TSG 1899 Hoffenheim", "Hoffenheim")).toBe(true);
  });
  it("keeps different clubs apart", () => {
    expect(sameClub("Real Madrid CF", "Real Sociedad")).toBe(false);
    expect(sameClub("Manchester United FC", "Manchester City FC")).toBe(false);
    expect(sameClub("Leeds United", "Newcastle United")).toBe(false);
    expect(sameClub("Atlético Madrid", "Real Madrid")).toBe(false);
  });
});

const event = (id: string, date: string, home: string, away: string): EspnScoreboardEvent => ({
  id,
  date,
  competitions: [{ competitors: [{ team: { displayName: home } }, { team: { displayName: away } }] }],
});

describe("pickEvent", () => {
  const day = [
    event("1", "2026-09-20T19:00Z", "Valencia", "Real Sociedad"),
    event("2", "2026-09-20T19:00Z", "Villarreal", "Levante"),
    event("3", "2026-09-20T16:30Z", "Deportivo La Coruña", "Real Betis"),
  ];
  const k = Date.parse("2026-09-20T19:00:00Z");
  it("finds the game by both teams", () => {
    expect(pickEvent(day, k, "Valencia CF", "Real Sociedad de Fútbol")?.id).toBe("1");
    expect(pickEvent(day, k, "RC Deportivo La Coruña", "Real Betis Balompié")?.id).toBe("3");
  });
  it("falls back to a unique kickoff with one team matching", () => {
    expect(pickEvent(day, Date.parse("2026-09-20T16:30:00Z"), "Dépor", "Real Betis Balompié")?.id).toBe("3");
  });
  it("gives up rather than guess", () => {
    expect(pickEvent(day, k, "Getafe", "Osasuna")).toBeNull();
    // Two games at that time and only one team named: ambiguous.
    expect(pickEvent(day, k, "Valencia CF", "Elche")?.id).toBe("1");
    expect(pickEvent([event("a", "2026-09-20T19:00Z", "Valencia", "X"), event("b", "2026-09-20T19:00Z", "Y", "Valencia")], k, "Valencia CF", "Elche")).toBeNull();
  });
  it("takes the nearer of two meetings", () => {
    const two = [event("old", "2026-09-13T19:00Z", "Valencia", "Real Sociedad"), event("new", "2026-09-20T19:00Z", "Valencia", "Real Sociedad")];
    expect(pickEvent(two, k, "Valencia CF", "Real Sociedad de Fútbol")?.id).toBe("new");
  });
});

describe("league codes", () => {
  it("cover the football-data competitions", () => {
    for (const name of ["Premier League", "Primera Division", "UEFA Champions League"]) expect(SOCCER_LEAGUE_CODES[name]).toBeTruthy();
  });
});
