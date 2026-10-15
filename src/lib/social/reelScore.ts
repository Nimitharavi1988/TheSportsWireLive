/**
 * A scoreboard strip above the photo of a reel (2026-10-15). The most-viewed sports Shorts and reels of the week
 * often showed the score over the image; ours never did. Reels are made from news stories, which carry no score of
 * their own, so the strip is found the same way the match-day ranking finds a fixture (matchDay.ts): the story's
 * title must name BOTH sides of a match from our match rows that is live or finished within the last 12 hours.
 *
 * Accuracy first: the score is read from the same match row the scores pages use, never from the story text, and it is
 * left off whenever it could be the wrong game. Two games between the same sides in the window (a T20 series on
 * consecutive days) is ambiguous, so no strip.
 */
import type { ScoreMatch } from "../scores/scoreboardModel";
import { expandAbbreviations, mentions } from "./matchDay";
import { significantWords } from "../titleSimilarity";

export interface ReelScore {
  home: string;
  away: string;
  homeScore: string;
  awayScore: string;
  // "FINAL", or the live clock / "LIVE".
  label: string;
  league: string;
}

export const REEL_SCORE_WINDOW_MS = 12 * 3_600_000;

// Pure, unit-tested.
export function scoreStripFor(title: string, matches: ScoreMatch[], now: Date, language: "en" | "es" = "en"): ReelScore | null {
  const words = significantWords(expandAbbreviations(title));
  const found = matches.filter((m) => {
    if (m.state !== "live" && m.state !== "paused" && m.state !== "final") return false;
    if (m.home.score == null || m.away.score == null || !m.kickoffAt) return false;
    const dt = now.getTime() - new Date(m.kickoffAt).getTime();
    if (dt < -3_600_000 || dt > REEL_SCORE_WINDOW_MS) return false;
    return mentions(words, m.home.name) && mentions(words, m.away.name);
  });
  if (found.length !== 1) return null;
  const m = found[0];
  const live = language === "es" ? "EN VIVO" : "LIVE";
  return {
    home: m.home.name,
    away: m.away.name,
    homeScore: m.home.score!,
    awayScore: m.away.score!,
    label: m.state === "final" ? "FINAL" : m.clock ?? live,
    league: m.leagueLabel,
  };
}

// The strip for a story, or null (no match, ambiguous, or the scoreboard is unavailable: the reel is made without it).
export async function loadScoreStrip(title: string, language: "en" | "es" = "en", now = new Date()): Promise<ReelScore | null> {
  try {
    const { fetchScoreboard } = await import("../scores/scoreboard");
    return scoreStripFor(title, await fetchScoreboard({ windowMs: REEL_SCORE_WINDOW_MS }), now, language);
  } catch (err) {
    console.error("[reel] score strip unavailable:", err);
    return null;
  }
}
