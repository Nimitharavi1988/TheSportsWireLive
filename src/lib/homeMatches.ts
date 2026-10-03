/**
 * Which match pages the all-sports home page lists under "Match Results &
 * Previews" (pure, unit-tested).
 *
 * They used to be the first ten by trending score, and cricket's score is
 * inflated by India/Asia trend keywords, so on 2026-10-02 all ten were
 * cricket — women's under-19s and a CSA Women's Pro50 game among them —
 * while tonight's NHL games, college football and the Nations League had no
 * place. Now: the scoreboard's own ranking (live and marquee first, US sports
 * boosted, minor cricket last), then at most `perSportMax` per sport so one
 * busy sport can't fill the list (`sportCaps` overrides it for one sport). If that leaves
 * fewer than `limit`, the remaining best fill the rest.
 */
import { byPriority } from "./scores/priority";
import { toScoreMatch, type MatchRow } from "./scores/scoreboardModel";

export function pickHomeMatches<T extends MatchRow>(rows: T[], limit: number, now: Date, perSportMax: number, sportCaps: Record<string, number> = {}): T[] {
  const rank = byPriority(now.getTime());
  const scored = rows.flatMap((row) => {
    const match = toScoreMatch(row, now);
    return match ? [{ row, match }] : [];
  });
  scored.sort((a, b) => rank(a.match, b.match));

  const picked: T[] = [];
  const perSport = new Map<string, number>();
  for (const { row, match } of scored) {
    if (picked.length === limit) break;
    const n = perSport.get(match.sport) ?? 0;
    if (n >= (sportCaps[match.sport] ?? perSportMax)) continue;
    perSport.set(match.sport, n + 1);
    picked.push(row);
  }
  for (const { row } of scored) {
    if (picked.length === limit) break;
    if (!picked.includes(row)) picked.push(row);
  }
  return picked;
}
