import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import { TRACKED_PLAYERS } from "@/lib/players";
import { TRACKED_CLUBS } from "@/lib/clubs";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

  const articles = await db.article.findMany({
    where: { status: "published" },
    select: { slug: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 5000,
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
    lastModified: article.publishedAt ?? undefined,
    changeFrequency: "never",
    priority: 0.7,
  }));

  return [...staticRoutes, ...articleRoutes];
}
