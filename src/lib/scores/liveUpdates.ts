/**
 * In-place live score updates (pure, unit-tested). Score widgets poll the
 * small /api/scores/live endpoint and update themselves — replacing
 * LiveRefresher's router.refresh(), which re-rendered the WHOLE page
 * (~300 KB of payload, 0.6-1.4s server time on the homepage) every minute
 * while any game anywhere was live, twice on the homepage. Measured
 * 2026-09-26; that per-minute stall is what made pages feel slow.
 */
import type { ScoreMatch } from "./scoreboardModel";

// The server's own score refresh runs every ~2 minutes, so polling much
// faster than this only re-reads the same row. Polling is skipped entirely
// (needsLiveUpdate) when nothing on screen can change.
export const LIVE_POLL_MS = 30_000;
// An upcoming game is watched from shortly before its start, so it flips
// to live promptly (same window as liveRefresh.ts's PRE_KICKOFF_MS).
const PRE_START_MS = 15 * 60 * 1000;
export const MAX_LIVE_IDS = 60;
// Games on the site-wide score strip. Lives here, not in LiveTicker.tsx: a
// server component importing a value from a "use client" file gets a client
// reference, not the number — MatchTicker asked for take=<reference> and
// the strip was silently empty everywhere from 2026-09-25 to 09-27.
export const TICKER_SIZE = 14;

// Whether this card can still change: in play, or about to start (or past
// its start but not yet marked live).
export function needsLiveUpdate(m: ScoreMatch, now: number): boolean {
  if (m.state === "live" || m.state === "paused" || m.state === "started") return true;
  return m.state === "upcoming" && m.kickoffAt !== null && Date.parse(m.kickoffAt) <= now + PRE_START_MS;
}

// Replaces cards by id with their fresh version; cards not returned (or
// no longer match-shaped) keep their last known state.
export function mergeMatches(current: ScoreMatch[], updates: ScoreMatch[]): ScoreMatch[] {
  if (updates.length === 0) return current;
  const byId = new Map(updates.map((m) => [m.id, m]));
  return current.map((m) => byId.get(m.id) ?? m);
}

// Whether a widget's server-provided list is the same data it already has:
// same card objects in the same order. Compared by content, not array
// identity — a caller building the list inline (MatchHeader's [initial])
// hands over a new array every render, and treating that as new server
// data reset state during render in a loop (React error #301, seen live
// 2026-09-26 on every cricket match opened from /scores).
export function sameMatches(a: ScoreMatch[], b: ScoreMatch[]): boolean {
  return a === b || (a.length === b.length && a.every((m, i) => m === b[i]));
}
