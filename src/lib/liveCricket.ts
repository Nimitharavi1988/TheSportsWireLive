import { db } from "./db";
import { isInternationalFormat } from "./ingestion/cricketCountries";

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
// bury the international game further down the carousel. Uses
// isInternationalFormat (title terminology: T20I/ODI/Test) rather than
// matchCountry (cricketCountries.ts) — matchCountry is deliberately curated
// for flag-display safety and excludes Afghanistan (politically contested
// flag) and West Indies (no single national flag), which would silently
// misclassify a real India vs Afghanistan international as "domestic" and
// bury it. Format terminology has no such gap: only genuine internationals
// are ever labeled T20I/ODI/Test.
function isInternationalMatch(title: string): boolean {
  return isInternationalFormat(title);
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
function internationalFirst<T extends { title: string }>(matches: T[]): T[] {
  const international = matches.filter((m) => isInternationalMatch(m.title));
  const domestic = matches.filter((m) => !isInternationalMatch(m.title));
  return [...international, ...domestic];
}

// Recent finished results stay useful (a Test's result is worth showing for
// a while after it ends) without accumulating forever — 3 days of
// post-finish relevance. Deliberately measured from updatedAt (when we last
// touched the row, i.e. roughly when it was detected as finished), not
// kickoffAt (when it started) — a multi-day Test can easily run 4-5 days
// past its kickoff, so a kickoffAt-based cutoff was excluding exactly the
// international Tests it's meant to highlight right at the moment they
// finished. Confirmed live: an England vs Pakistan 3rd Test correctly
// flipped to "finished" but had already aged out of a kickoffAt-based
// window by the time it did.
const RESULT_LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

const SELECT = {
  id: true, slug: true, title: true, summary: true,
  homeTeam: true, awayTeam: true, homeCrestUrl: true, awayCrestUrl: true,
  homeScoreText: true, awayScoreText: true, kickoffAt: true,
} as const;

export type CricketMatchStatus = "live" | "upcoming" | "finished";

// A Google/ESPN-style scoreboard: matches already underway (status: "live"),
// matches CricketData.org's currentMatches feed already knows about but
// hasn't started yet (status: "upcoming" — that feed isn't a full fixtures
// list days out, just whatever it's currently tracking, but a match it
// already knows about pre-kickoff is worth showing), and recently concluded
// matches with a real result (status: "finished"). Ordered live, then
// finished, then upcoming — most time-sensitive/interesting first.
export async function fetchLiveCricketMatches(take: number) {
  const now = new Date();
  const [scheduled, finishedRaw] = await Promise.all([
    db.article.findMany({
      where: {
        status: "published",
        category: { startsWith: "cricket" },
        matchStatus: "scheduled",
        updatedAt: { gt: new Date(now.getTime() - LIVE_STALENESS_CUTOFF_MS) },
      },
      orderBy: { kickoffAt: "desc" },
      take,
      select: SELECT,
    }),
    db.article.findMany({
      where: {
        status: "published",
        category: { startsWith: "cricket" },
        matchStatus: "finished",
        updatedAt: { gt: new Date(now.getTime() - RESULT_LOOKBACK_MS) },
      },
      orderBy: { kickoffAt: "desc" },
      take,
      select: SELECT,
    }),
  ]);

  const live = internationalFirst(scheduled.filter((m) => m.kickoffAt !== null && m.kickoffAt <= now));
  const upcomingSorted = scheduled
    .filter((m) => m.kickoffAt !== null && m.kickoffAt > now)
    .sort((a, b) => a.kickoffAt!.getTime() - b.kickoffAt!.getTime());
  const upcoming = internationalFirst(upcomingSorted);
  const finished = internationalFirst(finishedRaw);

  return [
    ...live.map((m) => ({ ...m, matchState: "live" as const })),
    ...finished.slice(0, take).map((m) => ({ ...m, matchState: "finished" as const })),
    ...upcoming.map((m) => ({ ...m, matchState: "upcoming" as const })),
  ];
}
