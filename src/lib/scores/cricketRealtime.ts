/**
 * Real-time cricket layer (pure, unit-tested). Stored match rows are
 * refreshed every few minutes (ingestion + liveRefresh.ts); this reads
 * ESPN's live cricket scoreboard — updated ball by ball — through a
 * 15-second shared cache (/api/scores/cricket-live) and lays the latest
 * scores over any cricket card on screen. Matched by matchKey (both team
 * orders), so it works whichever provider stored the match (CricketData
 * or ESPN).
 */
import { espnCricketEventToItem, type EspnCricketEvent } from "../ingestion/espnCricketData";
import { matchKeyVariants, slugifyTeam } from "./matchKey";
import { cricketDayLabel, cricketPauseLabel, type ScoreMatch } from "./scoreboardModel";

export const CRICKET_REALTIME_MS = 15_000;

export interface LiveCricketScore {
  keys: string[];
  homeTeam: string;
  awayTeam: string;
  homeScore: string | null;
  awayScore: string | null;
  note: string | null;
  finished: boolean;
}

// ESPN's live cricket scoreboard payload -> one entry per started match.
export function liveCricketFromEspn(data: { sports?: { leagues?: { name?: string; events?: EspnCricketEvent[] }[] }[] }): LiveCricketScore[] {
  const out: LiveCricketScore[] = [];
  for (const sport of data.sports ?? []) {
    for (const league of sport.leagues ?? []) {
      for (const event of league.events ?? []) {
        const item = espnCricketEventToItem(event, league.name ?? "Cricket");
        if (!item || event.status === "pre" || !item.homeTeam || !item.awayTeam) continue;
        out.push({
          keys: matchKeyVariants(item.category, item.kickoffAt, item.homeTeam, item.awayTeam),
          homeTeam: item.homeTeam,
          awayTeam: item.awayTeam,
          homeScore: item.homeScoreText ?? null,
          awayScore: item.awayScoreText ?? null,
          note: item.matchNote ?? null,
          finished: item.matchStatus === "finished",
        });
      }
    }
  }
  return out;
}

// The card with the live data applied — same state rules as
// scoreboardModel (stumps/tea -> paused, day label while live). Scores are
// mapped by team, since the two providers may list the teams in opposite
// home/away order. Unchanged when nothing matches.
export function applyLiveCricket(match: ScoreMatch, live: LiveCricketScore[], nowIso: string): ScoreMatch {
  if (match.sport !== "cricket" || !match.matchKey || match.state === "final") return match;
  const hit = live.find((l) => l.keys.includes(match.matchKey!));
  if (!hit) return match;
  const sameOrder = slugifyTeam(hit.homeTeam) === slugifyTeam(match.home.name);
  const homeScore = sameOrder ? hit.homeScore : hit.awayScore;
  const awayScore = sameOrder ? hit.awayScore : hit.homeScore;
  const hasScores = Boolean(homeScore || awayScore);
  const pause = hit.finished ? null : cricketPauseLabel(hit.note);
  const state = hit.finished ? "final" : pause ? "paused" : hasScores ? "live" : "started";
  return {
    ...match,
    state,
    clock: state === "paused" ? pause : state === "live" ? cricketDayLabel(hit.note) : null,
    note: hit.note ?? match.note,
    updatedAt: nowIso,
    home: { ...match.home, score: homeScore ?? match.home.score },
    away: { ...match.away, score: awayScore ?? match.away.score },
  };
}

export const hasCricketInPlay = (matches: ScoreMatch[]) =>
  matches.some((m) => m.sport === "cricket" && (m.state === "live" || m.state === "paused" || m.state === "started"));
