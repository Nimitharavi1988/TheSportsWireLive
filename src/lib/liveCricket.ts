import { db } from "./db";

// Cricket's ingestion (cricketData.ts) pulls "currentMatches" — matches
// already underway, not fixed-future fixtures like football/NFL. Their
// kickoffAt is in the past (the match already started) but matchStatus
// isn't "finished" either (no result yet). Football/NFL never fetch an
// in-play state at all, so a past kickoffAt there just means the FINISHED
// poll hasn't landed yet, not a genuine in-progress match — this is
// deliberately cricket-only.
export function fetchLiveCricketMatches(take: number) {
  return db.article.findMany({
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
}
