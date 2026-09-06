// Match-article summaries reliably follow "{home} played/face {away} in the
// {competition}..." (see footballData.ts) — used here only to produce
// meaningful image alt text for team crests, since team names aren't stored
// as separate fields. Falls back to generic labels if the pattern doesn't
// match rather than guessing wrong.
export function crestAltText(summary: string): { home: string; away: string } {
  const match = summary.match(/^(.+?)\s+(?:played|face)\s+(.+?)\s+in the/);
  if (match) {
    return { home: `${match[1]} crest`, away: `${match[2]} crest` };
  }
  return { home: "Home team crest", away: "Away team crest" };
}
