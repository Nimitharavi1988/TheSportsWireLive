import { db } from "./db";
import { matchCountry } from "./ingestion/cricketCountries";

// Cricket's ingestion (cricketData.ts) pulls "currentMatches" — matches
// already underway, not fixed-future fixtures like football/NFL. Their
// kickoffAt is in the past (the match already started) but matchStatus
// isn't "finished" either (no result yet). Football/NFL never fetch an
// in-play state at all, so a past kickoffAt there just means the FINISHED
// poll hasn't landed yet, not a genuine in-progress match — this is
// deliberately cricket-only.
// Real fan interest skews heavily toward international cricket (England vs
// Pakistan, India vs Australia) over the many concurrent domestic franchise
// matches (CPL, BBL, various T20 leagues) that otherwise flood this list and
// bury the international game further down the carousel. matchCountry()
// (cricketCountries.ts) is the same exact-match-against-a-curated-list check
// already used for national flags, so "international" here can't be fooled
// by a franchise name that happens to look like a country (e.g. "Barbados
// Tridents").
function isInternationalMatch(homeTeam: string | null, awayTeam: string | null): boolean {
  return !!homeTeam && !!awayTeam && !!matchCountry(homeTeam) && !!matchCountry(awayTeam);
}

export async function fetchLiveCricketMatches(take: number) {
  const matches = await db.article.findMany({
    where: {
      status: "published",
      category: { startsWith: "cricket" },
      matchStatus: "scheduled",
      kickoffAt: { lt: new Date() },
    },
    orderBy: { kickoffAt: "desc" },
    take,
    select: {
      id: true, slug: true, summary: true,
      homeTeam: true, awayTeam: true, homeCrestUrl: true, awayCrestUrl: true,
      homeScoreText: true, awayScoreText: true,
    },
  });

  // Stable partition, not a re-sort by date — international matches keep
  // their existing most-recently-started-first order, just moved ahead of
  // every domestic match rather than interleaved with them.
  const international = matches.filter((m) => isInternationalMatch(m.homeTeam, m.awayTeam));
  const domestic = matches.filter((m) => !isInternationalMatch(m.homeTeam, m.awayTeam));
  return [...international, ...domestic];
}
