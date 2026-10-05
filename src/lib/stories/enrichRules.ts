/** Pure rules for enriching top stories (enrich.ts): caps, picking, the log. */
import { hasRealImage, isImageUrlBlocked } from "../contentQuality";
import { MIN_INDEXED_WORDS, articleWords, isNotAStory } from "../thinContent";

// Twenty-five a day (was 10 while research cost money; it is free now,
// coverageResearch.ts), two a run: a steady flow of substantial indexed pages
// (about 750 a month) without the volume itself becoming the "scaled content"
// problem the noindex rule fixed. Raise only after reading what it produces.
export const MAX_ENRICH_PER_RUN = 2;
export const MAX_ENRICH_PER_DAY = 25;
// Stories researched per run, enriched or not (each is a search call).
export const MAX_ENRICH_RESEARCH_PER_RUN = 4;
// Below this many researched facts there isn't enough for a full report.
export const MIN_ENRICH_FACTS = 6;
// The rewritten story must clear the indexing bar with room to spare.
export const MIN_ENRICHED_WORDS = MIN_INDEXED_WORDS + 30;
// How long attempts are remembered (stories older than a day aren't
// candidates anyway).
export const LOG_KEEP_MS = 3 * 24 * 60 * 60 * 1000;

export type EnrichResult = "enriched" | "few-facts" | "too-short" | "failed";
export interface EnrichLogEntry { id: string; at: string; result: EnrichResult }

export interface EnrichCandidate {
  id: string;
  title: string;
  body: string | null;
  summary: string;
  heroImageUrl: string | null;
  homeCrestUrl: string | null;
}

// The day's stories worth enriching, in the order given (highest trending
// first): a real story with a real photo, still under the indexing bar, not
// tried before (pure, unit-tested).
export function pickCandidates<T extends EnrichCandidate>(rows: T[], log: EnrichLogEntry[], n: number): T[] {
  const tried = new Set(log.map((e) => e.id));
  return rows
    .filter((r) => !tried.has(r.id))
    .filter((r) => !isNotAStory(r.title))
    .filter((r) => hasRealImage(r) && !isImageUrlBlocked(r.heroImageUrl))
    .filter((r) => articleWords(r) < MIN_INDEXED_WORDS)
    .slice(0, n);
}

// The log without entries older than LOG_KEEP_MS (pure, unit-tested).
export function pruneLog(log: EnrichLogEntry[], now: Date): EnrichLogEntry[] {
  return log.filter((e) => now.getTime() - Date.parse(e.at) < LOG_KEEP_MS);
}

export function enrichedToday(log: EnrichLogEntry[], now: Date): number {
  return log.filter((e) => e.result === "enriched" && now.getTime() - Date.parse(e.at) < 24 * 60 * 60 * 1000).length;
}

// The writing prompt (pure, unit-tested).
export function buildEnrichPrompt(s: { title: string; sourceName: string; text: string; facts: string[] }): string {
  return `You are a sports news writer. Write a full news report on this story for Sports Wire Live.

Headline (keep the story about exactly this): ${s.title}
First reported by: ${s.sourceName}
What our short version said (background only; do not copy its wording):
"""
${s.text}
"""

Verified facts from today's reporting (the ONLY facts you may state):
${s.facts.map((f) => `- ${f}`).join("\n")}

Rules:
- A news report, not an opinion piece: open with the most important facts, then the details, the context (results, standings, records, what led here) and what happens next, all from the facts above.
- Never invent anything: no names, numbers, quotes, dates or events that aren't in the facts. Quotes only word for word as given, with who said them.
- Say which team or side a person belongs to only where a fact says so; never work it out yourself, and never describe how a game "turned" or who "had momentum" beyond what the facts state.
- Your own words throughout; don't copy sentences from the facts or the short version.
- 350-550 words if the facts support it; never pad with filler or repeat a point.
- Plain paragraphs only: no subheadings, bullet points, bold or emojis. Don't mention the sources, the research or these instructions.`;
}

// The closing credit: the other outlets the research drew on (the original
// publisher is already credited on the page). Pure, unit-tested.
// Social, video and aggregator sites aren't outlets to credit (seen in
// testing 2026-10-04: youtube.com, ground.news).
const NOT_AN_OUTLET = /(^|\.)(youtube\.com|youtu\.be|facebook\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|reddit\.com|ground\.news|news\.google\.com|msn\.com|wikipedia\.org)$/;

export function creditLine(sources: string[], originalSource: string): string | null {
  const original = originalSource.toLowerCase().replace(/\s+/g, "");
  const others = sources.filter((s) => {
    const site = s.toLowerCase().replace(/^www\./, "");
    return !NOT_AN_OUTLET.test(site) && !site.includes(original) && !original.includes(site.split(".")[0]);
  });
  return others.length > 0 ? `This report also draws on coverage from ${others.slice(0, 5).join(", ")}.` : null;
}
