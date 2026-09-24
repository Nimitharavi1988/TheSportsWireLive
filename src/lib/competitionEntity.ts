// Pure display helpers for competitions (see competitions.ts), kept apart
// from the database code so they can be unit-tested without a DB.
import { categoryChipStyle } from "./categoryDisplay";
import type { EntityResult } from "./entitySearch";
import { eventSeason } from "./ingestion/eventTagging";
import { SERIES_SCHEDULE } from "./seriesSchedule";

export interface CompetitionFields {
  key: string;
  label: string;
  // The single category every story shares, or null for a multi-sport
  // event (Asian Games: cricket + football + athletics...).
  category: string | null;
}

// A dated competition shows in "Series & events" this many days before it
// starts, labeled "starts Sep 27" — squads and previews land the week before.
export const UPCOMING_LEAD_DAYS = 7;

// Real start/end dates when we have them: a named event's season
// (eventTagging.ts) or a bilateral series' schedule (seriesSchedule.ts).
function knownDates(key: string): { start: string; end: string } | null {
  return eventSeason(key)?.season ?? SERIES_SCHEDULE[key] ?? null;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDay(d);
}

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// "India vs West Indies • ODI" → "IW"; "Asian Games 2026" → "AG"; "IPL" → "IP".
function competitionInitials(label: string): string {
  const main = label.split("•")[0].trim();
  const parts = main.includes(" vs ") ? main.split(" vs ") : main.split(/\s+/);
  const letters = parts.map((p) => p.trim()[0] ?? "").join("").replace(/[^\p{L}\p{N}]/gu, "");
  return (letters.length >= 2 ? letters.slice(0, 2) : main.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2)).toUpperCase();
}

function competitionSubtitle(c: Pick<CompetitionFields, "key" | "label" | "category">, now: Date): string {
  const format = c.label.split("•")[1]?.trim();
  const base = format ? `${format} series` : c.category === null ? "Multi-sport event" : `${categoryChipStyle(c.category).label} competition`;
  const dates = knownDates(c.key);
  return dates && isoDay(now) < dates.start ? `${base} · starts ${formatDay(dates.start)}` : base;
}

export function competitionToEntity(c: CompetitionFields, now: Date = new Date()): EntityResult {
  return {
    kind: "series",
    slug: c.key,
    name: c.label,
    subtitle: competitionSubtitle(c, now),
    href: `/series/${c.key}`,
    initials: competitionInitials(c.label),
    color: c.category ? categoryChipStyle(c.category).color : "#3d5a73",
  };
}

// Minimum stories in the last 7 days for an undated bilateral series to
// count — below this it's usually a one-off mention (a look-back piece
// naming an old series), not a series being played.
export const HAPPENING_MIN_RECENT_STORIES = 3;

// Whether a competition belongs in "Series & events" (homepage row, empty
// search box, For You picker) — a stricter bar than "active" (searchable).
// - Known dates (event season or series schedule): from UPCOMING_LEAD_DAYS
//   before the start through the end date, regardless of story volume.
// - A named event with no season (IPL between seasons): never — story
//   volume can't tell in-season from off-season coaching/auction news.
// - Any other bilateral series: recent story volume.
export function isHappeningNow(c: { key: string; recentCount: number }, now: Date = new Date()): boolean {
  const dates = knownDates(c.key);
  if (dates) {
    const today = isoDay(now);
    return today >= shiftDays(dates.start, -UPCOMING_LEAD_DAYS) && today <= dates.end;
  }
  if (eventSeason(c.key)) return false;
  return c.recentCount >= HAPPENING_MIN_RECENT_STORIES;
}
