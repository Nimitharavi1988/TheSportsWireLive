// SportBusy's free, keyless, no-signup Premier League live-scores widget
// (sportbusy.com/embed?league=premier-league) — a real-time supplement
// alongside our own ingestion (which polls every ~15 min, not truly
// live), not a replacement for it. Confirmed commercial use is explicitly
// permitted (unlike some competing widget services, which restrict free
// use to editorial/blog/fan sites only) as long as the "Powered by
// SportBusy" footer stays visible inside the iframe — it already does,
// untouched.
//
// Loaded as a direct iframe src, not a srcDoc-wrapped document — that
// page is a real, standalone SportBusy URL, not a raw third-party script
// meant to be injected into our own DOM, so there's no document.write
// risk here to isolate against.
export function LiveFootballWidget() {
  return (
    <iframe
      title="Live Premier League Scores"
      src="https://www.sportbusy.com/embed?league=premier-league"
      loading="lazy"
      style={{ width: "100%", height: 380, border: "none", borderRadius: 12, display: "block" }}
    />
  );
}
