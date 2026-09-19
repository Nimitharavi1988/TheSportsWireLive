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
//
// onFillStatusChange (optional) reports whether AdSense actually had an ad
// to show -- lets a caller (see MoreHeadlinesAdTile.tsx) collapse/hide
// itself entirely instead of showing an empty box when there's nothing to
// fill (e.g. before the account is approved).
export function DisplayAd({ slot, onFillStatusChange }: { slot: string; onFillStatusChange?: (filled: boolean) => void }) {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const pushed = useRef(false);
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!clientId || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script blocked/not loaded (e.g. an ad blocker) -- fail
      // silently, same "never break the page over an optional feature"
      // rule as every other best-effort integration in this codebase.
      onFillStatusChange?.(false);
      return;
    }

    const el = insRef.current;
    if (!el || !onFillStatusChange) return;

    // AdSense sets data-ad-status ("filled" | "unfilled") on the <ins>
    // once it's decided whether it has an ad to show -- this happens
    // asynchronously after push({}) above, so watch for it rather than
    // checking once.
    const observer = new MutationObserver(() => {
      const status = el.getAttribute("data-ad-status");
      if (status === "filled") onFillStatusChange(true);
      else if (status === "unfilled") onFillStatusChange(false);
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });

    // Caps how long we wait for AdSense to resolve -- if it never does
    // (blocked, slow network), don't leave the caller in permanent limbo.
    const timeout = setTimeout(() => {
      if (!el.getAttribute("data-ad-status")) onFillStatusChange(false);
    }, 5000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [clientId, onFillStatusChange]);

  if (!clientId) return null;

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={clientId}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
