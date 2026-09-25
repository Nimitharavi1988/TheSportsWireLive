import { db } from "@/db";
import { video } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { pickVideoStrip, VIDEO_FRESH_MS } from "./videoStrip";

export type VideoItem = { youtubeId: string; title: string; channelTitle: string; publishedAt: Date; isHighlights: boolean };

const COLUMNS = {
  youtubeId: video.youtubeId,
  title: video.title,
  channelTitle: video.channelTitle,
  publishedAt: video.publishedAt,
  isHighlights: video.isHighlights,
};

// Latest official videos for the Videos strip, optionally for one sport
// (a page category like "football/world-cup" filters on "football").
export async function fetchLatestVideos(opts: { category?: string; limit?: number; now?: Date } = {}): Promise<VideoItem[]> {
  const now = opts.now ?? new Date();
  const sport = opts.category?.split("/")[0];
  const rows = await db
    .select(COLUMNS)
    .from(video)
    .where(and(gte(video.publishedAt, new Date(now.getTime() - VIDEO_FRESH_MS)), ...(sport ? [eq(video.category, sport)] : [])))
    .orderBy(desc(video.publishedAt))
    .limit(80);
  return pickVideoStrip(rows, opts.limit ?? 10);
}

// The highlights video linked to a match story (youtubeSync.ts), if any.
export async function fetchMatchVideo(articleId: string): Promise<VideoItem | null> {
  const rows = await db.select(COLUMNS).from(video).where(eq(video.matchArticleId, articleId)).orderBy(desc(video.publishedAt)).limit(1);
  return rows[0] ?? null;
}
