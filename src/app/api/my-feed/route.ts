import { NextRequest, NextResponse } from "next/server";
import { fetchMyFeedArticles, parseSportsParam } from "@/lib/myFeed";

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
export async function GET(req: NextRequest) {
  const sports = parseSportsParam(req.nextUrl.searchParams.get("sports"));
  if (sports.length === 0) return NextResponse.json({ articles: [] });

  const articles = await fetchMyFeedArticles(sports);
  return NextResponse.json({ articles });
}
