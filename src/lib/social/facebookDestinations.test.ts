import { describe, it, expect } from "vitest";
import { SPANISH_PAGE, spanishPageEnabled, INDIA_CRICKET_PAGE, CRICKETLIVE_PAGE, TOPIC_DESTINATIONS, effectiveDestination, destinationRunCap, isCricketOrAsianGames, isIndiaCricket, localDayStart } from "./facebookDestinations";

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

describe("isCricketOrAsianGames", () => {
  it("takes all cricket and Asian Games stories in any sport, nothing else", () => {
    expect(isCricketOrAsianGames(story({ title: "England vs Sri Lanka, 3rd ODI" }))).toBe(true);
    expect(isCricketOrAsianGames(story({ category: "athletics", title: "Asian Games: Chanu wins weightlifting silver" }))).toBe(true);
    expect(isCricketOrAsianGames(story({ category: "football", title: "Arsenal beat Spurs" }))).toBe(false);
  });
});

describe("destinationRunCap (India cricket Page: 30/day over 7:00-23:00 IST)", () => {
  // 13:30 UTC = 19:00 IST: 12 of 16 active hours gone -> ~12 expected.
  const evening = new Date("2026-09-26T13:30:00Z");

  it("spreads the day's posts over the active hours", () => {
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 5, evening)).toBe(3);
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 28, evening)).toBe(2);
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 30, evening)).toBe(0);
  });

  it("posts nothing at night or once the day's limit is reached", () => {
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 0, new Date("2026-09-26T20:00:00Z"))).toBe(0); // 01:30 IST
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 30, new Date("2026-09-26T17:00:00Z"))).toBe(0);
  });

  it("keeps overnight low intensity: one post in the first run of every second hour", () => {
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 0, new Date("2026-09-26T20:30:00Z"))).toBe(1); // 02:00 IST
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 0, new Date("2026-09-26T21:30:00Z"))).toBe(0); // 03:00 IST
    expect(destinationRunCap(INDIA_CRICKET_PAGE, 30, new Date("2026-09-26T20:30:00Z"))).toBe(0);
  });

  it("can be daytime-only (reels): nothing overnight, spread over the day", () => {
    const reels = { ...INDIA_CRICKET_PAGE.reels!, activeHours: INDIA_CRICKET_PAGE.activeHours, overnight: false };
    expect(destinationRunCap(reels, 0, new Date("2026-09-26T20:30:00Z"))).toBe(0); // 02:00 IST
    expect(destinationRunCap(reels, 0, evening)).toBe(1);
    expect(destinationRunCap(reels, 4, evening)).toBe(0);
  });

  it("counts the day from local midnight", () => {
    expect(localDayStart(evening, "Asia/Kolkata").toISOString()).toBe("2026-09-25T18:30:00.000Z");
  });
});

describe("Spanish Page (flagged)", () => {
  it("is off unless the flag AND the Page id are set", () => {
    expect(spanishPageEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(spanishPageEnabled({ FACEBOOK_ES_ENABLED: "1" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(spanishPageEnabled({ FACEBOOK_PAGE_ES_ID: "123" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(spanishPageEnabled({ FACEBOOK_ES_ENABLED: "0", FACEBOOK_PAGE_ES_ID: "123" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(spanishPageEnabled({ FACEBOOK_ES_ENABLED: "1", FACEBOOK_PAGE_ES_ID: "123" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });
  it("is a language-edition Page covering the Spanish sports", () => {
    expect(SPANISH_PAGE.locale).toBe("es");
    expect(SPANISH_PAGE.key).toBe("es");
    expect(SPANISH_PAGE.categories).toContain("football");
    expect(SPANISH_PAGE.categories).not.toContain("cricket");
  });
  it("posts through the same daily pacing as the other Pages", () => {
    const evening = new Date("2026-10-03T20:00:00Z");
    expect(destinationRunCap(SPANISH_PAGE, 0, evening)).toBeGreaterThan(0);
    expect(destinationRunCap(SPANISH_PAGE, SPANISH_PAGE.dailyCap, evening)).toBe(0);
  });
  it("has Spanish hashtags with the brand tag, at most 3", () => {
    const tags = SPANISH_PAGE.hashtags!("Real Madrid vence al Barcelona", "football");
    expect(tags[0]).toBe("#Futbol");
    expect(tags).toContain("#SportsWireLive");
    expect(tags.length).toBeLessThanOrEqual(3);
  });
});

describe("Sportswirecricketlive test Page", () => {
  it("covers the same stories as the India cricket Page, with its own history key", () => {
    expect(CRICKETLIVE_PAGE.matches).toBe(INDIA_CRICKET_PAGE.matches);
    expect(CRICKETLIVE_PAGE.key).not.toBe(INDIA_CRICKET_PAGE.key);
    expect(TOPIC_DESTINATIONS.map((d) => d.key)).toContain("cricketlive");
  });

  it("posts far less, as photo + question, and leaves the India cricket Page unchanged", () => {
    expect(CRICKETLIVE_PAGE.dailyCap).toBe(10);
    expect(CRICKETLIVE_PAGE.perRunCap).toBe(1);
    expect(CRICKETLIVE_PAGE.reels?.dailyCap).toBe(10);
    expect(CRICKETLIVE_PAGE.style).toBe("photo-question");
    expect(INDIA_CRICKET_PAGE.dailyCap).toBe(30);
    expect(INDIA_CRICKET_PAGE.style).toBeUndefined();
  });
});

describe("effectiveDestination (first-day boost)", () => {
  it("applies the boost limits until its end, then the normal limits", () => {
    const during = effectiveDestination(CRICKETLIVE_PAGE, new Date("2026-10-04T06:00:00Z"));
    expect(during.dailyCap).toBe(30);
    expect(during.reels).toEqual({ dailyCap: 30, perRunCap: 1 });
    const after = effectiveDestination(CRICKETLIVE_PAGE, new Date("2026-10-04T18:30:00Z"));
    expect(after.dailyCap).toBe(10);
    expect(after.reels).toEqual({ dailyCap: 10, perRunCap: 1 });
  });

  it("leaves Pages without a boost unchanged", () => {
    expect(effectiveDestination(INDIA_CRICKET_PAGE, new Date("2026-10-04T06:00:00Z"))).toBe(INDIA_CRICKET_PAGE);
  });
});
