import { db } from "@/db";
import { article, articleTranslation } from "@/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { LOCALES } from "@/lib/i18n/locales";
import { ES } from "@/lib/i18n/es";
import { escapeXml } from "@/lib/xml";

// Spanish RSS 2.0 feed (es.sportswirelive.com/feed.xml); same shape and
// ordering rules as the English /feed.xml (createdAt, not publishedAt, so a
// future match preview never outranks today's news).
export const revalidate = 900;
const MAX_ITEMS = 50;

export async function GET() {
  const site = `https://${LOCALES.es.host}`;
  const rows = await db
    .select({
      slug: articleTranslation.slug, title: articleTranslation.title, body: articleTranslation.body,
      category: article.category, createdAt: article.createdAt, heroImageUrl: article.heroImageUrl,
    })
    .from(articleTranslation)
    .innerJoin(article, eq(article.id, articleTranslation.articleId))
    .where(and(
      eq(article.status, "published"),
      eq(articleTranslation.locale, "es"),
      eq(articleTranslation.status, "translated"),
      isNotNull(articleTranslation.body),
    ))
    .orderBy(desc(article.createdAt))
    .limit(MAX_ITEMS);

  const items = rows
    .filter((a) => a.slug && a.title)
    .map((a) => {
      const url = `${site}/article/${a.slug}`;
      const enclosure = a.heroImageUrl ? `<enclosure url="${escapeXml(a.heroImageUrl)}" type="image/jpeg" />` : "";
      return `    <item>
      <title>${escapeXml(a.title!)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${a.createdAt.toUTCString()}</pubDate>
      <category>${escapeXml(a.category)}</category>
      <dc:creator>Sports Wire Live</dc:creator>
      <description>${escapeXml(a.body!.slice(0, 2000))}</description>
      ${enclosure}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Sports Wire Live en Español</title>
    <link>${site}</link>
    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml" />
    <description>${escapeXml(ES.tagline)}</description>
    <language>es-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
