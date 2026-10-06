import { describe, it, expect } from "vitest";
import { buildEnrichPrompt, creditLine, enrichedToday, pickCandidates, pruneLog, unsupportedFigures, enrichLimitsFrom, mentionsItsInputs, isRepetitive, sameEventAsEnriched, mergeLogs, type EnrichCandidate, type EnrichLogEntry } from "./enrichRules";

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

  it("flags figures in the article that no researched fact (or the headline) has", () => {
    const facts = ["The Panthers beat the Lions 32-26.", "Jared Goff passed for 412 yards."];
    expect(unsupportedFigures("Goff threw for 412 yards in a 32-26 game.", facts, "Panthers hold off Lions")).toEqual([]);
    expect(unsupportedFigures("Goff threw for 512 yards, a career best 1,250 on the season.", facts, "Panthers hold off Lions")).toEqual(["512", "1250"]);
    expect(unsupportedFigures("Goff threw 38 passes in 2026.", facts, "x")).toEqual([]); // short numbers and years are not checked
  });

  it("tells the writer not to pad with outlook or invented streaks", () => {
    const p = buildEnrichPrompt({ title: "t", sourceName: "s", text: "x", facts: ["f"] });
    expect(p).toContain("No filler");
    expect(p).toContain("ONLY if a fact names it");
  });

  it("puts the facts and the headline into the prompt", () => {
    const p = buildEnrichPrompt({ title: "Rays beat Yankees", sourceName: "MLB.com", text: "Short.", facts: ["Rays won 1-0"] });
    expect(p).toContain("Headline (keep the story about exactly this): Rays beat Yankees");
    expect(p).toContain("- Rays won 1-0");
  });
});

describe("enrichment limits and the shared log", () => {
  it("reads the limits from the environment, falling back for empty or invalid values", () => {
    expect(enrichLimitsFrom({})).toEqual({ perRun: 2, perDay: 15, researchPerRun: 4 });
    expect(enrichLimitsFrom({ ENRICH_MAX_PER_DAY: "60", ENRICH_MAX_PER_RUN: " 4 ", ENRICH_MAX_RESEARCH_PER_RUN: "12" })).toEqual({ perRun: 4, perDay: 60, researchPerRun: 12 });
    for (const bad of ["", "  ", "abc", "0", "-3"]) expect(enrichLimitsFrom({ ENRICH_MAX_PER_DAY: bad }).perDay).toBe(15);
  });
  it("merges two logs without losing or duplicating entries", () => {
    const a: EnrichLogEntry[] = [{ id: "1", at: "2026-10-06T10:00:00Z", result: "enriched" }];
    const b: EnrichLogEntry[] = [{ id: "1", at: "2026-10-06T10:00:00Z", result: "enriched" }, { id: "2", at: "2026-10-06T09:00:00Z", result: "few-facts" }];
    const m = mergeLogs(a, b);
    expect(m.map((e) => e.id)).toEqual(["2", "1"]);
    expect(mergeLogs([], [])).toEqual([]);
  });
});

describe("an article that talks about its own inputs", () => {
  it("is caught", () => {
    for (const bad of [
      "While the provided facts do not repeat his all-time goal record, he is 41.",
      "No further schedule details or opponent information are provided beyond the home opener.",
      "The verified facts say little.",
      "According to the research, the team won.",
      "The report concludes with his own words.",
    ]) expect(mentionsItsInputs(bad)).not.toBeNull();
  });
  it("leaves ordinary reporting alone", () => {
    for (const ok of [
      "Rosenhaus told ESPN he will begin negotiations.",
      "The Panthers beat the Lions 32-26 in Charlotte.",
      "Details of the contract were not disclosed.",
      "The report from Sunday said he was fine.",
    ]) expect(mentionsItsInputs(ok)).toBeNull();
  });
});

describe("repetitive prose and same-event enrichment", () => {
  it("catches an article that opens most sentences the same way, or repeats a phrase", () => {
    const bad = [
      "Dave Williams stated that he sent texts to players and an executive.",
      "Dave Williams stated that he texted Sean Burke during the game.",
      "Dave Williams stated that he also contacted Mike Vasil and a front office executive.",
      "Dave Williams stated that all of them replied that they knew.",
    ].join(" ");
    expect(isRepetitive(bad)).toBe(true);
    expect(isRepetitive("He reached 30 goals in every season of his career except 2020-21. Later he reached 30 goals in every season of his career except 2020-21.")).toBe(true);
  });
  it("leaves normal reporting alone", () => {
    const ok = "The Panthers beat the Lions 32-26 in Charlotte on Sunday night. Chuba Hubbard scored from 15 yards in the first quarter. Jared Goff passed for 412 yards, but the Lions' final drive ended in a four-and-out. Cris Collinsworth called it a disaster. The Panthers moved atop the NFC South at 2-2.";
    expect(isRepetitive(ok)).toBe(false);
  });
  it("treats the four Ovechkin retirement headlines as one event, but not different Chiefs stories", () => {
    const done = ["NHL’s all-time leading goalscorer Alex Ovechkin to retire at end of season"];
    for (const t of [
      "Who can break Alex Ovechkin's goal record as Capitals star plays final season?",
      "Evgeni Malkin responds to Alex Ovechkin’s retirement announcment",
      "Alex Ovechkin announces retirement to Capitals teammates to start 22nd season",
    ]) expect(sameEventAsEnriched(t, done)).toBe(true);
    const chiefs = ["Chiefs News: Chiefs have shown interest in bringing back Tyreek Hill"];
    expect(sameEventAsEnriched("Chiefs’ Tyquan Thornton to have surgery with ‘12 to 16-week’ recovery timeline", chiefs)).toBe(false);
    expect(sameEventAsEnriched("Detroit Lions grades: Defense is beyond embarrassing vs. Panthers", chiefs)).toBe(false);
  });
});
