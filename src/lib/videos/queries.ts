import { db } from "@/db";
import { video } from "@/db/schema";
import { and, desc, eq, gte, ilike, isNull, ne, or } from "drizzle-orm";
import { pickVideoStrip, VIDEO_FRESH_MS, VIDEO_PAGE_FRESH_MS, videoSearchWords } from "./videoStrip";

export type VideoItem = { youtubeId: string; title: string; channelTitle: string; publishedAt: Date; isHighlights: boolean; category: string };

const COLUMNS = {
  youtubeId: video.youtubeId,
  title: video.title,
  channelTitle: video.channelTitle,
  publishedAt: video.publishedAt,
  isHighlights: video.isHighlights,
  category: video.category,
};

// Videos are stored under the top-level sport; a page category like
// "football/world-cup" filters on "football".
export function videoSport(category: string | null | undefined): string | undefined {
  return category ? category.split("/")[0] : undefined;
}

async function fetchRecent(opts: { sport?: string; freshMs: number; now: Date; take: number; excludeMatchArticleId?: string }) {
  return db
    .select(COLUMNS)
    .from(video)
    .where(and(
      gte(video.publishedAt, new Date(opts.now.getTime() - opts.freshMs)),
      ...(opts.sport ? [eq(video.category, opts.sport)] : []),
      // The article's own highlights are already shown at the top of it.
      ...(opts.excludeMatchArticleId ? [or(isNull(video.matchArticleId), ne(video.matchArticleId, opts.excludeMatchArticleId))] : [])
    ))
    .orderBy(desc(video.publishedAt))
    .limit(opts.take);
}

// Latest official videos for a strip (homepage, sport pages, article pages).
// `fallbackToAll`: a sport with no official channel (rugby, athletics) or a
// quiet few days still gets a strip, from every sport — used on article
// pages, where most Facebook visitors land and this is their way in to
// the videos.
export async function fetchLatestVideos(
  opts: { category?: string; limit?: number; now?: Date; excludeMatchArticleId?: string; fallbackToAll?: boolean } = {}
): Promise<VideoItem[]> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 10;
  const sport = videoSport(opts.category);
  const base = { freshMs: VIDEO_FRESH_MS, now, take: 80, excludeMatchArticleId: opts.excludeMatchArticleId };
  let picked = pickVideoStrip(await fetchRecent({ ...base, sport }), limit);
  if (sport && opts.fallbackToAll && picked.length < 3) picked = pickVideoStrip(await fetchRecent(base), limit);
  return picked;
}

// Everything for the /videos page: a longer window than the strips, no
// per-channel cap (the page is the full list), newest first.
export async function fetchVideoLibrary(opts: { category?: string; now?: Date } = {}): Promise<VideoItem[]> {
  return fetchRecent({ sport: videoSport(opts.category), freshMs: VIDEO_PAGE_FRESH_MS, now: opts.now ?? new Date(), take: 200 });
}

// /videos?q= search over the same window: every word must appear in the
// title or channel name ("kohli wi" finds "Kohli ... #INDvWI").
export async function searchVideos(query: string, opts: { category?: string; now?: Date } = {}): Promise<VideoItem[]> {
  const words = videoSearchWords(query);
  if (words.length === 0) return [];
  const sport = videoSport(opts.category);
  return db
    .select(COLUMNS)
    .from(video)
    .where(and(
      gte(video.publishedAt, new Date((opts.now ?? new Date()).getTime() - VIDEO_PAGE_FRESH_MS)),
      ...(sport ? [eq(video.category, sport)] : []),
      ...words.map((w) => or(ilike(video.title, `%${w}%`), ilike(video.channelTitle, `%${w}%`)))
    ))
    .orderBy(desc(video.isHighlights), desc(video.publishedAt))
    .limit(60);
}

// Which sports have any videos in the /videos window, for its filter chips
// (a chip that leads to an empty page is a dead end).
export async function fetchVideoSports(now: Date = new Date()): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: video.category })
    .from(video)
    .where(gte(video.publishedAt, new Date(now.getTime() - VIDEO_PAGE_FRESH_MS)));
  return rows.map((r) => r.category);
}

// The highlights video linked to a match story (youtubeSync.ts), if any.
export async function fetchMatchVideo(articleId: string): Promise<VideoItem | null> {
  const rows = await db.select(COLUMNS).from(video).where(eq(video.matchArticleId, articleId)).orderBy(desc(video.publishedAt)).limit(1);
  return rows[0] ?? null;
}
