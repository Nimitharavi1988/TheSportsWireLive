/**
 * Pulls today's Google Trends daily trending searches and uses them, plus
 * two other signals, to score already-ingested articles for ranking:
 *  - Google Trends search volume (this file) — what people are searching.
 *  - Reddit hot-post engagement (redditEngagement.ts) — what people are
 *    actually discussing right now, a real engagement signal Trends alone
 *    misses.
 *  - Event-type/superstar keyword heuristics (eventKeywords.ts,
 *    players.ts) — catches high-interest story types (transfers, records,
 *    deaths) and superstar-player stories that neither of the above
 *    reliably catches on their own.
 * Higher trendingScore surfaces an article first on the homepage and gets
 * it priority for the limited Gemini commentary budget during ingestion.
 *
 * Uses an unofficial Google Trends client (no official public API exists
 * yet). Treat this as best-effort: if Google changes something and this
 * breaks, ingestion should keep working without it (everything just gets
 * a lower trendingScore, same as before — the other two signals still
 * apply).
 */
import GoogleTrendsApi from "@alkalisummer/google-trends-js";
import { EVENT_KEYWORDS } from "../eventKeywords";
import { SUPERSTAR_SEARCH_TERMS } from "../players";

// BBC/Sky/Guardian — most of this site's RSS sources — are UK outlets, so
// US-only search trends were a real mismatch for a lot of the content.
// Both geos are queried and merged; either one failing independently
// (rather than a single combined call) keeps the other's results.
const TRENDS_GEOS = ["US", "GB"];

export async function fetchTrendingKeywords(): Promise<string[]> {
  const results = await Promise.all(
    TRENDS_GEOS.map(async (geo) => {
      try {
        const result = await GoogleTrendsApi.dailyTrends({ geo, hl: "en" });
        const keywords: string[] = [];
        for (const item of result?.data ?? []) {
          if (item.keyword) keywords.push(String(item.keyword).toLowerCase());
          for (const related of item.relatedKeywords ?? []) {
            keywords.push(String(related).toLowerCase());
          }
        }
        return keywords;
      } catch (err) {
        console.error(`Google Trends fetch failed for geo=${geo} (continuing without it):`, err);
        return [];
      }
    })
  );
  return [...new Set(results.flat())];
}

export function computeTrendingScore(
  title: string,
  trendingKeywords: string[],
  redditEngagement?: Map<string, number>
): number {
  const lowerTitle = title.toLowerCase();
  let score = 0;

  for (const keyword of trendingKeywords) {
    if (keyword && lowerTitle.includes(keyword)) {
      score += 10;
    }
  }

  // Event-type stories (transfers, records, deaths) and superstar-player
  // stories are reliably high-interest even when they don't happen to
  // match a currently-trending search term.
  if (EVENT_KEYWORDS.some((kw) => lowerTitle.includes(kw))) {
    score += 8;
  }
  if (SUPERSTAR_SEARCH_TERMS.some((term) => lowerTitle.includes(term.toLowerCase()))) {
    score += 5;
  }

  if (redditEngagement) {
    for (const [term, weight] of redditEngagement) {
      if (lowerTitle.includes(term)) {
        score += weight;
      }
    }
  }

  return score;
}