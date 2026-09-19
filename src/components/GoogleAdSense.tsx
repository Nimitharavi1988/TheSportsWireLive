// Dormant until NEXT_PUBLIC_ADSENSE_CLIENT_ID is set (the ca-pub-XXXX id
// from AdSense's "Sites" connection step) — same pattern as
// GoogleAnalytics.tsx. This single script both verifies site ownership for
// AdSense and, once Google approves the site, is what actually starts
// serving ads — no separate verification-only meta tag needed alongside it.
//
// Deliberately a raw <script> tag, NOT next/script's <Script> component.
// Tried strategy="beforeInteractive" first -- confirmed it does get
// emitted server-side (a <link rel=preload> plus Next's own bootstrap
// mechanism), but verification still failed, suggesting AdSense's crawler
// does a literal match for the exact tag shape Google's own snippet gives,
// not Next's transformed/optimized equivalent. A plain JSX <script> tag
// renders byte-for-byte what Google asked for, no framework-level
// transformation in the way.
export default function GoogleAdSense() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  if (!clientId) return null;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
    />
  );
}
