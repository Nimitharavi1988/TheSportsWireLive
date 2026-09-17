import Typography from "@mui/material/Typography";

// Minimal source-attribution treatment, used everywhere an article card
// lists where a story came from (homepage, player/club/series pages) — a
// bordered, colored Chip was more visually prominent than source credit
// needs to be, and inconsistent besides (warning-tinted in one section,
// primary-tinted in others). Standard practice among real news aggregators
// (Google News, Apple News, Flipboard) is small, subdued text that never
// competes with the headline — not a hard compliance requirement being
// relaxed, just matching how this is normally done. Attribution still
// needs to exist and stay legible, which plain caption text does just as
// well as a chip; the article page's own "Original source: {name} ↗" line
// (the real credit-and-link-back point) is unaffected by this and stays
// as-is.
export function SourceLabel({ children }: { children: string }) {
  return (
    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
      {children}
    </Typography>
  );
}
