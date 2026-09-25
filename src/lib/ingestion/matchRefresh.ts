import type { RawMatchItem } from "./footballData";
import { buildMatchKey } from "../scores/matchKey";

// The column values written when a match-data source reports on a game we
// already have a row for. Shared by full ingestion (runIngest.ts) and the
// fast live-score refresh (scores/liveRefresh.ts) so the two can never
// disagree about what a refresh writes.
//
// Score/status/clock refresh on every poll. title/summary/body only change
// at the scheduled -> finished transition (a live game keeps its preview
// text; its score lives in the score fields), except CricketData.org, whose
// summary/body carry the live situation and so refresh every poll.
export function matchRefreshValues(item: RawMatchItem, existingMatchStatus: string | null, now: Date = new Date()) {
  const justFinished = existingMatchStatus !== "finished" && item.matchStatus === "finished";
  const isCricketData = item.sourceName === "CricketData.org";
  return {
    matchStatus: item.matchStatus,
    homeScore: item.homeScore,
    awayScore: item.awayScore,
    homeScoreText: item.homeScoreText,
    awayScoreText: item.awayScoreText,
    venue: item.venue,
    // Standard scoreboard fields (src/lib/scores/). undefined = source
    // doesn't provide it (Drizzle leaves the column alone); null = clear it.
    leagueLabel: item.leagueLabel,
    matchClock: item.matchClock,
    matchNote: item.matchNote,
    homeRecord: item.homeRecord,
    awayRecord: item.awayRecord,
    broadcast: item.broadcast,
    matchKey: buildMatchKey(item.category, item.kickoffAt, item.homeTeam, item.awayTeam),
    ...(isCricketData || justFinished ? { summary: item.summary, body: item.body } : {}),
    ...(justFinished && !isCricketData ? { title: item.title } : {}),
    updatedAt: now,
  };
}
