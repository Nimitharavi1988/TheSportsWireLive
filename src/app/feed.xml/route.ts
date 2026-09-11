import { db } from "@/lib/db";

export const revalidate = 900; // matches the ingest cron cadence — no point refreshing more often than new content can actually land

// Standard RSS 2.0 syndication feed of our own published articles — for
// readers/aggregators (Flipboard's Publisher account, feed readers, etc.)
// to pull from automatically, the same self-serve mechanism every other RSS
// source this site itself ingests from (rssFeeds.ts) relies on. Only ever
// our own original content (body — Gemini commentary over real facts,
// never a source's copyrighted prose — or, for player-news items with no
// body by design, the same summary already shown on the article page), so
// there's no republishing concern going the other direction.
const MAX_ITEMS = 50;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

  const articles = await db.article.findMany({
    where: { status: "published" },
    select: { slug: true, title: true, summary: true, body: true, category: true, sourceName: true, createdAt: true, heroImageUrl: true },
    // createdAt (when it actually landed on the site), not publishedAt —
    // match-preview articles set publishedAt to the future kickoff time, so
    // ordering by that would put next week's fixture preview above today's
    // real news. Same reason the homepage's own "Just In" module only draws
    // from the trending-ranked list rather than a raw publishedAt sort.
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS,
  });

  const items = articles
    .map((article) => {
      const url = `${siteUrl}/article/${article.slug}`;
      const description = (article.body ?? article.summary).slice(0, 2000);
      const pubDate = article.createdAt.toUTCString();
      const enclosure = article.heroImageUrl
        ? `<enclosure url="${escapeXml(article.heroImageUrl)}" type="image/jpeg" />`
        : "";

      return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(article.category)}</category>
      <description>${escapeXml(description)}</description>
      ${enclosure}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Sports Wire Live</title>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Live football, cricket and NFL news from Sports Wire Live.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
