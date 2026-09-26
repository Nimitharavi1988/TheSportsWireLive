import { db } from "@/db";
import { article, socialPost } from "@/db/schema";
import { and, eq, gte, lt, count, isNotNull, sql, asc } from "drizzle-orm";
import { hasRealImage, isAutoApprovable } from "./contentQuality";
import { STALE_NO_IMAGE_HOURS, STALE_NO_BODY_HOURS } from "./ingestion/autoApprove";

// Every incident in the 2026-09-20 session was discovered by a human
// noticing something wrong on the live site or Facebook Page, not by any
// internal signal — this is the internal signal. Rendered on /admin (see
// admin/page.tsx) so the next incident is caught from the dashboard the
// operator already opens daily, not from a live Facebook post days later.
// Every number here is a plain read of current DB state, computed on page
// load — no new tables, no new cron job, nothing to keep running or go
// stale on its own.

export interface PipelineHealth {
  facebook: { last1h: number; last6h: number; last24h: number };
  instagram: { last1h: number; last6h: number; last24h: number };
  pendingQueue: { total: number; oldestAgeHours: number | null; dueForStaleRejectSoon: number };
  bulkActionAnomalies: { reviewedBy: string; reviewedAt: string; count: number }[];
  imageSanityIssues: number;
}

async function socialPace(platform: "facebook" | "instagram") {
  const now = Date.now();
  const [{ value: last1h }, { value: last6h }, { value: last24h }] = await Promise.all([
    db.select({ value: count() }).from(socialPost)
      .where(and(eq(socialPost.platform, platform), eq(socialPost.destination, "main"), eq(socialPost.status, "posted"), gte(socialPost.createdAt, new Date(now - 1 * 60 * 60 * 1000))))
      .then((r) => r[0]),
    db.select({ value: count() }).from(socialPost)
      .where(and(eq(socialPost.platform, platform), eq(socialPost.destination, "main"), eq(socialPost.status, "posted"), gte(socialPost.createdAt, new Date(now - 6 * 60 * 60 * 1000))))
      .then((r) => r[0]),
    db.select({ value: count() }).from(socialPost)
      .where(and(eq(socialPost.platform, platform), eq(socialPost.destination, "main"), eq(socialPost.status, "posted"), gte(socialPost.createdAt, new Date(now - 24 * 60 * 60 * 1000))))
      .then((r) => r[0]),
  ]);
  return { last1h, last6h, last24h };
}

export async function getPipelineHealth(): Promise<PipelineHealth> {
  const now = Date.now();

  const [facebook, instagram, [{ value: pendingTotal }], oldestPendingRows, staleReviewCandidates, bulkAnomalyRows, recentPublished] =
    await Promise.all([
      socialPace("facebook"),
      socialPace("instagram"),
      db.select({ value: count() }).from(article).where(eq(article.status, "pending_review")),
      db.select({ createdAt: article.createdAt }).from(article)
        .where(eq(article.status, "pending_review")).orderBy(asc(article.createdAt)).limit(1),
      // Items that will cross the shorter of the two stale-reject windows
      // within the next 2h, AND still don't clear the bar (only these are
      // actually headed for rejection — an item that's about to qualify
      // shouldn't read as "about to be lost").
      db.select({
        body: article.body, heroImageUrl: article.heroImageUrl, homeCrestUrl: article.homeCrestUrl,
        playerNewsSourced: article.playerNewsSourced, sourceName: article.sourceName,
      }).from(article).where(and(
        eq(article.status, "pending_review"),
        lt(article.createdAt, new Date(now - (Math.min(STALE_NO_IMAGE_HOURS, STALE_NO_BODY_HOURS) - 2) * 60 * 60 * 1000))
      )),
      // Same fingerprint that identified the real 310-article incident:
      // one admin identity, one exact reviewedAt timestamp, an implausibly
      // large row count — only a single atomic bulk UPDATE produces that
      // shape, never a human clicking one article at a time.
      db.select({ reviewedBy: article.reviewedBy, reviewedAt: article.reviewedAt, value: count() })
        .from(article)
        .where(and(isNotNull(article.reviewedBy), isNotNull(article.reviewedAt), gte(article.reviewedAt, new Date(now - 24 * 60 * 60 * 1000))))
        .groupBy(article.reviewedBy, article.reviewedAt)
        .having(sql`count(*) > 50`),
      db.select({ heroImageUrl: article.heroImageUrl })
        .from(article)
        .where(and(eq(article.status, "published"), gte(article.createdAt, new Date(now - 24 * 60 * 60 * 1000)), isNotNull(article.heroImageUrl))),
    ]);

  const oldestAgeHours = oldestPendingRows[0]?.createdAt
    ? (now - oldestPendingRows[0].createdAt.getTime()) / (60 * 60 * 1000)
    : null;
  const dueForStaleRejectSoon = staleReviewCandidates.filter((a) => !isAutoApprovable(a)).length;

  // A malformed-URL sanity issue, not "no image at all" — a heroImageUrl
  // that's present and not the generic Pexels fallback but still fails
  // hasRealImage's pathname check (see contentQuality.ts) is exactly the
  // bare-domain bug class confirmed live on 2026-09-20 (ESPN Cricinfo's
  // "https://p.imgci.com"), not the ordinary/expected case of an article
  // with no real photo.
  const imageSanityIssues = recentPublished.filter(
    (a) => a.heroImageUrl && !a.heroImageUrl.includes("pexels.com") && !hasRealImage({ heroImageUrl: a.heroImageUrl, homeCrestUrl: null })
  ).length;

  return {
    facebook,
    instagram,
    pendingQueue: { total: pendingTotal, oldestAgeHours, dueForStaleRejectSoon },
    bulkActionAnomalies: bulkAnomalyRows.map((r) => ({
      reviewedBy: r.reviewedBy!,
      reviewedAt: r.reviewedAt!.toISOString(),
      count: r.value,
    })),
    imageSanityIssues,
  };
}
