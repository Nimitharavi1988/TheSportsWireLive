import { describe, it, expect } from "vitest";
import { SPANISH_PAGE, FOOTBALL_PAGE, US_SPORTS_PAGE, FIGHT_PAGE, TOPIC_INSTAGRAM_KEYS, spanishPageEnabled, INDIA_CRICKET_PAGE, CRICKETLIVE_PAGE, TOPIC_DESTINATIONS, effectiveDestination, prioritise, destinationRunCap, isCricketOrAsianGames, isIndiaCricket, localDayStart } from "./facebookDestinations";

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

describe("Spanish Page", () => {
  it("is on by default; FACEBOOK_ES_ENABLED=0 turns it off", () => {
    expect(spanishPageEnabled({} as NodeJS.ProcessEnv)).toBe(true);
    expect(spanishPageEnabled({ FACEBOOK_ES_ENABLED: "" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(spanishPageEnabled({ FACEBOOK_ES_ENABLED: "1" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(spanishPageEnabled({ FACEBOOK_ES_ENABLED: "0" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
  it("has the real Page id and its own Instagram", () => {
    expect(SPANISH_PAGE.pageId).toBeTruthy();
    expect(SPANISH_PAGE.instagramId).toBeTruthy();
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
    expect(after.reels).toMatchObject({ dailyCap: 10, perRunCap: 1 });
  });

  it("leaves Pages without a boost unchanged", () => {
    expect(effectiveDestination(INDIA_CRICKET_PAGE, new Date("2026-10-04T06:00:00Z"))).toBe(INDIA_CRICKET_PAGE);
  });
});

describe("story age limit", () => {
  it("limits both cricket Pages to the last 24 hours and leaves the Spanish Page on the default", () => {
    expect(INDIA_CRICKET_PAGE.maxAgeHours).toBe(24);
    expect(CRICKETLIVE_PAGE.maxAgeHours).toBe(24);
    expect(SPANISH_PAGE.maxAgeHours).toBeUndefined();
  });
});

describe("Sportswirecricketlive own content and reel hours", () => {
  it("skips stories Greenfield took, and posts reels only at midday IST", () => {
    expect(CRICKETLIVE_PAGE.notAlsoOn).toBe(INDIA_CRICKET_PAGE.key);
    expect(INDIA_CRICKET_PAGE.notAlsoOn).toBeUndefined();
    expect(CRICKETLIVE_PAGE.reels?.activeHours).toEqual({ timeZone: "Asia/Kolkata", start: 11, end: 16 });
  });

  it("paces its reels inside those hours and posts none outside them", () => {
    const reels = { ...CRICKETLIVE_PAGE.reels!, activeHours: CRICKETLIVE_PAGE.reels!.activeHours!, overnight: false };
    expect(destinationRunCap(reels, 0, new Date("2026-10-06T07:30:00Z"))).toBe(1); // 13:00 IST
    expect(destinationRunCap(reels, 0, new Date("2026-10-06T03:00:00Z"))).toBe(0); // 08:30 IST
    expect(destinationRunCap(reels, 0, new Date("2026-10-06T13:00:00Z"))).toBe(0); // 18:30 IST
  });

  it("is listed after Greenfield, so Greenfield picks first", () => {
    const keys = TOPIC_DESTINATIONS.map((d) => d.key);
    expect(keys.indexOf("india-cricket")).toBeLessThan(keys.indexOf("cricketlive"));
  });
});

describe("prioritise: the first hour comes first", () => {
  const now = new Date("2026-10-06T10:00:00Z");
  const base = { category: "cricket", homeTeam: null, awayTeam: null, seriesLabel: null, leagueLabel: null, venue: null };
  const at = (title: string, minutesAgo: number | null) => ({ ...base, title, publishedAt: minutesAgo === null ? null : new Date(now.getTime() - minutesAgo * 60_000) });

  it("puts stories under an hour old first, then under 12 hours, then the rest, keeping the incoming order within each", () => {
    const pool = [at("old", 30 * 60), at("hours", 5 * 60), at("fresh-b", 40), at("fresh-a", 5), at("undated", null), at("hours-2", 11 * 60)];
    expect(prioritise(pool, now).map((a) => a.title)).toEqual(["fresh-b", "fresh-a", "hours", "hours-2", "old", "undated"]);
  });

  it("does not treat a future-dated story as being in its first hour", () => {
    const pool = [at("later-today", -30), at("fresh", 10)];
    expect(prioritise(pool, now).map((a) => a.title)).toEqual(["fresh", "later-today"]);
  });
});

describe("reel quality floors", () => {
  it("both cricket Pages skip weak stories; the new Page's floor is a little lower than Greenfield's", () => {
    expect(INDIA_CRICKET_PAGE.reels?.minTrending).toBe(35);
    expect(CRICKETLIVE_PAGE.reels?.minTrending).toBe(25);
  });
});

describe("Sport Pages", () => {
  it("are all posted to, each with its own history key", () => {
    const keys = TOPIC_DESTINATIONS.map((d) => d.key);
    for (const k of ["football", "us-sports", "fight"]) expect(keys).toContain(k);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("keep soccer and American football apart", () => {
    expect(FOOTBALL_PAGE.categories ?? [FOOTBALL_PAGE.sport]).toEqual(["football"]);
    expect(US_SPORTS_PAGE.categories).toEqual(expect.arrayContaining(["american-football", "college-football", "basketball", "wnba", "baseball", "hockey"]));
    expect(US_SPORTS_PAGE.categories).not.toContain("football");
    expect(FIGHT_PAGE.categories).toEqual(["mma", "boxing"]);
  });
  it("lists the Instagram-linked Pages so the main account's checks leave them out", () => {
    expect([...TOPIC_INSTAGRAM_KEYS].sort()).toEqual(["cricketlive", "cricketlive-reel", "es", "es-reel", "football", "football-reel", "us-sports", "us-sports-reel"]);
    expect(TOPIC_INSTAGRAM_KEYS).not.toContain("main");
  });
});

describe("Football Page focus (Messi, 7 Oct)", () => {
  const story = (title: string) => ({ category: "football", title, homeTeam: null, awayTeam: null, seriesLabel: null, leagueLabel: null, venue: null, publishedAt: new Date("2026-10-07T00:00:00Z") });
  const pool = [story("Tuchel on the Nations League"), story("Gracias, Leo: the night the Monumental said goodbye to Messi"), story("Messina sign a striker")];
  it("puts Messi stories first until the focus ends", () => {
    const during = prioritise(pool, new Date("2026-10-07T12:00:00Z"), FOOTBALL_PAGE.focus);
    expect(during[0].title).toContain("Messi");
    expect(during[1].title).toContain("Tuchel"); // "Messina" is not Messi
    const after = prioritise(pool, new Date("2026-10-07T22:30:00Z"), FOOTBALL_PAGE.focus);
    expect(after[0].title).toContain("Tuchel");
  });
});

describe("hook-first caption test", () => {
  it("runs on Greenfield only, never on the photo-question Page", () => {
    expect(INDIA_CRICKET_PAGE.captionTest).toBe(true);
    expect(CRICKETLIVE_PAGE.captionTest).toBe(false);
    expect(SPANISH_PAGE.captionTest).toBeUndefined();
  });
});
