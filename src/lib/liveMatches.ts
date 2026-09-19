/**
 * Cross-sport "Live Now" data — standardizes the rich live/finished/
 * upcoming treatment cricket already had (see liveCricket.ts) across every
 * other match-data sport (NFL, NBA, MLB, domestic football, NHL,
 * volleyball), instead of those sports only ever getting a flat, unbadged
 * "Scores & Previews" list. Cricket's own fetcher stays as-is (its own
 * quirks — multi-day Tests, series not covered by CricketData.org at all —
 * are real and specific to it); this adds an equivalent for everything
 * else and merges the two into one feed.
 */
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, like, not, gt, inArray, desc, asc, type SQL } from "drizzle-orm";
import { isInternationalFormat } from "./ingestion/cricketCountries";
import { fetchLiveCricketMatches } from "./liveCricket";
import type { CricketMatchStatus } from "./liveCricket";

export type LiveMatchStatus = CricketMatchStatus;

export interface UnifiedMatch {
  id: string;
  slug: string;
  summary: string;
  category: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  homeScoreText: string | null;
  awayScoreText: string | null;
  kickoffAt: Date | null;
  matchState: LiveMatchStatus;
  isNewsDerived?: boolean;
  relatedArticles: { id: string; slug: string; title: string }[];
}

const GENERIC_SOURCES = ["ESPN NFL", "ESPN NBA", "MLB Stats API", "ESPN Football", "ESPN NHL", "ESPN Volleyball"];

// These sources never emit a genuine in-progress "live" state (see e.g.
// nflData.ts's `state !== "post" && state !== "pre"` skip) — a "scheduled"
// article with a past kickoff is our only signal the game is actually
// underway right now, so it's treated as live for a bounded window past
// kickoff. Wide enough to cover a real game's typical duration (NFL/NBA/
// NHL/volleyball all comfortably finish inside 4 hours; MLB extra innings
// are the outlier) without holding a match-data-source outage's silently-
// unrefreshed row as "live" for days, which was the exact bug fixed in
// runIngest.ts on 2026-09-17 (see its comment on the generalized
// duplicate-refresh block) — this window is a display-layer safety net on
// top of that fix, not a substitute for it.
const GENERIC_LIVE_WINDOW_MS = 5 * 60 * 60 * 1000;
const GENERIC_RESULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const RELATED_NEWS_LOOKBACK_MS = 24 * 60 * 60 * 1000;

const SELECT = {
  id: article.id, slug: article.slug, title: article.title, category: article.category,
  homeTeam: article.homeTeam, awayTeam: article.awayTeam,
  homeCrestUrl: article.homeCrestUrl, awayCrestUrl: article.awayCrestUrl,
  homeScore: article.homeScore, awayScore: article.awayScore, kickoffAt: article.kickoffAt,
};

type Row = {
  id: string; slug: string; title: string; category: string;
  homeTeam: string | null; awayTeam: string | null;
  homeCrestUrl: string | null; awayCrestUrl: string | null;
  homeScore: number | null; awayScore: number | null;
  kickoffAt: Date | null;
};

type NewsPoolRow = { id: string; slug: string; title: string; category: string };

function relatedNewsFor(home: string, away: string, category: string, excludeId: string, pool: NewsPoolRow[], take = 3) {
  return pool
    .filter((r) => r.category === category && r.id !== excludeId && (r.title.includes(home) || r.title.includes(away)))
    .slice(0, take);
}

function toUnified(r: Row, matchState: LiveMatchStatus, pool: NewsPoolRow[]): UnifiedMatch {
  const hasScore = r.homeScore !== null && r.awayScore !== null;
  return {
    id: r.id,
    slug: r.slug,
    summary: r.title,
    category: r.category,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    homeCrestUrl: r.homeCrestUrl,
    awayCrestUrl: r.awayCrestUrl,
    homeScoreText: hasScore ? String(r.homeScore) : null,
    awayScoreText: hasScore ? String(r.awayScore) : null,
    kickoffAt: r.kickoffAt,
    matchState,
    relatedArticles:
      r.homeTeam && r.awayTeam ? relatedNewsFor(r.homeTeam, r.awayTeam, r.category, r.id, pool) : [],
  };
}

