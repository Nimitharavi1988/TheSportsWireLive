/**
 * Groups cricket articles — both structured match-data items (CricketData.org)
 * AND editorial RSS/player-news coverage — into a shared "series" whenever
 * they're about the same bilateral international tour (e.g. "India vs
 * Afghanistan, T20I"), so /series/[seriesKey] can list a tour's news together
 * instead of the site only ever showing one flat chronological feed.
 *
 * Deliberately scoped to bilateral INTERNATIONAL series only (Test/ODI/T20I)
 * for now, not franchise tournaments (IPL etc.) — those group by a single
 * tournament name rather than a team pair, a different shape this doesn't
 * attempt to handle yet.
 *
 * NOT gated on cricketCountries.ts's CRICKET_COUNTRIES list — Afghanistan is
 * deliberately excluded there (no freely-licensed flag), but a real India vs
 * Afghanistan T20I series still needs to group correctly, so series
 * derivation only needs the two team names as plain strings, never a
 * resolved CricketCountry.
 */

export interface SeriesInfo {
  key: string;
  label: string;
}

// Matches both singular ("T20I") and plural ("T20Is") — real editorial
// headlines overwhelmingly use the plural ("Afghanistan T20Is"), which a
// bare \bT20I\b word-boundary check misses entirely (no boundary between
// "I" and a following "s", both word characters).
const FORMAT_LABELS: [RegExp, string][] = [
  [/\bT20Is?\b/i, "T20I"],
  [/\bODIs?\b/i, "ODI"],
  [/\bTests?\b/i, "Test"],
];

export function detectSeriesFormat(text: string): string | null {
  for (const [pattern, label] of FORMAT_LABELS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

function normalizeTeamName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Alphabetical team ordering keeps the key/label stable regardless of which
// team a given source lists as "home" — CricketData.org's match.name order
// isn't guaranteed consistent run to run.
export function deriveSeriesKey(homeTeam: string, awayTeam: string, formatSourceText: string): SeriesInfo | null {
  const format = detectSeriesFormat(formatSourceText);
  if (!format) return null;

  const homeNorm = normalizeTeamName(homeTeam);
  const awayNorm = normalizeTeamName(awayTeam);
  if (!homeNorm || !awayNorm || homeNorm === awayNorm) return null;

  const [firstNorm, firstLabel, secondLabel] =
    homeNorm < awayNorm ? [homeNorm, homeTeam.trim(), awayTeam.trim()] : [awayNorm, awayTeam.trim(), homeTeam.trim()];
  const secondNorm = firstNorm === homeNorm ? awayNorm : homeNorm;

  return {
    key: `${firstNorm}-vs-${secondNorm}-${format.toLowerCase()}`,
    label: `${firstLabel} vs ${secondLabel} • ${format}`,
  };
}

export interface ActiveSeries extends SeriesInfo {
  homeTeam: string;
  awayTeam: string;
}

// For editorial/player-news items, which don't carry structured homeTeam/
// awayTeam — matches a title against currently-known series by requiring
// BOTH team names present (same false-positive discipline as
// titleMentionsPlayer/looksLikeReferencePage elsewhere in this pipeline:
// under-grouping a real story is a much smaller problem than wrongly
// grouping an unrelated one).
export function matchSeriesInTitle(title: string, activeSeries: ActiveSeries[]): SeriesInfo | null {
  const lower = title.toLowerCase();
  for (const series of activeSeries) {
    if (lower.includes(series.homeTeam.toLowerCase()) && lower.includes(series.awayTeam.toLowerCase())) {
      return { key: series.key, label: series.label };
    }
  }
  return null;
}
