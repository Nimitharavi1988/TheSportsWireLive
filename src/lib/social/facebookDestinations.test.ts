import { describe, it, expect } from "vitest";
import { INDIA_CRICKET_PAGE, destinationRunCap, isIndiaCricket, localDayStart } from "./facebookDestinations";

const story = (over: Partial<Parameters<typeof isIndiaCricket>[0]>) => ({
  category: "cricket", title: "", homeTeam: null, awayTeam: null, seriesLabel: null, leagueLabel: null, venue: null, ...over,
});

describe("isIndiaCricket", () => {
  it("matches India's teams, competitions, venues and headlines", () => {
    expect(isIndiaCricket(story({ homeTeam: "West Indies", awayTeam: "India" }))).toBe(true);
    expect(isIndiaCricket(story({ homeTeam: "India A", awayTeam: "Australia A" }))).toBe(true);
    expect(isIndiaCricket(story({ title: "Gill named captain as BCCI announces squad" }))).toBe(true);
    expect(isIndiaCricket(story({ leagueLabel: "Ranji Trophy 2026-27" }))).toBe(true);
    expect(isIndiaCricket(story({ title: "Kerala v Goa", venue: "Greenfield International Stadium, Thiruvananthapuram" }))).toBe(true);
  });

  it("leaves other cricket and other sports out", () => {
    expect(isIndiaCricket(story({ homeTeam: "England", awayTeam: "Sri Lanka", title: "England vs Sri Lanka, 3rd ODI" }))).toBe(false);
    expect(isIndiaCricket(story({ title: "Warwickshire vs Leicestershire", leagueLabel: "County Championship" }))).toBe(false);
    expect(isIndiaCricket(story({ category: "football", title: "India draw with Bangladesh" }))).toBe(false);
  });
});

describe("destinationRunCap (India cricket Page: 15/day over 7:00-23:00 IST)", () => {
  // 13:30 UTC = 19:00 IST: 12 of 16 active hours gone -> ~12 expected.
  const evening = new Date("2026-09-26T13:30:00Z");

  it("spreads the day's posts over the active hours", () => {
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 5, evening)).toBe(2);
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 11, evening)).toBe(1);
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 12, evening)).toBe(0);
  });

  it("posts nothing at night or once the day's limit is reached", () => {
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 0, new Date("2026-09-26T20:00:00Z"))).toBe(0); // 01:30 IST
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 15, new Date("2026-09-26T17:00:00Z"))).toBe(0);
  });

  it("counts the day from local midnight", () => {
    expect(localDayStart(evening, "Asia/Kolkata").toISOString()).toBe("2026-09-25T18:30:00.000Z");
  });
});
