import { db } from "@/db";
import { article, articleTranslation } from "@/db/schema";
import { and, desc, eq, gte, notInArray } from "drizzle-orm";
import { MATCH_DATA_SOURCE_NAMES } from "@/lib/matchDataSources";
import { LOCALES } from "@/lib/i18n/locales";
import { escapeXml } from "@/lib/xml";
import { indexableArticleSql } from "@/lib/thinContent";

// Spanish Google News sitemap (es.sportswirelive.com/news-sitemap.xml): same
// rules as the English one — last 48h, at most 1,000 URLs, no match score
// cards — with <news:language>es</news:language>.
export const revalidate = 600;

const WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

export async function GET() {
  const site = `https://${LOCALES.es.host}`;
  const rows = await db
    .select({ slug: articleTranslation.slug, title: articleTranslation.title, createdAt: articleTranslation.updatedAt })
    .from(articleTranslation)
    .innerJoin(article, eq(article.id, articleTranslation.articleId))
    .where(and(
      eq(article.status, "published"),
      eq(articleTranslation.locale, "es"),
      eq(articleTranslation.status, "translated"),
      notInArray(article.sourceName, MATCH_DATA_SOURCE_NAMES),
      // A translation of a short write-up is noindex like its original
      // (thinContent.ts) — missed here when that rule went in (2026-10-04).
      indexableArticleSql(),
      gte(article.createdAt, new Date(Date.now() - WINDOW_MS)),
    ))
    .orderBy(desc(article.createdAt))
    .limit(1000);

  const urls = rows
    .filter((a) => a.slug && a.title)
    .map((a) => `  <url>
    <loc>${escapeXml(`${site}/article/${a.slug}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>Sports Wire Live</news:name>
        <news:language>es</news:language>
      </news:publication>
      <news:publication_date>${a.createdAt.toISOString()}</news:publication_date>
      <news:title>${escapeXml(a.title!)}</news:title>
    </news:news>
  </url>`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls.join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
