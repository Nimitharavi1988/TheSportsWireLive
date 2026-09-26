import { db } from "@/db";
import { article } from "@/db/schema";
import { and, desc, eq, gte, notInArray } from "drizzle-orm";
import { MATCH_DATA_SOURCE_NAMES } from "@/lib/matchDataSources";
import { escapeXml } from "@/lib/xml";

// Google News sitemap: the stories published in the last two days, which is
// how Google News / Top Stories discover a news site's new articles quickly
// (the main sitemap.xml is for everything, refreshed hourly). Spec: at most
// 1,000 URLs, only articles from the last 48 hours, each with its
// publication name, language, date and title. Match rows are left out —
// they're noindex score cards, not news (see the article page's metadata).
export const revalidate = 600;

const WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_URLS = 1000;

export async function GET() {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const rows = await db
    .select({ slug: article.slug, title: article.title, createdAt: article.createdAt })
    .from(article)
    .where(and(
      eq(article.status, "published"),
      notInArray(article.sourceName, MATCH_DATA_SOURCE_NAMES),
      // createdAt: when the story went up on this site — publishedAt can be
      // the source's own (earlier) time.
      gte(article.createdAt, new Date(Date.now() - WINDOW_MS))
    ))
    .orderBy(desc(article.createdAt))
    .limit(MAX_URLS);

  const urls = rows.map((a) => `  <url>
    <loc>${escapeXml(`${siteUrl}/article/${a.slug}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>Sports Wire Live</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${a.createdAt.toISOString()}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>
  </url>`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls.join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
