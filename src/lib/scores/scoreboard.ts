/**
 * Reads match rows for the standard scoreboard (/scores) and turns them
 * into ScoreMatch cards (scoreboardModel.ts). One query for every sport and
 * provider — which sources count as match data comes from
 * matchDataSources.ts, not a per-sport list here.
 */
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, like, lte, ne, or } from "drizzle-orm";
import { MATCH_DATA_SOURCE_NAMES } from "../matchDataSources";
import { findNewsBasedCricketMatches } from "../liveCricket";
import { CRICKET_STALE_MS, toScoreMatch, type MatchRow, type ScoreMatch } from "./scoreboardModel";

// Enough for a busy weekend window across every sport, while keeping the
// query and page payload bounded.
const MAX_ROWS = 800;
const NEWS_LOOKBACK_MS = 24 * 60 * 60 * 1000;

const MATCH_COLUMNS = {
  id: article.id,
  slug: article.slug,
  title: article.title,
  summary: article.summary,
  category: article.category,
  sourceName: article.sourceName,
  homeTeam: article.homeTeam,
  awayTeam: article.awayTeam,
  homeCrestUrl: article.homeCrestUrl,
  awayCrestUrl: article.awayCrestUrl,
  homeScore: article.homeScore,
  awayScore: article.awayScore,
  homeScoreText: article.homeScoreText,
  awayScoreText: article.awayScoreText,
  matchStatus: article.matchStatus,
  kickoffAt: article.kickoffAt,
  updatedAt: article.updatedAt,
  venue: article.venue,
  seriesLabel: article.seriesLabel,
  leagueLabel: article.leagueLabel,
  matchClock: article.matchClock,
  matchNote: article.matchNote,
  homeRecord: article.homeRecord,
  awayRecord: article.awayRecord,
  broadcast: article.broadcast,
};

// The match header on a story page: the same card data, as of now.
export function currentScoreMatch(row: MatchRow): ScoreMatch | null {
  return toScoreMatch(row, new Date());
}

// Fresh cards for specific matches (in-place live updates, see
// liveUpdates.ts). Ids that aren't match rows simply don't come back.
export async function fetchScoreMatchesByIds(ids: string[]): Promise<ScoreMatch[]> {
  if (ids.length === 0) return [];
  const now = new Date();
  const rows = await db
    .select(MATCH_COLUMNS)
    .from(article)
    .where(and(eq(article.status, "published"), inArray(article.id, ids)));
  return rows.flatMap((r) => {
    const m = toScoreMatch(r, now);
    return m ? [m] : [];
  });
}

// Games kicking off within `windowMs` either side of now, plus any cricket match still
// being updated right now even if it started earlier (a Test runs for days).
// `sport` is a top-level category ("football" also covers "football/...").
export async function fetchScoreboard(opts: { windowMs: number; sport?: string }): Promise<ScoreMatch[]> {
  const now = new Date();
  const from = new Date(now.getTime() - opts.windowMs);
  const to = new Date(now.getTime() + opts.windowMs);
  const sportFilter = opts.sport ? [like(article.category, `${opts.sport}%`)] : [];

  const rows = await db
    .select(MATCH_COLUMNS)
    .from(article)
    .where(and(
      eq(article.status, "published"),
      inArray(article.sourceName, MATCH_DATA_SOURCE_NAMES),
      isNotNull(article.homeTeam),
      isNotNull(article.awayTeam),
      ...sportFilter,
      or(
        and(gte(article.kickoffAt, from), lte(article.kickoffAt, to)),
        and(
          like(article.category, "cricket%"),
          ne(article.matchStatus, "finished"),
          gt(article.updatedAt, new Date(now.getTime() - CRICKET_STALE_MS))
        )
      )
    ))
    .orderBy(asc(article.kickoffAt))
    .limit(MAX_ROWS);

  const matches = rows.flatMap((r) => {
    const m = toScoreMatch(r, now);
    return m ? [m] : [];
  });

  const wantsCricket = !opts.sport || opts.sport === "cricket";
  return wantsCricket ? [...(await newsDerivedCricket(matches, now)), ...matches] : matches;
}

// Big internationals the free CricketData feed doesn't carry still get a
// live card, built from publishers' "LIVE score" headlines (liveCricket.ts)
// — teams and status only, never an invented score.
async function newsDerivedCricket(existing: ScoreMatch[], now: Date): Promise<ScoreMatch[]> {
  const pool = await db
    .select({ id: article.id, slug: article.slug, title: article.title, createdAt: article.createdAt })
    .from(article)
    .where(and(
      eq(article.status, "published"),
      like(article.category, "cricket%"),
      gt(article.createdAt, new Date(now.getTime() - NEWS_LOOKBACK_MS))
    ))
    .orderBy(desc(article.createdAt))
    .limit(200);

  const covered = new Set(
    existing.filter((m) => m.sport === "cricket").map((m) => [m.home.name, m.away.name].sort().join("|"))
  );
  // Live only while "live score" headlines keep arriving: the newest one
  // for the pair must be within CRICKET_STALE_MS, same limit as a
  // CricketData match going quiet. Without this a morning "LIVE score"
  // headline kept the card LIVE for the whole 24h lookback (seen
  // 2026-09-25: England v Sri Lanka still LIVE at 1 AM US time).
  const createdAt = new Map(pool.map((p) => [p.id, p.createdAt]));
  const liveSince = now.getTime() - CRICKET_STALE_MS;
  return findNewsBasedCricketMatches(pool, 10, covered)
    .filter((m) => m.matchState === "live" && (createdAt.get(m.id)?.getTime() ?? 0) >= liveSince)
    .map((m) => ({
      id: m.id,
      slug: m.slug,
      sport: "cricket",
      leagueLabel: "International cricket",
      state: "live" as const,
      clock: null,
      note: "Live — follow the latest coverage",
      kickoffAt: null,
      venue: null,
      broadcast: null,
      home: { name: m.homeTeam, crestUrl: null, score: null, record: null, winner: false },
      away: { name: m.awayTeam, crestUrl: null, score: null, record: null, winner: false },
    }));
}

const LIVE_NOW_WINDOW_MS = 36 * 60 * 60 * 1000;
const STATE_RANK = { live: 0, paused: 1, upcoming: 2, final: 3 } as const;

// Homepage "Live now" box and the site-wide score strip: live games first,
// then the soonest kickoffs, then the most recent results — the same cards
// and live/final/upcoming rules as /scores, over a shorter window.
export async function fetchLiveNow(opts: { take: number; sport?: string }): Promise<ScoreMatch[]> {
  const matches = await fetchScoreboard({ windowMs: LIVE_NOW_WINDOW_MS, sport: opts.sport });
  const kickoff = (m: ScoreMatch) => (m.kickoffAt ? Date.parse(m.kickoffAt) : 0);
  return matches
    .sort((a, b) => {
      const byState = STATE_RANK[a.state] - STATE_RANK[b.state];
      if (byState !== 0) return byState;
      // Among live games, ones with a real score/clock lead; headline-only
      // cards (no score feed for that match) come after them.
      if (a.state === "live") {
        const detail = (m: ScoreMatch) => (m.home.score !== null || m.clock ? 0 : 1);
        const byDetail = detail(a) - detail(b);
        if (byDetail !== 0) return byDetail;
      }
      return a.state === "final" ? kickoff(b) - kickoff(a) : kickoff(a) - kickoff(b);
    })
    .slice(0, opts.take);
}
