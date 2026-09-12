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

// A match still genuinely live in CricketData.org's currentMatches feed gets
// touched every ~15-min poll (see runIngest.ts's duplicate-handling branch).
// Once a match actually finishes, CricketData.org typically stops returning
// it as "current" at all — so its row here just stops being touched forever,
// with no explicit "finished" signal we can rely on. Without this cutoff, a
// long-finished match sat stuck showing a score hours (in one confirmed
// case, 8+) out of date. 90 minutes is a generous multiple of the 15-min
// poll interval — enough to absorb a missed cron tick or two without
// mistaking a genuinely live match (which should update every cycle, even
// during a lunch/rain break) for a stale one.
const LIVE_STALENESS_CUTOFF_MS = 90 * 60 * 1000;

// International-first, stable within each half (not a re-sort by date) —
// international matches keep their existing order, just moved ahead of every
// domestic match rather than interleaved with them.
function internationalFirst<T extends { homeTeam: string | null; awayTeam: string | null }>(matches: T[]): T[] {
  const international = matches.filter((m) => isInternationalMatch(m.homeTeam, m.awayTeam));
  const domestic = matches.filter((m) => !isInternationalMatch(m.homeTeam, m.awayTeam));
  return [...international, ...domestic];
}

// Returns both matches already underway (isLive: true) and matches
// CricketData.org's currentMatches feed already knows about but that haven't
// started yet (isLive: false) — that feed isn't a full fixtures list days
// out, just whatever it's currently tracking, but a match it already knows
// about pre-kickoff is genuinely "upcoming" and worth showing instead of
// leaving the section empty between live matches.
export async function fetchLiveCricketMatches(take: number) {
  const now = new Date();
  const matches = await db.article.findMany({
    where: {
      status: "published",
      category: { startsWith: "cricket" },
      matchStatus: "scheduled",
      updatedAt: { gt: new Date(Date.now() - LIVE_STALENESS_CUTOFF_MS) },
    },
    orderBy: { kickoffAt: "desc" },
    take,
    select: {
      id: true, slug: true, summary: true,
      homeTeam: true, awayTeam: true, homeCrestUrl: true, awayCrestUrl: true,
      homeScoreText: true, awayScoreText: true, kickoffAt: true,
    },
  });

  const live = internationalFirst(matches.filter((m) => m.kickoffAt !== null && m.kickoffAt <= now));
  const upcomingSorted = matches
    .filter((m) => m.kickoffAt !== null && m.kickoffAt > now)
    .sort((a, b) => a.kickoffAt!.getTime() - b.kickoffAt!.getTime());
  const upcoming = internationalFirst(upcomingSorted);

  return [
    ...live.map((m) => ({ ...m, isLive: true as const })),
    ...upcoming.map((m) => ({ ...m, isLive: false as const })),
  ];
}
