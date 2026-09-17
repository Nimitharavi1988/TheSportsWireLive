import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Confirmed live (2026-09-16): www.sportswirelive.com and
// sportswirelive.com both served the same content with HTTP 200 and no
// redirect between them — every page already declares the non-www URL as
// its canonical (see each page's own `alternates.canonical`), but a
// canonical <link> is only a hint; Google's own guidance treats a real
// redirect as the authoritative signal for this exact www/non-www
// duplication case. Traced directly to Google Search Console flagging 85
// pages as "Duplicate without user-selected canonical" — a site-wide
// count consistent with every page being reachable both ways, not
// anything content-specific. A permanent (308) redirect here, preserving
// the full path and query string, is the fix a canonical tag alone can't
// provide.
export function middleware(request: NextRequest) {
  const { hostname } = request.nextUrl;
  if (hostname === "www.sportswirelive.com") {
    const url = request.nextUrl.clone();
    url.hostname = "sportswirelive.com";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Excludes static assets and Next internals — only real page/API
  // requests need the redirect, matching the standard Next.js middleware
  // matcher pattern used for this exact purpose.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
