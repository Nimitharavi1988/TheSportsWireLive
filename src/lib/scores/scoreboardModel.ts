/**
 * The one standard match shape every score display uses (score cards on
 * /scores, the match header on article pages), built from an Article match
 * row whatever sport or provider it came from. Pure — no DB imports — so the
 * live/final/upcoming rules are unit-tested (scoreboardModel.test.ts).
 */

import { categoryChipStyle } from "../categoryDisplay";
import { cricketLeagueLabel } from "./cricketLabels";

// "paused": a started match in a scheduled break — cricket stumps, lunch,
// tea, innings break, rain. Not shown as LIVE (nothing is happening), but
// still today's game and not over.
export type ScoreState = "live" | "paused" | "final" | "upcoming";

export interface ScoreSide {
  name: string;
  crestUrl: string | null;
  // Display score: "24" or, for cricket, "287/6 (48.2 ov)". null before play.
  score: string | null;
  record: string | null;
  winner: boolean;
}

export interface ScoreMatch {
  id: string;
  slug: string;
  // Top-level sport category ("football", not "football/world-cup").
  sport: string;
  leagueLabel: string;
  state: ScoreState;
  // Live: "Q3 · 8:42", "67'", "Shootout". Paused: "Stumps · Day 1", "Tea".
  clock: string | null;
  // "India need 93 runs from 70 balls", or null.
  note: string | null;
  kickoffAt: string | null;
  venue: string | null;
  broadcast: string | null;
  home: ScoreSide;
  away: ScoreSide;
}

export interface MatchRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  sourceName: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreText: string | null;
  awayScoreText: string | null;
  matchStatus: string | null;
  kickoffAt: Date | null;
  updatedAt: Date;
  venue: string | null;
  seriesLabel: string | null;
  leagueLabel: string | null;
  matchClock: string | null;
  matchNote: string | null;
  homeRecord: string | null;
  awayRecord: string | null;
  broadcast: string | null;
}

// Same windows the existing live displays use (liveMatches.ts,
// liveCricket.ts), so every screen agrees on what's live.
// A started game with no final yet counts as live for this long after
// kickoff (all these sports comfortably finish inside it)...
export const LIVE_WINDOW_MS = 5 * 60 * 60 * 1000;
// ...except cricket, which can run for days (Tests): live only while the
// match is still being updated by its source.
export const CRICKET_STALE_MS = 90 * 60 * 1000;

// A started, unfinished game past these windows has gone quiet without a
// final result — shown as neither live nor final (its state is unknown), so
// callers drop it rather than guess.
export function deriveState(row: MatchRow, now: Date): ScoreState | null {
  if (row.matchStatus === "finished") return "final";
  if (!row.kickoffAt) return null;
  if (row.kickoffAt.getTime() > now.getTime()) return "upcoming";
  if (row.category.startsWith("cricket")) {
    return now.getTime() - row.updatedAt.getTime() <= CRICKET_STALE_MS ? "live" : null;
  }
  if (row.matchClock) return "live";
  return now.getTime() - row.kickoffAt.getTime() <= LIVE_WINDOW_MS ? "live" : null;
}

// Cricket breaks, read from CricketData's own status line (matchNote), e.g.
// "Day 1: Stumps - Worcestershire lead by 131 runs" (seen live 2026-09-25
// on a card that still said LIVE after play had stopped for the day).
export function cricketPauseLabel(note: string | null): string | null {
  if (!note) return null;
  const day = note.match(/\bDay (\d+)\b/i)?.[1];
  if (/\bstumps\b/i.test(note)) return day ? `Stumps · Day ${day}` : "Stumps";
  if (/\blunch\b/i.test(note)) return "Lunch";
  if (/\btea\b/i.test(note)) return "Tea";
  if (/\binnings break\b/i.test(note)) return "Innings break";
  if (/\b(rain|bad light|wet outfield)\b|\bdelayed\b|\binterrupted\b/i.test(note)) return "Play delayed";
  return null;
}

// Multi-day (Test / first-class) cricket in play: "Day 2" from the status
// line, so a live Test reads "LIVE · Day 2". null for one-day games.
export function cricketDayLabel(note: string | null): string | null {
  const day = note?.match(/\bDay (\d+)\b/i)?.[1];
  return day ? `Day ${day}` : null;
}

function displayScore(numeric: number | null, text: string | null): string | null {
  if (text && text.trim()) return text.trim();
  return numeric === null || numeric === undefined ? null : String(numeric);
}

// Cricket results are text ("England won by 25 runs"), so the winner comes
// from the note; everything else compares the numeric scores.
function winners(row: MatchRow, state: ScoreState): { home: boolean; away: boolean } {
  if (state !== "final") return { home: false, away: false };
  if (row.homeScore !== null && row.awayScore !== null && !row.category.startsWith("cricket")) {
    return { home: row.homeScore > row.awayScore, away: row.awayScore > row.homeScore };
  }
  const note = (row.matchNote ?? "").toLowerCase();
  const won = (team: string | null) => Boolean(team) && note.startsWith(`${team!.toLowerCase()} won`);
  return { home: won(row.homeTeam), away: won(row.awayTeam) };
}

// Stored league first; rows stored before leagueLabel existed fall back to
// the series, then (cricket) the competition in the match name, then the
// sport itself — never the data provider's name.
function defaultLeague(row: MatchRow): string {
  return (
    row.leagueLabel?.trim() ||
    row.seriesLabel?.trim() ||
    (row.category.startsWith("cricket") ? cricketLeagueLabel(row.title) : undefined) ||
    categoryChipStyle(row.category).label
  );
}

// CricketData rows stored before matchNote existed: their summary starts
// with CricketData's own status line ("Yorkshire won by 185 runs. ...").
function effectiveNote(row: MatchRow): string | null {
  if (row.matchNote) return row.matchNote;
  if (row.sourceName !== "CricketData.org") return null;
  const first = row.summary.split(". ")[0]?.trim();
  return first && first !== row.summary.trim() ? first : null;
}

export function toScoreMatch(rawRow: MatchRow, now: Date): ScoreMatch | null {
  const row = { ...rawRow, matchNote: effectiveNote(rawRow) };
  if (!row.homeTeam || !row.awayTeam) return null;
  const derived = deriveState(row, now);
  if (!derived) return null;
  const pause = derived === "live" && row.category.startsWith("cricket") ? cricketPauseLabel(row.matchNote) : null;
  const state: ScoreState = pause ? "paused" : derived;
  const win = winners(row, state);
  const showScore = state !== "upcoming";
  return {
    id: row.id,
    slug: row.slug,
    sport: row.category.split("/")[0],
    leagueLabel: defaultLeague(row),
    state,
    clock:
      state === "paused"
        ? pause
        : state === "live"
          ? row.matchClock ?? (row.category.startsWith("cricket") ? cricketDayLabel(row.matchNote) : null)
          : null,
    note: state === "upcoming" ? null : row.matchNote,
    kickoffAt: row.kickoffAt ? row.kickoffAt.toISOString() : null,
    venue: row.venue,
    broadcast: state === "upcoming" ? row.broadcast : null,
    home: {
      name: row.homeTeam,
      crestUrl: row.homeCrestUrl,
      score: showScore ? displayScore(row.homeScore, row.homeScoreText) : null,
      record: row.homeRecord,
      winner: win.home,
    },
    away: {
      name: row.awayTeam,
      crestUrl: row.awayCrestUrl,
      score: showScore ? displayScore(row.awayScore, row.awayScoreText) : null,
      record: row.awayRecord,
      winner: win.away,
    },
  };
}
