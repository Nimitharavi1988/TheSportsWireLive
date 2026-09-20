import { describe, it, expect } from "vitest";
import { hasRealImage, isAutoApprovable } from "./contentQuality";

describe("hasRealImage", () => {
  it("treats a team crest pair as a real image", () => {
    expect(hasRealImage({ heroImageUrl: null, homeCrestUrl: "https://crests.football-data.org/1.png" })).toBe(true);
  });

  it("treats a non-Pexels heroImageUrl as a real image (publisher photo, player photo, etc.)", () => {
    expect(hasRealImage({ heroImageUrl: "https://ichef.bbci.co.uk/photo.jpg", homeCrestUrl: null })).toBe(true);
    expect(hasRealImage({ heroImageUrl: "https://thumb.wikimedia.org/photo.jpg", homeCrestUrl: null })).toBe(true);
  });

  it("does not treat a generic Pexels stock photo as a real image", () => {
    expect(hasRealImage({ heroImageUrl: "https://images.pexels.com/photos/1/stock.jpeg", homeCrestUrl: null })).toBe(false);
  });

  it("does not treat no image at all as a real image", () => {
    expect(hasRealImage({ heroImageUrl: null, homeCrestUrl: null })).toBe(false);
  });

  // Confirmed live 2026-09-20: ESPN Cricinfo's RSS feed occasionally supplies
  // a bare-domain media:content url with no real path.
  it("does not treat a bare-domain URL (no path) as a real image", () => {
    expect(hasRealImage({ heroImageUrl: "https://p.imgci.com", homeCrestUrl: null })).toBe(false);
  });

  it("does not treat an unparseable heroImageUrl as a real image", () => {
    expect(hasRealImage({ heroImageUrl: "not-a-url", homeCrestUrl: null })).toBe(false);
  });
});

describe("isAutoApprovable", () => {
  const realBody = "A".repeat(300);
  const thinBody = "Too short.";
  const realImage = { heroImageUrl: "https://ichef.bbci.co.uk/photo.jpg", homeCrestUrl: null };
  const stockImage = { heroImageUrl: "https://images.pexels.com/photos/1/stock.jpeg", homeCrestUrl: null };
  const rssSource = "BBC Sport";

  it("approves an article with a real substantive body and a real image", () => {
    expect(isAutoApprovable({ body: realBody, ...realImage, playerNewsSourced: false, sourceName: rssSource })).toBe(true);
  });

  it("rejects a non-player-news article with no body at all", () => {
    expect(isAutoApprovable({ body: null, ...realImage, playerNewsSourced: false, sourceName: rssSource })).toBe(false);
  });

  it("rejects an article whose body is too short (a bare template, not real commentary)", () => {
    expect(isAutoApprovable({ body: thinBody, ...realImage, playerNewsSourced: false, sourceName: rssSource })).toBe(false);
  });

  it("rejects an article with a real body but only a generic stock photo", () => {
    expect(isAutoApprovable({ body: realBody, ...stockImage, playerNewsSourced: false, sourceName: rssSource })).toBe(false);
  });

  it("rejects an article with neither a real body nor a real image", () => {
    expect(isAutoApprovable({ body: null, ...stockImage, playerNewsSourced: false, sourceName: rssSource })).toBe(false);
  });

  it("counts a crest-based match article with a real body as approvable", () => {
    expect(
      isAutoApprovable({ body: realBody, heroImageUrl: null, homeCrestUrl: "https://crests.football-data.org/1.png", playerNewsSourced: false, sourceName: rssSource })
    ).toBe(true);
  });

  it("rejects a player-news item with no body, even with a real image (extraction now attempted for these)", () => {
    expect(isAutoApprovable({ body: null, ...realImage, playerNewsSourced: true, sourceName: rssSource })).toBe(false);
  });

  it("approves a player-news item once extraction gave it a real body and it has a real image", () => {
    expect(isAutoApprovable({ body: realBody, ...realImage, playerNewsSourced: true, sourceName: rssSource })).toBe(true);
  });

  it("still rejects a player-news item with only a generic stock photo", () => {
    expect(isAutoApprovable({ body: realBody, ...stockImage, playerNewsSourced: true, sourceName: rssSource })).toBe(false);
  });

  // Match-data preview/result templates ("Team A face Team B in MLB...")
  // are inherently terse but fully real, pre-vetted content — confirmed
  // live: every pending MLB Stats API item was sitting at 135-149 chars,
  // just under the 150-char bar meant for catching thin/garbled RSS scrapes.
  it("approves a match-data article with a shorter body that would fail the RSS bar", () => {
    const shortMatchBody = "Boston Red Sox face Kansas City Royals in MLB. First pitch is Sat, Sep 12, 2026, 8:10 PM UTC.";
    expect(shortMatchBody.length).toBeLessThan(150);
    expect(
      isAutoApprovable({ body: shortMatchBody, ...realImage, playerNewsSourced: false, sourceName: "MLB Stats API" })
    ).toBe(true);
  });

  it("still rejects a match-data article whose body is too thin even for the lower bar", () => {
    expect(isAutoApprovable({ body: thinBody, ...realImage, playerNewsSourced: false, sourceName: "MLB Stats API" })).toBe(false);
  });
});
