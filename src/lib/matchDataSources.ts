// Sources that produce auto-generated match previews/results ("Team A 1-2
// Team B") rather than editorial reporting. Single source of truth, shared
// between ingestion (runIngest.ts, to skip Gemini spend on content that's
// already a template) and the admin "highlight" action (to keep a routine
// final score from ever being marked "📌 Editor's pick" in Transfers & Big
// News — that badge is for genuinely notable curated stories, not raw
// scorelines. Living config — add a new structured-data source's exact
// sourceName here when one's added).
export const MATCH_DATA_SOURCE_NAMES = [
  "football-data.org",
  "CricketData.org",
  "ESPN NFL",
  "MLB Stats API",
  "ESPN NBA",
  "ESPN Football",
  "ESPN NHL",
  "API-Volleyball",
  "ESPN Volleyball",
  "ESPN College Football",
  "ESPN WNBA",
];

const MATCH_DATA_SOURCES = new Set(MATCH_DATA_SOURCE_NAMES);

export function isMatchDataSource(sourceName: string): boolean {
  return MATCH_DATA_SOURCES.has(sourceName);
}
