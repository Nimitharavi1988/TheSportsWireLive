import { LOCALES } from "@/lib/i18n/locales";

// Served as es.sportswirelive.com/robots.txt (middleware rewrites to
// /es/robots.txt). A route handler, not robots.ts: Next only accepts that file
// convention at the app root.
export function GET() {
  const site = `https://${LOCALES.es.host}`;
  const body = ["User-Agent: *", "Allow: /", "Disallow: /search", "", `Sitemap: ${site}/sitemap.xml`, `Sitemap: ${site}/news-sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
