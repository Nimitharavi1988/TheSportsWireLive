import { describe, it, expect } from "vitest";
import { buildEnrichPrompt, creditLine, enrichedToday, pickCandidates, pruneLog, type EnrichCandidate, type EnrichLogEntry } from "./enrichRules";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
const story = (id: string, over: Partial<EnrichCandidate> = {}): EnrichCandidate => ({
  id, title: "Rays beat Yankees in Game 1", body: words(120), summary: "Short.", heroImageUrl: "https://img.mlb.com/rays.jpg", homeCrestUrl: null, ...over,
});
const now = new Date("2026-10-04T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

describe("enriching top stories", () => {
  it("picks real, short stories with a real photo that weren't tried, in order", () => {
    const rows = [
      story("a"),
      story("b", { title: "Open Thread: Blues @ Avalanche" }),
      story("c", { heroImageUrl: "https://images.pexels.com/stock.jpg" }),
      story("d", { body: words(400) }),
      story("e"),
      story("f"),
    ];
    const log: EnrichLogEntry[] = [{ id: "e", at: hoursAgo(1), result: "few-facts" }];
    expect(pickCandidates(rows, log, 2).map((r) => r.id)).toEqual(["a", "f"]);
  });

  it("counts today's enrichments and forgets old attempts", () => {
    const log: EnrichLogEntry[] = [
      { id: "1", at: hoursAgo(2), result: "enriched" },
      { id: "2", at: hoursAgo(3), result: "few-facts" },
      { id: "3", at: hoursAgo(30), result: "enriched" },
      { id: "4", at: hoursAgo(80), result: "enriched" },
    ];
    expect(enrichedToday(log, now)).toBe(1);
    expect(pruneLog(log, now).map((e) => e.id)).toEqual(["1", "2", "3"]);
  });

  it("credits the other outlets, not the original publisher", () => {
    expect(creditLine(["mlb.com", "espn.com", "cbssports.com"], "MLB.com")).toBe("This report also draws on coverage from espn.com, cbssports.com.");
    expect(creditLine(["mlb.com"], "MLB.com")).toBeNull();
    expect(creditLine(["youtube.com", "ground.news", "apnews.com"], "Yahoo Sports")).toBe("This report also draws on coverage from apnews.com.");
    expect(creditLine([], "BBC Sport")).toBeNull();
    // a name with a space is still the original publisher, and repeats are listed once
    expect(creditLine(["Yahoo Sports", "Fox Sports", "fox sports", "MLB.com"], "Yahoo Sports")).toBe("This report also draws on coverage from Fox Sports, MLB.com.");
  });

  it("puts the facts and the headline into the prompt", () => {
    const p = buildEnrichPrompt({ title: "Rays beat Yankees", sourceName: "MLB.com", text: "Short.", facts: ["Rays won 1-0"] });
    expect(p).toContain("Headline (keep the story about exactly this): Rays beat Yankees");
    expect(p).toContain("- Rays won 1-0");
  });
});
