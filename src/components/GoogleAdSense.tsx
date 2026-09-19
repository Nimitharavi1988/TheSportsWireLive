import Script from "next/script";

// Dormant until NEXT_PUBLIC_ADSENSE_CLIENT_ID is set (the ca-pub-XXXX id
// from AdSense's "Sites" connection step) — same pattern as
// GoogleAnalytics.tsx. This single script both verifies site ownership for
// AdSense and, once Google approves the site, is what actually starts
// serving ads — no separate verification-only meta tag needed alongside it.
export default function GoogleAdSense() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  if (!clientId) return null;

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
