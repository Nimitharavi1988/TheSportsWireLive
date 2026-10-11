/**
 * Match predictions (pure rules, unit-tested): which matches get an automatic
 * "Who will win?" poll, what its options are, and who won once it is over.
 * The database side lives in predictionsStore.ts.
 */
import { isMajorTeam, leagueWeight } from "./scores/priority";

export type Outcome = "home" | "away" | "draw";

export interface PredictionOption {
  outcome: Outcome;
  text: string;
}

// A prediction opens this long before kickoff and closes at kickoff.
export const PREDICTION_WINDOW_MS = 36 * 60 * 60 * 1000;
// Upper bound per run so a backlog (first run, feed outage) cannot flood the DB.
export const MAX_NEW_PREDICTIONS_PER_RUN = 40;
// An unresolved prediction this long after kickoff (abandoned match, feed that
// never marked it final) is closed as void rather than left open forever.
export const VOID_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function sportOf(category: string): string {
  return category.split("/")[0];
}

// Football is the only sport here where a draw is a normal result.
export function hasDrawOption(category: string): boolean {
  return sportOf(category) === "football";
}

export interface PredictionCandidate {
  category: string;
  homeTeam: string | null;
  awayTeam: string | null;
  leagueLabel: string | null;
  seriesLabel: string | null;
}

// Women's and youth fixtures are skipped: these polls are for the big men's
// competitions, and an empty poll on a minor game looks dead.
const MINOR_LABEL = /\b(women'?s?|under-?\d+|u-?\d\d|youth|junior)\b/i;
// Tier-2 leagues worth a poll: the US sports the audience is here for, plus the
// two leagues the Spanish-language audience follows most.
const US_SPORTS = new Set(["american-football", "college-football", "baseball", "hockey", "basketball", "wnba"]);
const TIER2_OK = /\b(mls|liga mx)\b/i;

// Big matches only (same competition tiers the scoreboard uses). Cricket also
// needs a senior side: "Oman v Nepal" is a World Cup league fixture but not
// a match readers are waiting on.
export function isPredictable(m: PredictionCandidate): boolean {
  if (!m.homeTeam?.trim() || !m.awayTeam?.trim()) return false;
  if (m.homeTeam.trim().toLowerCase() === m.awayTeam.trim().toLowerCase()) return false;
  const label = m.leagueLabel ?? m.seriesLabel ?? "";
  const sport = sportOf(m.category);
  if (MINOR_LABEL.test(label) || MINOR_LABEL.test(m.homeTeam) || MINOR_LABEL.test(m.awayTeam)) return false;
  const weight = leagueWeight(label, sport);
  if (sport === "cricket") return weight >= 300 && (isMajorTeam(sport, m.homeTeam) || isMajorTeam(sport, m.awayTeam));
  if (weight >= 300) return true;
  return weight >= 200 && (US_SPORTS.has(sport) || TIER2_OK.test(label));
}

export function predictionQuestion(): string {
  return "Who will win?";
}

export function predictionOptions(homeTeam: string, awayTeam: string, category: string): PredictionOption[] {
  const options: PredictionOption[] = [{ outcome: "home", text: homeTeam.trim() }];
  if (hasDrawOption(category)) options.push({ outcome: "draw", text: "Draw" });
  options.push({ outcome: "away", text: awayTeam.trim() });
  return options;
}

export interface FinishedMatch {
  category: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  matchNote: string | null;
}

// Who won, or null when it cannot be told for certain (the poll is then void:
// better no result than a wrong one). Cricket has no comparable scores, so it
// is read from the source's own result line ("India won by 14 runs"); a team
// name that does not match exactly voids the prediction.
export function matchOutcome(m: FinishedMatch): Outcome | null {
  const home = m.homeTeam?.trim().toLowerCase();
  const away = m.awayTeam?.trim().toLowerCase();
  if (!home || !away) return null;

  if (sportOf(m.category) === "cricket") {
    const note = m.matchNote?.trim().toLowerCase() ?? "";
    if (note.startsWith(`${home} won`)) return "home";
    if (note.startsWith(`${away} won`)) return "away";
    return null;
  }

  if (m.homeScore === null || m.awayScore === null) return null;
  if (m.homeScore > m.awayScore) return "home";
  if (m.homeScore < m.awayScore) return "away";
  return "draw";
}

// A prediction accepts picks until kickoff; once it is resolved it is closed
// whatever the clock says. Editorial polls never close.
export function isPredictionClosed(
  poll: { kind: string; resolvedAt: Date | null },
  kickoffAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (poll.kind !== "prediction") return false;
  if (poll.resolvedAt) return true;
  return kickoffAt !== null && kickoffAt.getTime() <= now.getTime();
}
