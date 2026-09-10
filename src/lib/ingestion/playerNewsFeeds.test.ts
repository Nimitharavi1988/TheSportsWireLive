import { describe, it, expect } from "vitest";
import { googleNewsSearchUrl, stripPublisherSuffix, extractPublisher, looksLikeReferencePage } from "./playerNewsFeeds";

describe("googleNewsSearchUrl", () => {
  it("wraps the name in quotes and adds a 3-day recency window", () => {
    const url = googleNewsSearchUrl("Sanju Samson");
    expect(url).toContain(encodeURIComponent('"Sanju Samson" when:3d'));
    expect(url).toContain("hl=en-US&gl=US&ceid=US:en");
  });
});

describe("stripPublisherSuffix", () => {
  it("removes a trailing ' - Publisher' suffix that matches the known publisher", () => {
    expect(stripPublisherSuffix("Bumrah fit for T20Is - Cricinfo", "Cricinfo")).toBe("Bumrah fit for T20Is");
  });

  it("leaves the title untouched when there's no publisher to match against", () => {
    expect(stripPublisherSuffix("Bumrah fit for T20Is - Cricinfo", undefined)).toBe("Bumrah fit for T20Is - Cricinfo");
  });

  it("leaves the title untouched when it doesn't actually end with that publisher's suffix", () => {
    expect(stripPublisherSuffix("Bumrah fit for T20Is", "Cricinfo")).toBe("Bumrah fit for T20Is");
  });

  it("only strips the real trailing suffix, not an earlier occurrence of ' - Publisher' in the title", () => {
    // A real headline could legitimately contain " - X" mid-title (e.g. a
    // subtitle) — only the trailing occurrence should ever be stripped.
    expect(stripPublisherSuffix("Player - Coach spat resurfaces - ESPN", "ESPN")).toBe("Player - Coach spat resurfaces");
  });
});

describe("extractPublisher", () => {
  it("extracts the publisher name from a Google News-style <source> tag (text + url attribute)", () => {
    expect(extractPublisher({ sourceTag: { _: "ESPN", $: { url: "https://espn.com" } } })).toBe("ESPN");
  });

  it("handles a plain string source tag too", () => {
    expect(extractPublisher({ sourceTag: "ESPN" })).toBe("ESPN");
  });

  it("trims whitespace", () => {
    expect(extractPublisher({ sourceTag: { _: "  ESPN  " } })).toBe("ESPN");
  });

  it("returns undefined when there's no source tag at all", () => {
    expect(extractPublisher({})).toBeUndefined();
  });

  it("returns undefined for an empty/whitespace-only source tag", () => {
    expect(extractPublisher({ sourceTag: { _: "   " } })).toBeUndefined();
  });
});

describe("looksLikeReferencePage", () => {
  // Both real examples caught live in production (2026-09-10).
  it("rejects a bare-name title with no real headline content", () => {
    expect(looksLikeReferencePage("Shane Warne", "Britannica", "Shane Warne")).toBe(true);
  });

  it("rejects a templated stats-aggregator title", () => {
    expect(
      looksLikeReferencePage(
        "Suryakumar Yadav | Profile, Stats, Ranking, Videos, Career Info, Age, Latest News, & Highlights",
        "Some Stats Site",
        "Suryakumar Yadav"
      )
    ).toBe(true);
  });

  it("rejects anything from Britannica outright, even with a headline-shaped title", () => {
    expect(looksLikeReferencePage("Bumrah's rise to become India's premier pacer", "Britannica", "Jasprit Bumrah")).toBe(true);
  });

  it("bare-name match is case-insensitive and ignores surrounding whitespace", () => {
    expect(looksLikeReferencePage("  shane warne  ", "Some Site", "Shane Warne")).toBe(true);
  });

  it("does not reject a real headline that happens to contain the player's name plus real content", () => {
    expect(looksLikeReferencePage("Bumrah fit, Yash Thakur replaces Harshit for Afghanistan T20Is", "Cricinfo", "Jasprit Bumrah")).toBe(
      false
    );
  });

  it("does not reject a real headline that uses 'profile' in an ordinary sentence, without the aggregator combo", () => {
    expect(looksLikeReferencePage("A profile of Messi's incredible season so far", "The Guardian", "Lionel Messi")).toBe(false);
  });
});
