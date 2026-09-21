import type { SeriesInfo } from "./cricketSeries";

/**
 * Groups articles into a shared "series" for a real, dated multi-sport event
 * — unlike cricketSeries.ts's detectSeriesFromTitle (bilateral two-team
 * international series, cricket-only), an event here can span every
 * category (cricket, football, athletics, anything) and isn't shaped like a
 * team pair at all. Reuses the exact same /series/[seriesKey] page
 * infrastructure, which was already generic (just "articles matching this
 * seriesKey", no cricket-specific logic in the page itself) even though it
 * had never been used for anything but cricket series until this.
 *
 * Added 2026-09-20 (explicit request) for the 2026 Asian Games
 * (Aichi-Nagoya, Japan, Sep 19 - Oct 4) — confirmed real and live via
 * WebSearch before adding, not guessed: women's cricket Sep 17-22, men's
 * cricket Sep 24-Oct 3. 20 real articles (cricket + football/teqball)
 * already existed with no seriesKey before this.
 *
 * Detection is a plain title-substring match, same recency-based safety
 * reasoning cricketSeries.ts already relies on: every ingested item is
 * already filtered to the last 3 days (MAX_RSS_ITEM_AGE_MS in runIngest.ts),
 * so a fresh title naming a specific, currently-live event is overwhelmingly
 * about that current edition, not a retrospective piece — no year/date
 * disambiguation needed on top of that.
 *
 * Living config: add a new entry here (name substring, key, label) for the
 * next real multi-sport event — a Commonwealth Games, an Olympics — rather
 * than special-casing detection per event.
 */
const EVENTS: { match: RegExp; key: string; label: string }[] = [
  { match: /\bAsian Games\b/i, key: "asian-games-2026", label: "Asian Games 2026" },
];

export function detectEventSeries(title: string): SeriesInfo | null {
  for (const event of EVENTS) {
    if (event.match.test(title)) return { key: event.key, label: event.label };
  }
  return null;
}
