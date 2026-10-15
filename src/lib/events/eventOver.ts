import { eventSeason } from "../ingestion/eventTagging";

// Days after a Games' last day that its home-page medal card is still shown
// (the final table is worth a look), then it goes. Without this the card
// stayed up for weeks after the 2026 Asian Games ended: it only checked that
// the table had been synced recently, and the sync keeps running.
export const MEDAL_CARD_GRACE_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

// True once an event with a known season is more than `graceDays` past its
// last day. An event with no season set is never reported as over (the caller
// falls back to its own freshness check).
export function isEventOver(eventKey: string, now: Date = new Date(), graceDays: number = MEDAL_CARD_GRACE_DAYS): boolean {
  const end = eventSeason(eventKey)?.season?.end;
  if (!end) return false;
  const lastMoment = Date.parse(`${end}T23:59:59Z`);
  return !Number.isNaN(lastMoment) && now.getTime() > lastMoment + graceDays * DAY_MS;
}
