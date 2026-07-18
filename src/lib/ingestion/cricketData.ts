/**
 * Pulls current/recent cricket matches from CricketData.org's free tier
 * (formerly CricAPI). Covers international matches, IPL, and other major
 * leagues currently in progress or recently finished.
 *
 * Docs: https://cricketdata.org/
 * Free tier: 100 requests/day.
 */
import type { RawMatchItem } from "./footballData";

const BASE_URL = "https://api.cricapi.com/v1";

export async function fetchCricketData(): Promise<RawMatchItem[]> {
  const apiKey = process.env.CRICKETDATA_API_KEY;
  if (!apiKey) {
    console.warn("CRICKETDATA_API_KEY not set — skipping cricket ingestion");
    return [];
  }

  const res = await fetch(`${BASE_URL}/currentMatches?apikey=${apiKey}&offset=0`);

  if (!res.ok) {
    console.error(`CricketData.org fetch failed: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items: RawMatchItem[] = [];

  for (const match of data.data ?? []) {
    if (!match.name || !match.id) continue;

    const title = match.name;

    let scoreText = "";
    if (Array.isArray(match.score) && match.score.length > 0) {
      scoreText = match.score
        .map((s: any) => `${s.inning ?? ""}: ${s.r ?? "?"}/${s.w ?? "?"} (${s.o ?? "?"} ov)`)
        .join(", ");
    }

    const summary = scoreText
      ? `${match.status ?? "Match update"}. ${scoreText}`
      : match.status ?? `${title} — match details.`;

    items.push({
      title,
      summary,
      sourceUrl: `https://cricketdata.org/`,
      sourceName: "CricketData.org",
      category: "cricket",
      publishedAt: match.dateTimeGMT ? new Date(match.dateTimeGMT) : new Date(),
    });
  }

  return items;
}