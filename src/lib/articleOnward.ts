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
  const upNext = relatedPool.find(promotable) ?? lists.trending.find(promotable) ?? relatedPool[0] ?? null;
  if (upNext) seen.add(upNext.id);

  const related = take(relatedPool, RELATED_COUNT);
  const taggedIds = new Set(lists.tagged.map((a) => a.id));
  return {
    upNext,
    related,
    relatedIsTagged: related.some((a) => taggedIds.has(a.id)),
    trendingNow: take(lists.trending, SIDE_LIST_COUNT),
    justIn: take(lists.justIn, SIDE_LIST_COUNT),
  };
}
