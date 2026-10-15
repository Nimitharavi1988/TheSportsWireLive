/**
 * Which open predictions go in the home page's "Today's picks" row (pure,
 * unit-tested): the biggest competitions first, soonest kickoff within a tier,
 * one entry per matchup (a doubleheader's second game would repeat the same
 * teams), at most `limit`.
 */
import { leagueWeight } from "./scores/priority";
import { sportOf } from "./predictions";

export const PICKS_ROW_SIZE = 3;
// Only matches starting within this window go in the row, so it stays about "today".
export const PICKS_WINDOW_MS = 30 * 60 * 60 * 1000;

export interface PickCandidate {
  homeTeam: string | null;
  awayTeam: string | null;
  leagueLabel: string | null;
  category: string;
  kickoffAt: Date;
}

export function pickRowOrder<T extends PickCandidate>(candidates: T[], limit: number = PICKS_ROW_SIZE): T[] {
  const weight = (c: T) => leagueWeight(c.leagueLabel ?? "", sportOf(c.category));
  const sorted = [...candidates].sort((a, b) => weight(b) - weight(a) || a.kickoffAt.getTime() - b.kickoffAt.getTime());
  const seen = new Set<string>();
  const out: T[] = [];
  for (const c of sorted) {
    if (!c.homeTeam || !c.awayTeam) continue;
    const key = `${c.homeTeam.toLowerCase()}|${c.awayTeam.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}
