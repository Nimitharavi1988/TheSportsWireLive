import { NextRequest, NextResponse } from "next/server";
import { fetchFollowingArticles, parseFollowsParams } from "@/lib/myFeed";
import { resolveAllFollows } from "@/lib/competitions";

// Deliberately a client-fetched API route, not a cookie-read inside the
// homepage server component itself — page.tsx's `/` has `export const
// revalidate = 60` (ISR, cached at Cloudflare's edge via OpenNext's R2
// store). Reading a per-visitor cookie inside that component would make
// its render depend on visitor-specific state while the rendered HTML is
// still being cached and reused across different visitors for up to 60
// seconds -- a real risk of one visitor's personalized page being served to
// another. A Route Handler has no such conflict (always request-scoped,
// never ISR'd), so personalization lives here and renders into the page
// client-side instead of touching the cached server render at all.
//
// Takes the follows list as a query param (not the cookie) so the response
// depends only on the URL — safe to cache at the edge for a short time.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const refs = parseFollowsParams(params.get("follows"), params.get("sports"));
  const entities = await resolveAllFollows(refs);
  if (entities.length === 0) return NextResponse.json({ entities: [], articles: [] });

  const limit = Math.min(Math.max(Number(params.get("limit")) || 12, 1), 30);
  const articles = await fetchFollowingArticles(refs, limit);
  return NextResponse.json(
    { entities, articles },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
