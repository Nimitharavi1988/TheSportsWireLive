"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

// Manual ad placement -- deliberately NOT using AdSense's Auto ads (Google's
// algorithm deciding placement/density site-wide, including full-screen
// interstitials) -- see GoogleAdSense.tsx's comment. This is the one
// deliberately chosen placement, picked to sit among content readers
// already treat as supplementary (next to the Live Scores carousel/"Also
// in the News") rather than competing with headlines or interrupting the
// reading flow. Dormant if ads aren't configured, same pattern as
// GoogleAdSense.tsx/GoogleAnalytics.tsx.
export function DisplayAd({ slot }: { slot: string }) {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const pushed = useRef(false);

  useEffect(() => {
    if (!clientId || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script blocked/not loaded (e.g. an ad blocker) -- fail
      // silently, same "never break the page over an optional feature"
      // rule as every other best-effort integration in this codebase.
    }
  }, [clientId]);

  if (!clientId) return null;

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={clientId}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
