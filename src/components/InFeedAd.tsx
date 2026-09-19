"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

// In-feed format (fluid + layout-key), distinct from DisplayAd.tsx's plain
// Display format -- styled in the AdSense dashboard to match the site's own
// look (white background, light border, sans-serif) so it reads as part of
// the content flow. Used within the article body itself, where it stays
// naturally responsive on both mobile and desktop (unlike a sidebar ad,
// which only looks right confined to a real sidebar column -- see
// page.tsx's own comment on why the sidebar ad is desktop-only).
export function InFeedAd({ slot, layoutKey }: { slot: string; layoutKey: string }) {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const pushed = useRef(false);

  useEffect(() => {
    if (!clientId || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script blocked/not loaded -- fail silently, same
      // "never break the page over an optional feature" rule as every
      // other best-effort integration in this codebase.
    }
  }, [clientId]);

  if (!clientId) return null;

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-format="fluid"
      data-ad-layout-key={layoutKey}
      data-ad-client={clientId}
      data-ad-slot={slot}
    />
  );
}
