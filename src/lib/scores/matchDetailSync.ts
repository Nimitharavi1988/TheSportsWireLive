/**
 * Fetches the detail of matches in play or just finished — cricket scorecards
 * and box scores from ESPN — and stores it for the match page
 * (matchDetail.ts). Runs after every live-score refresh
 * (.github/workflows/live-refresh.yml), on GitHub Actions where ESPN answers
 * reliably; the site's Worker only reads what is stored here.
 *
 * Cheap when nothing is on: one query for the candidate matches, one for their
 * stored copies, and no provider calls. A failed or empty fetch keeps the copy
 * already stored. MLB is not handled here: its own API answers the Worker
 * directly (mlbBoxScore.ts).
 */
import { db } from "@/db";
import { article, dataSnapshot } from "@/db/schema";
import { and, eq, gte, inArray, isNotNull, like, lte, ne, or } from "drizzle-orm";
import { MATCH_DATA_SOURCE_NAMES } from "../matchDataSources";
import { espnCricketIds, fetchScorecardByIds } from "./cricketScorecard";
import { fetchBoxScore } from "./espnBoxScore";
import { mlbGamePk } from "./mlbBoxScore";
import { matchDetailKey, needsDetailFetch, type MatchDetail } from "./matchDetail";

const HOUR = 60 * 60 * 1000;
// Matches started within this long ago are looked at: a result's final copy is
// taken once, so last week's matches keep their scorecards and box scores.
// Cricket still unfinished is looked at for as long as it runs (a Test lasts
// days).
const LOOKBACK_MS = 7 * 24 * HOUR;
const CRICKET_LOOKBACK_MS = 6 * 24 * HOUR;
const NONE_AFTER_MS = 6 * HOUR;
const MAX_PER_RUN = 60;
const CONCURRENCY = 5;

export interface MatchDetailSyncResult {
  candidates: number;
  fetched: number;
  stored: number;
}

export async function syncMatchDetails(now: Date = new Date()): Promise<MatchDetailSyncResult> {
  const rows = await db
    .select({
      id: article.id,
      sourceUrl: article.sourceUrl,
      leagueLabel: article.leagueLabel,
      category: article.category,
      homeTeam: article.homeTeam,
      awayTeam: article.awayTeam,
      kickoffAt: article.kickoffAt,
      matchStatus: article.matchStatus,
    })
    .from(article)
    .where(and(
      eq(article.status, "published"),
      inArray(article.sourceName, MATCH_DATA_SOURCE_NAMES),
      isNotNull(article.homeTeam),
      isNotNull(article.awayTeam),
      lte(article.kickoffAt, new Date(now.getTime() + HOUR)),
      or(
        gte(article.kickoffAt, new Date(now.getTime() - LOOKBACK_MS)),
        and(like(article.category, "cricket%"), ne(article.matchStatus, "finished"), gte(article.kickoffAt, new Date(now.getTime() - CRICKET_LOOKBACK_MS)))
      )
    ));
  const result: MatchDetailSyncResult = { candidates: rows.length, fetched: 0, stored: 0 };
  if (rows.length === 0) return result;

  const keys = rows.map((r) => matchDetailKey(r.id));
  const stored = new Map((await db.select({ key: dataSnapshot.key, data: dataSnapshot.data }).from(dataSnapshot).where(inArray(dataSnapshot.key, keys))).map((s) => [s.key, s.data as MatchDetail]));

  // Matches in play first (they change every run), then the most recent results;
  // the cap on a run means a backlog of older results fills in over a few runs.
  const due = rows
    .filter((r) => !mlbGamePk(r.sourceUrl))
    .filter((r) => needsDetailFetch(r, stored.get(matchDetailKey(r.id)) ?? null, now))
    .sort((a, b) => Number(a.matchStatus === "finished") - Number(b.matchStatus === "finished") || (b.kickoffAt?.getTime() ?? 0) - (a.kickoffAt?.getTime() ?? 0))
    .slice(0, MAX_PER_RUN);

  const one = async (r: (typeof rows)[number]) => {
    const final = r.matchStatus === "finished";
    const fetchedAt = now.toISOString();
    let detail: MatchDetail | null = null;
    const ids = r.category.startsWith("cricket") ? espnCricketIds(r.sourceUrl) : null;
    if (ids) {
      const card = await fetchScorecardByIds(ids.series, ids.game, true);
      if (card.innings.length > 0 || card.yetToBat.length > 0) detail = { kind: "cricket", final, fetchedAt, card };
    } else {
      const box = await fetchBoxScore(r.sourceUrl, r.leagueLabel ?? "", true, { home: r.homeTeam!, away: r.awayTeam!, kickoffAt: r.kickoffAt ? r.kickoffAt.toISOString() : null });
      if (box) detail = { kind: "box", final, fetchedAt, box };
    }
    result.fetched++;
    if (!detail) {
      // A result more than a few hours old that the provider has nothing for is
      // recorded as such; a fresh one is asked about again (it may be late).
      if (!final || !r.kickoffAt || now.getTime() - r.kickoffAt.getTime() < NONE_AFTER_MS) return;
      detail = { kind: "none", final: true, fetchedAt };
    }
    await db
      .insert(dataSnapshot)
      .values({ key: matchDetailKey(r.id), data: detail, sourceUrl: r.sourceUrl, fetchedAt: now })
      .onConflictDoUpdate({ target: dataSnapshot.key, set: { data: detail, sourceUrl: r.sourceUrl, fetchedAt: now } });
    result.stored++;
  };

  for (let i = 0; i < due.length; i += CONCURRENCY) {
    await Promise.all(
      due.slice(i, i + CONCURRENCY).map((r) =>
        one(r).catch((err) => console.error(`Match detail ${r.id} failed:`, err instanceof Error ? err.message : err))
      )
    );
  }
  return result;
}

if (require.main === module) {
  const started = Date.now();
  syncMatchDetails()
    .then((r) => {
      console.log(`Match detail: ${r.candidates} candidate matches, ${r.fetched} fetched, ${r.stored} stored in ${Date.now() - started}ms.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Match detail sync failed:", err);
      process.exit(1);
    });
}
