"use client";

// CricketData.org's free, unlimited, no-API-key embeddable widget
// (fixtures/live/results, self-updating) — genuinely real-time, unlike our
// own ingestion below it, which is throttled to ~20-min polling by
// CricketData's separate 100-req/day API cap. Shown alongside
// LiveScoreboardCarousel, not instead of it: this widget is real-time but
// generic (whatever's live globally); ours links straight to our own
// article pages. Loaded inside an iframe rather than injected into the
// page's own DOM — third-party widget scripts like this one are written
// assuming they own the whole document (some still use document.write),
// which can wipe out a React-managed page if loaded directly into it. An
// iframe gives it its own isolated document to do that safely in.
const WIDGET_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><style>body{margin:0;padding:0;}</style></head>
<body>
<script src="https://cdorgapi.b-cdn.net/widgets/matchlist.js"></script>
</body>
</html>`;

export function LiveCricketWidget() {
  return (
    <iframe
      title="Live Cricket Scores"
      srcDoc={WIDGET_HTML}
      style={{ width: "100%", height: 300, border: "none", display: "block" }}
      sandbox="allow-scripts allow-same-origin allow-popups"
    />
  );
}
