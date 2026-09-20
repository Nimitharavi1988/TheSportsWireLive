"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";

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
//
// Self-collapses when unfilled -- added 2026-09-20 (confirmed live: the
// article page wrapped each of these in its own <Box sx={{..., mb: 3}}>,
// and that margin stayed reserved even when AdSense had nothing to fill the
// slot with, the exact same empty-wrapper-margin gap already fixed for the
// homepage's sidebar/More-Headlines ads via DisplayAd.tsx's
// onFillStatusChange + CollapsibleAdBox -- this one just never got the same
// fix). Same MutationObserver-on-data-ad-status mechanism as DisplayAd.tsx,
// but self-contained here rather than exposed as a prop, since the call
// site (article/[slug]/page.tsx) is a server component and can't hold the
// state itself -- `sx` (including responsive display + margin) is applied
// only once actually filled; the <ins> itself still mounts either way so
// the ad request can happen and fill status can ever resolve to true.
export function InFeedAd({ slot, layoutKey, sx }: { slot: string; layoutKey: string; sx?: object }) {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const pushed = useRef(false);
  const insRef = useRef<HTMLModElement>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (!clientId || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script blocked/not loaded -- fail silently, same
      // "never break the page over an optional feature" rule as every
      // other best-effort integration in this codebase.
      setFilled(false);
      return;
    }

    const el = insRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      const status = el.getAttribute("data-ad-status");
      if (status === "filled") setFilled(true);
      else if (status === "unfilled") setFilled(false);
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });

    // Caps how long we wait for AdSense to resolve -- if it never does
    // (blocked, slow network), don't leave the slot reserving space forever.
    const timeout = setTimeout(() => {
      if (!el.getAttribute("data-ad-status")) setFilled(false);
    }, 5000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [clientId]);

  if (!clientId) return null;

  return (
    <Box sx={filled ? sx : { display: "none" }}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-format="fluid"
        data-ad-layout-key={layoutKey}
        data-ad-client={clientId}
        data-ad-slot={slot}
      />
    </Box>
  );
}
