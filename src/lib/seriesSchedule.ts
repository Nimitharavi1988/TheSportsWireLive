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
  // articles, 2026-09-16/24).
  "india-vs-west-indies-odi": { start: "2026-09-27", end: "2026-10-03" },
  // Five T20Is, Oct 6 (Lucknow) to Oct 17 (Bengaluru) — CricketData's own
  // series data (series_info, 2026-09-25); see scores/trackedCricket.ts.
  "india-vs-west-indies-t20i": { start: "2026-10-06", end: "2026-10-17" },
};
