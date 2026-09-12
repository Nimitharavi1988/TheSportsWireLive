"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// CricketData.org's free, unlimited, no-API-key embeddable widget (verified
// directly: fetched their widgets page, confirmed "NO LIMIT, use it as you
// please") — genuinely live-updates on their own infrastructure, unlike our
// own ingested cricket data, which can only ever refresh every ~20-72 min
// (CricketData.org's API free tier caps at 100 requests/day, and the
// ingestion pipeline already self-throttles to protect it — see
// cricketData.ts). This is the one place on the site "live" means
// second-by-second, not "as fresh as the last ingestion run."
//
// The script expects to sit inside a sized container div exactly like this
// — confirmed by inspecting the raw embed markup on CricketData.org's own
// widgets page, not guessed. The widget's own script relies on its DOM
// position (document.currentScript.parentNode or similar) to know where to
// render — next/script's strategy="afterInteractive" hoists scripts to
// <body> instead of leaving them in place, which broke this outright
// (confirmed directly: the widget rendered nothing). A manually-appended
// <script> element via a ref preserves the exact DOM position the widget
// needs, matching a plain HTML embed. Wrapped in a scrollable/centered
// outer box since the widget itself has a fixed 410x400 size that doesn't
// reflow for narrow mobile viewports.
export default function LiveCricketWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.childElementCount > 0) return;
    const script = document.createElement("script");
    script.src = "https://cdorgapi.b-cdn.net/widgets/matchlist.js";
    container.appendChild(script);
  }, []);

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary", fontWeight: 700, textTransform: "uppercase", fontSize: 11.5, letterSpacing: "0.05em" }}>
        Live Cricket Scores
      </Typography>
      <Box sx={{ overflowX: "auto", display: "flex", justifyContent: { xs: "flex-start", sm: "center" } }}>
        <Box ref={containerRef} sx={{ width: 410, height: 400, flexShrink: 0 }} />
      </Box>
    </Box>
  );
}
