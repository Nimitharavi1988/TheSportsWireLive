import type { MetadataRoute } from "next";
import { db } from "@/db";
import { article, articleTranslation } from "@/db/schema";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { MATCH_DATA_SOURCE_NAMES } from "@/lib/matchDataSources";
import { ES_SPORTS } from "@/lib/i18n/es";
import { LOCALES } from "@/lib/i18n/locales";

export const revalidate = 3600;

// Served as es.sportswirelive.com/sitemap.xml. Lists only translated articles
// (never match score cards, which are noindex), each paired with its English
// original as an hreflang alternate.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = `https://${LOCALES.es.host}`;
  const en = process.env.SITE_URL ?? "https://sportswirelive.com";

  const rows = await db
    .select({ slug: articleTranslation.slug, enSlug: article.slug, updatedAt: articleTranslation.updatedAt })
    .from(articleTranslation)
    .innerJoin(article, eq(article.id, articleTranslation.articleId))
    .where(and(
      eq(article.status, "published"),
      eq(articleTranslation.locale, "es"),
      eq(articleTranslation.status, "translated"),
      notInArray(article.sourceName, MATCH_DATA_SOURCE_NAMES),
    ))
    .orderBy(desc(article.createdAt))
    .limit(20000);

  return [
    { url: site, changeFrequency: "hourly", priority: 1, alternates: { languages: { es: site, en } } },
    ...ES_SPORTS.map((s) => ({
      url: `${site}/sport/${s.category}`,
      changeFrequency: "hourly" as const,
      priority: 0.8,
      alternates: { languages: { es: `${site}/sport/${s.category}`, en: `${en}/sport/${s.category}` } },
    })),
    { url: `${site}/scores`, changeFrequency: "always" as const, priority: 0.8 },
    { url: `${site}/standings`, changeFrequency: "daily" as const, priority: 0.6 },
    { url: `${site}/player`, changeFrequency: "weekly" as const, priority: 0.5 },
    { url: `${site}/club`, changeFrequency: "weekly" as const, priority: 0.5 },
    ...rows.filter((r) => r.slug).map((r) => ({
      url: `${site}/article/${r.slug}`,
      lastModified: r.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
      alternates: { languages: { es: `${site}/article/${r.slug}`, en: `${en}/article/${r.enSlug}` } },
    })),
  ];
}
