import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import { TRACKED_PLAYERS } from "@/lib/players";
import { TRACKED_CLUBS } from "@/lib/clubs";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

  // 5000 was close to binding: 3,646 published articles already, growing
  // ~200+/day — would have started silently dropping the oldest articles
  // out of the sitemap within 1-2 weeks. 20000 gives a multi-month runway
  // at the current pace; well under the 50000-URL hard limit for a single
  // sitemap.xml (Next.js's generateSitemaps() is the pattern to reach for
  // once actually approaching that, not needed yet).
  const articles = await db.article.findMany({
    where: { status: "published" },
    select: { slug: true, publishedAt: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 20000,
  });

  const seriesRows = await db.article.groupBy({
    by: ["seriesKey"],
    where: { seriesKey: { not: null }, status: "published" },
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "hourly", priority: 1 },
    { url: `${siteUrl}/?category=football`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${siteUrl}/?category=cricket`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${siteUrl}/?category=american-football`, changeFrequency: "hourly", priority: 0.8 },
    // Was missing these 4 of 7 nav categories entirely — each has a real
    // self-canonicalizing page (CATEGORY_META in page.tsx already covers
    // all 7), just never had a direct sitemap discovery path.
    { url: `${siteUrl}/?category=basketball`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${siteUrl}/?category=baseball`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${siteUrl}/?category=rugby`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${siteUrl}/?category=athletics`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${siteUrl}/standings`, changeFrequency: "daily", priority: 0.6 },
    { url: `${siteUrl}/player`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/club`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/series`, changeFrequency: "daily", priority: 0.5 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...STANDINGS_LEAGUES.map((league) => ({
      url: `${siteUrl}/standings/${league.code}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
    ...TRACKED_PLAYERS.map((player) => ({
      url: `${siteUrl}/player/${player.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...TRACKED_CLUBS.map((club) => ({
      url: `${siteUrl}/club/${club.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...seriesRows
      .filter((row): row is { seriesKey: string } => row.seriesKey !== null)
      .map((row) => ({
        url: `${siteUrl}/series/${row.seriesKey}`,
        changeFrequency: "hourly" as const,
        priority: 0.6,
      })),
  ];

  const articleRoutes: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${siteUrl}/article/${article.slug}`,
    // updatedAt, not publishedAt — a match-data article's content really
    // does change after publish (scheduled -> live -> finished score
    // updates, see runIngest.ts's duplicate-refresh branch), and lastmod is
    // the signal that tells crawlers a page is worth re-fetching. publishedAt
    // never moves once set, so real post-publish content changes were
    // invisible to this signal entirely.
    lastModified: article.updatedAt,
    changeFrequency: "never",
    priority: 0.7,
  }));

  return [...staticRoutes, ...articleRoutes];
}
