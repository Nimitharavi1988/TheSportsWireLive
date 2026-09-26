// Sources that produce auto-generated match previews/results ("Team A 1-2
// Team B") rather than editorial reporting. Single source of truth, shared
// between ingestion (runIngest.ts, to skip Gemini spend on content that's
// already a template), the scoreboard (which rows are matches, and what to
// tell readers about where a score comes from), and the admin "highlight"
// action (a routine final score is never an "Editor's pick"). Living
// config — register a new structured-data source here when one's added.
export interface MatchDataSource {
  /** Article.sourceName, exactly as the fetcher stores it. */
  name: string;
  /** Who the data comes from, as shown to readers ("Source: ESPN"). */
  provider: string;
}

export const MATCH_DATA_SOURCES: MatchDataSource[] = [
  { name: "football-data.org", provider: "football-data.org" },
  { name: "CricketData.org", provider: "CricketData.org" },
  { name: "ESPN Cricket", provider: "ESPN" },
  { name: "ESPN NFL", provider: "ESPN" },
  { name: "MLB Stats API", provider: "MLB" },
  { name: "ESPN NBA", provider: "ESPN" },
  { name: "ESPN Football", provider: "ESPN" },
  { name: "ESPN NHL", provider: "ESPN" },
  { name: "API-Volleyball", provider: "API-Sports" },
  { name: "ESPN Volleyball", provider: "ESPN" },
  { name: "ESPN College Football", provider: "ESPN" },
  { name: "ESPN WNBA", provider: "ESPN" },
];

export const MATCH_DATA_SOURCE_NAMES = MATCH_DATA_SOURCES.map((s) => s.name);

const BY_NAME = new Map(MATCH_DATA_SOURCES.map((s) => [s.name, s]));

export function isMatchDataSource(sourceName: string): boolean {
  return BY_NAME.has(sourceName);
}

// Public provider label for a match row ("ESPN", "MLB"); the raw source
// name when unregistered.
export function matchDataProvider(sourceName: string): string {
  return BY_NAME.get(sourceName)?.provider ?? sourceName;
}
