// Pure helper (no DB imports) so it can be unit-tested — cricketData.ts
// itself needs a database connection just to load.
// CricketData match names are "<Team> vs <Team>, <stage>, <competition>"
// (e.g. "Kent vs Gloucestershire, 53rd Match, County Championship Division
// One 2026") — the competition is everything after the stage.
export function cricketLeagueLabel(matchName: string): string | undefined {
  const parts = matchName.split(", ");
  const competition = parts.slice(2).join(", ").trim();
  return competition || undefined;
}
