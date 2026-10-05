import { describe, it, expect } from "vitest";
import { isReadableUrl, keepGroundedFacts, outletsOf, pickRelated, type CoverageRow } from "./coverageRules";

const row = (id: string, title: string, sourceName: string, over: Partial<CoverageRow> = {}): CoverageRow => ({
  id, title, sourceName, summary: "summary text ".repeat(10), sourceUrl: `https://${sourceName.toLowerCase()}.com/a`, ...over,
});

describe("isReadableUrl", () => {
  it("rejects Google News redirects and junk", () => {
    expect(isReadableUrl("https://news.google.com/rss/articles/abc")).toBe(false);
    expect(isReadableUrl("not a url")).toBe(false);
    expect(isReadableUrl("https://bbc.com/sport/1")).toBe(true);
  });
});

describe("pickRelated", () => {
  const s = row("1", "Yankees beat Red Sox 5-3 in extra innings thriller", "ESPN");
  it("keeps the story first, one per outlet, same event only", () => {
    const out = pickRelated(s, [
      row("2", "Yankees beat Red Sox 5-3 in extra innings", "CBS"),
      row("3", "Yankees edge Red Sox 5-3 in extra innings thriller", "CBS"),
      row("4", "Lakers sign veteran guard to one-year deal", "NBA"),
      row("5", "Yankees beat Red Sox 5-3 extra innings thriller Fenway", "ESPN"),
      row("6", "Red Sox Yankees extra innings Fenway crowd reaction", "ESPN"),
    ]);
    expect(out.map((r) => r.id).sort()).toEqual(["1", "2", "3", "5"]);
  });
  it("puts readable pages ahead of unreadable ones and caps the count", () => {
    const many = Array.from({ length: 9 }, (_, i) => row(`x${i}`, "Yankees beat Red Sox 5-3 in extra innings thriller", `Out${i}`, i === 0 ? { sourceUrl: "https://news.google.com/x" } : {}));
    const out = pickRelated(s, many, 3);
    expect(out).toHaveLength(3);
    expect(out.some((r) => r.id === "x0")).toBe(false);
  });
});

describe("keepGroundedFacts", () => {
  const ex = [{ outlet: "A", text: "The Yankees won 5-3 before a crowd of 41,200 at Fenway." }];
  it("drops figures missing from the coverage, duplicates and non-strings", () => {
    const { facts, dropped } = keepGroundedFacts([
      "The Yankees won 5-3 before a crowd of 41,200 at Fenway.",
      "the yankees won 5-3 before a crowd of 41,200 at fenway.",
      "Aaron Judge hit a 462 foot home run for the Yankees.",
      42,
      "short",
    ], ex);
    expect(facts).toEqual(["The Yankees won 5-3 before a crowd of 41,200 at Fenway."]);
    expect(dropped).toBe(1);
  });
  it("handles a non-array", () => {
    expect(keepGroundedFacts(undefined, ex)).toEqual({ facts: [], dropped: 0 });
  });
});

describe("outletsOf", () => {
  it("lists each outlet once", () => {
    expect(outletsOf([{ outlet: "A", text: "" }, { outlet: "B", text: "" }, { outlet: "A", text: "" }])).toEqual(["A", "B"]);
  });
});
