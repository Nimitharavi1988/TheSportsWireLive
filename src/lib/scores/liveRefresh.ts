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
 * - ESPN sources (no API key, no quota), plus tracked international
 *   cricket matches (scores/trackedCricket.ts) every ~7 min within
 *   CricketData's 100-calls/day budget. The general CricketData feed stays
 *   with full ingestion, but its matches that ESPN also has get ESPN's
 *   score here (matchDataSources.ts `supersedes`).
 *
 * Runs on GitHub Actions (.github/workflows/live-refresh.yml), not the
 * site's Worker: the Workers free plan's 10ms CPU limit per request can't
 * reliably parse several ESPN scoreboards (see api/cron/ingest/route.ts).
 */
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, gte, inArray, like, lte, ne, or } from "drizzle-orm";
import type { RawMatchItem } from "../ingestion/footballData";
import { computeDedupeHash, computeStableDedupeHash } from "../ingestion/dedupe";
import { fetchTrackedCricketMatch } from "../ingestion/cricketData";
import { TRACKED_REFRESH_MS, trackedInPlay } from "./trackedCricket";
import { matchRefreshValues, supersedingRefreshValues } from "../ingestion/matchRefresh";
import { supersededBy, supersedes, supersedingSources } from "../matchDataSources";
import { matchKeyVariants } from "./matchKey";
import { fetchNflData } from "../ingestion/nflData";
import { fetchMlbData } from "../ingestion/mlbData";
import { fetchNbaData } from "../ingestion/nbaData";
import { fetchNhlData } from "../ingestion/nhlData";
import { fetchDomesticFootballData } from "../ingestion/domesticFootballData";
import { fetchEspnVolleyballData } from "../ingestion/espnVolleyballData";
import { fetchCollegeFootballData, fetchWnbaData } from "../ingestion/espnLeagueData";
import { fetchEspnCricketData } from "../ingestion/espnCricketData";

// sourceName (as stored on Article) -> the fetcher that produces it.
const LIVE_SOURCES: Record<string, () => Promise<RawMatchItem[]>> = {
  "ESPN NFL": fetchNflData,
  "MLB Stats API": fetchMlbData,
  "ESPN NBA": fetchNbaData,
  "ESPN NHL": fetchNhlData,
  "ESPN Football": fetchDomesticFootballData,
  "ESPN Volleyball": fetchEspnVolleyballData,
  "ESPN College Football": fetchCollegeFootballData,
  "ESPN WNBA": fetchWnbaData,
  "ESPN Cricket": () => fetchEspnCricketData(),
};

// Sources with a fast fetcher, plus the sources they supersede.
const WATCHED_SOURCES = [...new Set(Object.keys(LIVE_SOURCES).flatMap((s) => [s, ...supersededBy(s)]))];

// A game is worth refreshing from shortly before kickoff (so it flips to
// live promptly) until it's final or clearly over.
export const PRE_KICKOFF_MS = 15 * 60 * 1000;
export const MAX_GAME_MS = 5 * 60 * 60 * 1000;
export const MAX_CRICKET_MS = 5 * 24 * 60 * 60 * 1000;

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

// Rows another provider stored that this source supersedes (see
// matchDataSources.ts): each paired with this source's item for the same
// match (by matchKey, either team order), same kickoff cutoff as
// itemsToRefresh. Pure, so it's unit-tested.
export function supersededToRefresh(
  items: RawMatchItem[],
  rows: { id: string; matchKey: string | null; homeTeam: string | null }[],
  now: Date
): { item: RawMatchItem; row: { id: string; homeTeam: string | null } }[] {
  const cutoff = now.getTime() + PRE_KICKOFF_MS;
  const byKey = new Map<string, RawMatchItem>();
  for (const item of items) {
    if (!item.kickoffAt || item.kickoffAt.getTime() > cutoff) continue;
    for (const k of matchKeyVariants(item.category, item.kickoffAt, item.homeTeam, item.awayTeam)) byKey.set(k, item);
  }
  return rows.flatMap((row) => {
    const item = row.matchKey ? byKey.get(row.matchKey) : undefined;
    return item ? [{ item, row }] : [];
  });
}

