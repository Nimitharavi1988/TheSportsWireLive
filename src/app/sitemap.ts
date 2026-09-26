import type { MetadataRoute } from "next";
import { db } from "@/db";
import { article as articleTable, author as authorTable } from "@/db/schema";
import { and, eq, isNotNull, desc, notInArray } from "drizzle-orm";
import { STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import { TRACKED_PLAYERS } from "@/lib/players";
import { TRACKED_CLUBS } from "@/lib/clubs";
import { TRACKED_COUNTRIES } from "@/lib/countries";
import { CATEGORY_META } from "@/lib/categoryMeta";
import { MATCH_DATA_SOURCE_NAMES } from "@/lib/matchDataSources";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

  // 5000 was close to binding: 3,646 published articles already, growing
  // ~200+/day — would have started silently dropping the oldest articles
  // out of the sitemap within 1-2 weeks. 20000 gives a multi-month runway
  // at the current pace; well under the 50000-URL hard limit for a single
  // sitemap.xml (Next.js's generateSitemaps() is the pattern to reach for
  // once actually approaching that, not needed yet).
  const articles = await db
    .select({ slug: articleTable.slug, publishedAt: articleTable.publishedAt, updatedAt: articleTable.updatedAt })
    .from(articleTable)
    // Match rows are templated score cards and are noindex (see the
    // article page's generateMetadata) — /scores and the sport pages are
    // what should rank for scores.
    .where(and(eq(articleTable.status, "published"), notInArray(articleTable.sourceName, MATCH_DATA_SOURCE_NAMES)))
    .orderBy(desc(articleTable.publishedAt))
    .limit(20000);

  const seriesRows = await db
    .selectDistinct({ seriesKey: articleTable.seriesKey })
    .from(articleTable)
    .where(and(isNotNull(articleTable.seriesKey), eq(articleTable.status, "published")));

  const authors = await db.select({ slug: authorTable.slug }).from(authorTable);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "hourly", priority: 1 },
    // Every sport section, from the same list the site uses for them.
    ...Object.keys(CATEGORY_META).map((category) => ({
      url: `${siteUrl}/sport/${category}`,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    { url: `${siteUrl}/scores`, changeFrequency: "always", priority: 0.8 },
    { url: `${siteUrl}/analysis`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/standings`, changeFrequency: "daily", priority: 0.6 },
    { url: `${siteUrl}/videos`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${siteUrl}/player`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/club`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/country`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/series`, changeFrequency: "daily", priority: 0.5 },
    { url: `${siteUrl}/about`, changeFrequency: "yearly", priority: 0.3 },
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
    ...authors.map((a) => ({
      url: `${siteUrl}/author/${a.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...TRACKED_COUNTRIES.map((country) => ({
      url: `${siteUrl}/country/${country.slug}`,
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
