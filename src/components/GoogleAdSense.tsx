import Script from "next/script";

// Dormant until NEXT_PUBLIC_ADSENSE_CLIENT_ID is set (the ca-pub-XXXX id
// from AdSense's "Sites" connection step) — same pattern as
// GoogleAnalytics.tsx. This single script both verifies site ownership for
// AdSense and, once Google approves the site, is what actually starts
// serving ads — no separate verification-only meta tag needed alongside it.
//
// lazyOnload (was a raw <script async>): the 218 KiB AdSense script was
// competing for bandwidth on the critical path — PageSpeed flagged it as
// 145 KiB of unused JS during initial load (2026-10-01). Site verification
// is already complete, so deferring until after load only delays ad fill,
// not verification. The raw <script> was originally needed for AdSense's
// crawler to see the exact tag shape during initial verification; now that
// the site is approved, next/script's lazyOnload is safe and removes the
// script from Lighthouse's measurement window entirely.
//
// Rendered by the pages that carry the site's own writing — the home page,
// sport sections and news articles — not site-wide from the root layout.
// AdSense policy: no ad code on auto-generated pages or pages with little
// original content (match score cards, /scores, embedded videos, player/
// club/country aggregations).
export default function GoogleAdSense() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  if (!clientId) return null;

  return (
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      strategy="lazyOnload"
      crossOrigin="anonymous"
    />
  );
}
