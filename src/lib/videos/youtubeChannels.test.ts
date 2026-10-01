import { describe, it, expect } from "vitest";
import { CRICKET_TITLE, YOUTUBE_CHANNELS } from "./youtubeChannels";

describe("CRICKET_TITLE", () => {
  it("accepts cricket titles, including league hashtags with a sponsor prefix", () => {
    for (const t of [
      "Post-Match Reactions: Kuldeep, Kohli & Gill steal the show in 1st ODI vs WI | #INDvWI",
      "#TATAWPL Auction Prep: Every team's retentions, released players & purse Strategy",
      "Chris Gayle Answers the Q20s Like a Boss on His Birthday! | #CPL 2026",
      "Japan vs India | Match Highlights | Only T20I | #JPNvIND",
      "Virat Kohli's 139* in the ODIs",
    ]) {
      expect(CRICKET_TITLE.test(t), t).toBe(true);
    }
  });
  it("keeps other sports out of a multi-sport channel", () => {
    for (const t of ["Premier League highlights: Arsenal 2-1 Chelsea", "Gold medal clash in badminton | #AsianGames", "Super Bowl halftime show"]) {
      expect(CRICKET_TITLE.test(t), t).toBe(false);
    }
  });
});

describe("YOUTUBE_CHANNELS", () => {
  it("lists each channel once, with a well-formed id", () => {
    const ids = YOUTUBE_CHANNELS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^UC[\w-]{22}$/);
  });
  it("lists Sky Sports F1 for Formula 1, and not the official channel that blocks embedding", () => {
    expect(YOUTUBE_CHANNELS.filter((c) => c.category === "formula-1").map((c) => c.title)).toEqual(["Sky Sports F1"]);
    expect(YOUTUBE_CHANNELS.map((c) => c.id)).not.toContain("UCB_qr75-ydFVKSF9Dmo6izg");
  });
  it("lists rugby and athletics channels, and not the look-alike accounts", () => {
    const titles = (cat: string) => YOUTUBE_CHANNELS.filter((c) => c.category === cat).map((c) => c.title);
    expect(titles("rugby")).toEqual(["World Rugby", "United Rugby Championship", "Six Nations Rugby", "England Rugby"]);
    expect(titles("athletics")).toEqual(["World Athletics", "Wanda Diamond League"]);
    // The SMULE-named URC account, Rugby Australia (6 subscribers) and athletics India (4).
    for (const bad of ["UC7eShIHKvX-Zx8Ws5iBGNbA", "UC1_OYKGCxMuLqk7uo_TEwSQ", "UCcVzioDuz20kQ6Jk6qJ6QbA"]) {
      expect(YOUTUBE_CHANNELS.map((c) => c.id)).not.toContain(bad);
    }
  });
  it("includes the West Indies and Cricket Australia channels for cricket", () => {
    const cricket = YOUTUBE_CHANNELS.filter((c) => c.category === "cricket").map((c) => c.title);
    expect(cricket).toEqual(expect.arrayContaining(["Windies Cricket", "cricket.com.au"]));
  });
});
