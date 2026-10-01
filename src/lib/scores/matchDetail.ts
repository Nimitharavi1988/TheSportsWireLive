/**
 * Stored copies of a match's detail (the cricket scorecard, a box score), read
 * by the match page.
 *
 * The page does not ask ESPN while rendering: fetching ESPN from the
 * Cloudflare Worker is unreliable (refused requests — see snapshots/read.ts),
 * and it showed: on the live site no ESPN-based scorecard or box score ever
 * appeared, though the same code worked locally. So the scheduled job
 * (matchDetailSync.ts, run by the live-refresh workflow) fetches ESPN and
 * stores the result under the match's id, and the page — and the live
 * scorecard's polling — only read the stored copy.
 */
import type { BoxScore } from "./espnBoxScore";
import type { Scorecard } from "./cricketScorecard";

export const matchDetailKey = (articleId: string) => `match-detail:${articleId}`;

// kind "none": the provider has no detail for this match (checked once, so a
// finished match without any is not asked about again on every run).
export type MatchDetail = { final: boolean; fetchedAt: string } & ({ kind: "cricket"; card: Scorecard } | { kind: "box"; box: BoxScore } | { kind: "none" });

const START_SLACK_MS = 5 * 60 * 1000;

// Whether the job should fetch this match's detail now (pure, unit-tested):
// - not before it starts;
// - while it is being played: every run, so the scorecard moves with the score;
// - once finished: until a copy taken after the finish is stored, then never.
export function needsDetailFetch(
  row: { matchStatus: string | null; kickoffAt: Date | null },
  stored: { final: boolean } | null,
  now: Date
): boolean {
  if (!row.kickoffAt || row.kickoffAt.getTime() > now.getTime() + START_SLACK_MS) return false;
  if (row.matchStatus === "finished") return !stored || !stored.final;
  return true;
}