export async function runLiveRefresh(now: Date = new Date()): Promise<LiveRefreshResult> {
  // Which providers have a game in play or about to start right now.
  const active = await db
    .selectDistinct({ sourceName: article.sourceName })
    .from(article)
    .where(and(
      inArray(article.sourceName, WATCHED_SOURCES),
      eq(article.matchStatus, "scheduled"),
      // Cricket runs for days (Tests, first-class); other games within hours.
      or(
        gte(article.kickoffAt, new Date(now.getTime() - MAX_GAME_MS)),
        and(like(article.category, "cricket%"), gte(article.kickoffAt, new Date(now.getTime() - MAX_CRICKET_MS)))
      ),
      lte(article.kickoffAt, new Date(now.getTime() + PRE_KICKOFF_MS))
    ));
  // A superseded source (CricketData) has no fast fetcher of its own —
  // its in-play matches bring in the source that supersedes it.
  const sources = [...new Set(active.flatMap((r) => (r.sourceName in LIVE_SOURCES ? [r.sourceName] : supersedingSources(r.sourceName).filter((s) => s in LIVE_SOURCES))))];
  const tracked = trackedInPlay(now);
  const result: LiveRefreshResult = { sources: [...sources], fetched: 0, updated: 0, finished: 0 };
  if (sources.length === 0 && tracked.length === 0) return result;

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

    const others = supersededBy(sourceName);
    const keys = [...new Set(items.flatMap((i) => matchKeyVariants(i.category, i.kickoffAt, i.homeTeam, i.awayTeam)))];
    if (others.length === 0 || keys.length === 0) continue;
    const supersededRows = await db
      .select({ id: article.id, matchKey: article.matchKey, homeTeam: article.homeTeam })
      .from(article)
      .where(and(inArray(article.sourceName, others), inArray(article.matchKey, keys), ne(article.matchStatus, "finished")));
    for (const { item, row } of supersededToRefresh(items, supersededRows, now)) {
      await db.update(article).set(supersedingRefreshValues(item, row, now)).where(eq(article.id, row.id));
      result.updated++;
      if (item.matchStatus === "finished") result.finished++;
    }
  }
  if (tracked.length > 0) {
    result.sources.push("CricketData.org (tracked)");
    await refreshTrackedCricket(tracked, now, result);
  }
  return result;
}

// Tracked internationals: refresh an existing match row once its last
// update is older than TRACKED_REFRESH_MS (full ingestion refreshes it
// every ~15 min too, and creates it — this job never does). Each refresh
// is one CricketData call, gated by the shared daily budget.
async function refreshTrackedCricket(
  tracked: ReturnType<typeof trackedInPlay>,
  now: Date,
  result: LiveRefreshResult
): Promise<void> {
  for (const match of tracked) {
    // Same identity full ingestion gives it: title + kickoff day.
    const hash = computeDedupeHash(match.name, new Date(match.startGmt));
    const [row] = await db
      .select({ id: article.id, matchStatus: article.matchStatus, updatedAt: article.updatedAt, scoreSource: article.scoreSource })
      .from(article)
      .where(eq(article.dedupeHash, hash))
      .limit(1);
    if (!row || row.matchStatus === "finished") continue;
    // A superseding provider (ESPN) already keeps this one current.
    if (row.scoreSource && supersedes(row.scoreSource, "CricketData.org")) continue;
    if (now.getTime() - row.updatedAt.getTime() < TRACKED_REFRESH_MS) continue;

    const item = await fetchTrackedCricketMatch(match.id);
    if (!item) continue;
    result.fetched++;
    await db.update(article).set(matchRefreshValues(item, row.matchStatus, now)).where(eq(article.id, row.id));
    result.updated++;
    if (item.matchStatus === "finished") result.finished++;
  }
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
