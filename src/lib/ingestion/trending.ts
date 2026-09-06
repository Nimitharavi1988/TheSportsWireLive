/**
 * Pulls today's Google Trends daily trending searches and uses them to
 * score already-ingested articles — if a trending keyword appears in an
 * article's title, it's more likely to be what people are searching for
 * right now, so it gets a higher trendingScore and surfaces first.
 *
 * Uses an unofficial Google Trends client (no official public API exists
 * yet). Treat this as best-effort: if Google changes something and this
 * breaks, ingestion should keep working without it (everything just gets
 * trendingScore 0, same as before).
 */
import GoogleTrendsApi from "@alkalisummer/google-trends-js";

export async function fetchTrendingKeywords(): Promise<string[]> {
  try {
    const result = await GoogleTrendsApi.dailyTrends({ geo: "US", hl: "en" });
    const keywords: string[] = [];
    for (const item of result?.data ?? []) {
      if (item.keyword) keywords.push(String(item.keyword).toLowerCase());
      for (const related of item.relatedKeywords ?? []) {
        keywords.push(String(related).toLowerCase());
      }
    }
    return keywords;
  } catch (err) {
    console.error("Google Trends fetch failed (continuing without trending scores):", err);
    return [];
  }
}

export function computeTrendingScore(title: string, trendingKeywords: string[]): number {
  const lowerTitle = title.toLowerCase();
  let score = 0;

  for (const keyword of trendingKeywords) {
    if (keyword && lowerTitle.includes(keyword)) {
      score += 10;
    }
  }

  return score;
}