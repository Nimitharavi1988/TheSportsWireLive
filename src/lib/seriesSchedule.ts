/**
 * Known dates for bilateral series (cricketSeries.ts keys), so a series
 * can show in the homepage "Series & events" row — and be labeled "starts
 * Sep 27" — before its coverage volume picks up. Same idea as the event
 * `season` in eventTagging.ts, which covers named events (Asian Games,
 * IPL); this covers two-team series, whose keys come from headlines.
 *
 * Living config, and only real dates: add an entry when a series' schedule
 * is confirmed in actual coverage (cite it below), never estimated. A
 * series without an entry still shows once it's busy in the news
 * (competitionEntity.ts isHappeningNow).
 */
export const SERIES_SCHEDULE: Record<string, { start: string; end: string }> = {
  // Three ODIs: Sep 27 Thiruvananthapuram, Sep 30 Guwahati, Oct 3 New
  // Chandigarh — per Wisden's series guide and squad coverage (stored
  // articles, 2026-09-16/24). The following T20I series (5 matches from
  // Oct 6, Lucknow) has no confirmed end date in coverage yet, so no entry.
  "india-vs-west-indies-odi": { start: "2026-09-27", end: "2026-10-03" },
};