async function fetchGenericMatches(take: number, categoryFilter?: string): Promise<UnifiedMatch[]> {
  const now = new Date();
  const catFilter: SQL[] = categoryFilter ? [eq(article.category, categoryFilter)] : [];

  const [scheduled, finished, pool] = await Promise.all([
    db.select(SELECT).from(article).where(and(
      eq(article.status, "published"), ...catFilter,
      eq(article.matchStatus, "scheduled"), inArray(article.sourceName, GENERIC_SOURCES)
    )).orderBy(asc(article.kickoffAt)).limit(take * 3),
    db.select(SELECT).from(article).where(and(
      eq(article.status, "published"), ...catFilter,
      eq(article.matchStatus, "finished"), inArray(article.sourceName, GENERIC_SOURCES),
      gt(article.updatedAt, new Date(now.getTime() - GENERIC_RESULT_LOOKBACK_MS))
    )).orderBy(desc(article.updatedAt)).limit(take),
    // One shared "more on this match" pool across every non-cricket sport,
    // scoped per-match to its own category when matching (see
    // relatedNewsFor) so a football headline never attaches to an NFL card.
    db.select({ id: article.id, slug: article.slug, title: article.title, category: article.category })
      .from(article).where(and(
        eq(article.status, "published"),
        not(like(article.category, "cricket%")),
        gt(article.createdAt, new Date(Date.now() - RELATED_NEWS_LOOKBACK_MS))
      )).orderBy(desc(article.createdAt)).limit(300),
  ]);

  const live = scheduled.filter(
    (m) => m.kickoffAt !== null && m.kickoffAt <= now && now.getTime() - m.kickoffAt.getTime() < GENERIC_LIVE_WINDOW_MS
  );
  const upcoming = scheduled
    .filter((m) => m.kickoffAt !== null && m.kickoffAt > now)
    .slice(0, take);

  return [
    ...live.map((m) => toUnified(m, "live", pool)),
    ...finished.map((m) => toUnified(m, "finished", pool)),
    ...upcoming.map((m) => toUnified(m, "upcoming", pool)),
  ];
}

// International-first within each state, same reasoning as cricket's own
// sort (isInternationalFormat also covers "World Cup"/"Euros"/"Champions
// League"-style titles for football, via its terminology check).
function internationalFirst(matches: UnifiedMatch[]): UnifiedMatch[] {
  const international = matches.filter((m) => isInternationalFormat(m.summary));
  const domestic = matches.filter((m) => !isInternationalFormat(m.summary));
  return [...international, ...domestic];
}

// The one entry point every "live section" on the site should use going
// forward — homepage widget and /scores alike — instead of each hand-
// rolling its own per-sport query. `category` narrows to one sport (a
// category-filtered page shouldn't show unrelated sports' live matches);
// omitted, every sport is eligible.
export async function fetchLiveMatches(take: number, category?: string): Promise<UnifiedMatch[]> {
  const [cricket, generic] = await Promise.all([
    !category || category.startsWith("cricket") ? fetchLiveCricketMatches(take) : Promise.resolve([]),
    category?.startsWith("cricket") ? Promise.resolve([]) : fetchGenericMatches(take, category),
  ]);

  const all: UnifiedMatch[] = [...cricket.map((m) => ({ ...m, category: "cricket" })), ...generic];
  const live = internationalFirst(all.filter((m) => m.matchState === "live"));
  const finished = internationalFirst(all.filter((m) => m.matchState === "finished")).slice(0, take);
  const upcoming = internationalFirst(all.filter((m) => m.matchState === "upcoming"));

  return [...live, ...finished, ...upcoming].slice(0, take);
}
