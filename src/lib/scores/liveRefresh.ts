/**
 * Fast live-score refresh: every couple of minutes during games, re-reads
 * only the providers that have a game in play (or about to start) and
 * updates those existing match rows — score, clock, status, and the final
 * result when a game ends. Full ingestion (runIngest.ts, every ~15 min)
 * still does everything else: creating matches, news, commentary, social.
 *
 * Deliberately narrow so it's cheap to run often:
 * - Nothing live or about to start -> one DB query, no provider calls.
 * - Never creates articles, never calls Gemini, never posts anywhere.
 * - ESPN sources only (no API key, no quota). CricketData.org stays with
 *   full ingestion: its free plan allows 100 calls/day, which that already
 *   uses; refreshing it here would exhaust it.
 *
 * Runs on GitHub Actions (.github/workflows/live-refresh.yml), not the
 * site's Worker: the Workers free plan's 10ms CPU limit per request can't
 * reliably parse several ESPN scoreboards (see api/cron/ingest/route.ts).
 */
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import type { RawMatchItem } from "../ingestion/footballData";
import { computeStableDedupeHash } from "../ingestion/dedupe";
import { matchRefreshValues } from "../ingestion/matchRefresh";
import { fetchNflData } from "../ingestion/nflData";
import { fetchNbaData } from "../ingestion/nbaData";
import { fetchNhlData } from "../ingestion/nhlData";
import { fetchDomesticFootballData } from "../ingestion/domesticFootballData";
import { fetchEspnVolleyballData } from "../ingestion/espnVolleyballData";

// sourceName (as stored on Article) -> the fetcher that produces it.
const LIVE_SOURCES: Record<string, () => Promise<RawMatchItem[]>> = {
  "ESPN NFL": fetchNflData,
  "ESPN NBA": fetchNbaData,
  "ESPN NHL": fetchNhlData,
  "ESPN Football": fetchDomesticFootballData,
  "ESPN Volleyball": fetchEspnVolleyballData,
};

// A game is worth refreshing from shortly before kickoff (so it flips to
// live promptly) until it's final or clearly over.
export const PRE_KICKOFF_MS = 15 * 60 * 1000;
export const MAX_GAME_MS = 5 * 60 * 60 * 1000;

export interface LiveRefreshResult {
  sources: string[];
  fetched: number;
  updated: number;
  finished: number;
}

// Which of a source's items need writing: games we already have that aren't
// final yet and have started or are about to. Pure, so it's unit-tested.
export function itemsToRefresh(
  items: RawMatchItem[],
  existingByHash: Map<string, { id: string; matchStatus: string | null }>,
  now: Date
): { item: RawMatchItem; id: string; existingMatchStatus: string | null }[] {
  const cutoff = now.getTime() + PRE_KICKOFF_MS;
  return items.flatMap((item) => {
    if (!item.dedupeKey || !item.kickoffAt) return [];
    const existing = existingByHash.get(computeStableDedupeHash(item.dedupeKey));
    if (!existing || existing.matchStatus === "finished") return [];
    if (item.kickoffAt.getTime() > cutoff) return [];
    return [{ item, id: existing.id, existingMatchStatus: existing.matchStatus }];
  });
}

export async function runLiveRefresh(now: Date = new Date()): Promise<LiveRefreshResult> {
  // Which providers have a game in play or about to start right now.
  const active = await db
    .selectDistinct({ sourceName: article.sourceName })
    .from(article)
    .where(and(
      inArray(article.sourceName, Object.keys(LIVE_SOURCES)),
      eq(article.matchStatus, "scheduled"),
      gte(article.kickoffAt, new Date(now.getTime() - MAX_GAME_MS)),
      lte(article.kickoffAt, new Date(now.getTime() + PRE_KICKOFF_MS))
    ));
  const sources = active.map((r) => r.sourceName);
  const result: LiveRefreshResult = { sources, fetched: 0, updated: 0, finished: 0 };
  if (sources.length === 0) return result;

  for (const sourceName of sources) {
    let items: RawMatchItem[];
    try {
      items = await LIVE_SOURCES[sourceName]();
    } catch (err) {
      // One provider failing shouldn't stop the others.
      console.error(`Live refresh: ${sourceName} fetch failed:`, err);
      continue;
    }
    result.fetched += items.length;

    const hashes = items.flatMap((i) => (i.dedupeKey ? [computeStableDedupeHash(i.dedupeKey)] : []));
    if (hashes.length === 0) continue;
    const existingRows = await db
      .select({ id: article.id, dedupeHash: article.dedupeHash, matchStatus: article.matchStatus })
      .from(article)
      .where(inArray(article.dedupeHash, hashes));
    const existingByHash = new Map(existingRows.map((r) => [r.dedupeHash, r]));

    for (const { item, id, existingMatchStatus } of itemsToRefresh(items, existingByHash, now)) {
      await db.update(article).set(matchRefreshValues(item, existingMatchStatus, now)).where(eq(article.id, id));
      result.updated++;
      if (item.matchStatus === "finished") result.finished++;
    }
  }
  return result;
}

if (require.main === module) {
  const started = Date.now();
  runLiveRefresh()
    .then((r) => {
      console.log(
        r.sources.length === 0
          ? "Live refresh: no games in play or about to start — nothing to do."
          : `Live refresh: ${r.sources.join(", ")} — ${r.updated} games updated (${r.finished} just finished) from ${r.fetched} provider items in ${Date.now() - started}ms.`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("Live refresh failed:", err);
      process.exit(1);
    });
}
