/**
 * Where a reader goes after an article (pure, unit-tested): the "Up next"
 * story, Related (or More in {Category}), Trending Now and Just In — with
 * no story repeated across them. Computed from four candidate lists the
 * article page fetches in parallel.
 */
import { FRESH_NEWS_FALLBACK_DAYS, FRESH_NEWS_MAX_AGE_DAYS } from "./heroConfig";
import { isHeroQualityImage } from "./imageQuality";

export const RELATED_COUNT = 3;
export const SIDE_LIST_COUNT = 5;
export const UP_NEXT_CANDIDATES = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

// Trending Now only ranks recent stories — trendingScore never decays, so
// without a window an 11-day-old story can still top the list (the same
// rule as the homepage's fresh ranking, heroConfig.ts).
export function trendingSince(now: Date = new Date()): Date {
  return new Date(now.getTime() - FRESH_NEWS_MAX_AGE_DAYS * DAY_MS);
}

type Candidate = { id: string; heroImageUrl: string | null; publishedAt: Date | null };

export function pickOnward<T extends Candidate>(
  lists: { tagged: T[]; sameCategory: T[]; trending: T[]; justIn: T[] },
  now: Date = new Date()
) {
  const seen = new Set<string>();
  const take = (items: T[], n: number) => {
    const out: T[] = [];
    for (const item of items) {
      if (out.length === n) break;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  };

  // Up next is a promoted slot, so it follows the homepage's rules: a
  // recent story (never old news) with a proper photo (a big card needs
  // one). Same topic first, then trending; else simply the top related
  // story as a compact card.
  const oldest = now.getTime() - FRESH_NEWS_FALLBACK_DAYS * DAY_MS;
  const promotable = (a: T) =>
    isHeroQualityImage(a.heroImageUrl) && a.publishedAt !== null && a.publishedAt.getTime() >= oldest && a.publishedAt.getTime() <= now.getTime();

  // Tagged player/club stories first, same-category stories filling in.
  const relatedPool = [...lists.tagged, ...lists.sameCategory];
  // Several Up next candidates, not one: the reader's browser shows the
  // first they haven't opened this session (UpNext.tsx). With a single
  // pick, two stories that are each other's newest related story sent
  // readers back and forth between just those two (reported 2026-09-26).
  const promotableIds = new Set<string>();
  const upNextCandidates = [...relatedPool, ...lists.trending].filter((a) => {
    if (!promotable(a) || promotableIds.has(a.id)) return false;
    promotableIds.add(a.id);
    return true;
  }).slice(0, UP_NEXT_CANDIDATES);
  if (upNextCandidates.length === 0 && relatedPool[0]) upNextCandidates.push(relatedPool[0]);
  for (const c of upNextCandidates) seen.add(c.id);
  const upNext = upNextCandidates[0] ?? null;

  const related = take(relatedPool, RELATED_COUNT);
  const taggedIds = new Set(lists.tagged.map((a) => a.id));
  return {
    upNext,
    upNextCandidates,
    related,
    relatedIsTagged: related.some((a) => taggedIds.has(a.id)),
    trendingNow: take(lists.trending, SIDE_LIST_COUNT),
    justIn: take(lists.justIn, SIDE_LIST_COUNT),
  };
}
