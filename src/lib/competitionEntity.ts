// Pure display helpers for competitions (see competitions.ts), kept apart
// from the database code so they can be unit-tested without a DB.
import { categoryChipStyle } from "./categoryDisplay";
import type { EntityResult } from "./entitySearch";
import { eventSeason } from "./ingestion/eventTagging";

export interface CompetitionFields {
  key: string;
  label: string;
  // The single category every story shares, or null for a multi-sport
  // event (Asian Games: cricket + football + athletics...).
  category: string | null;
}

// "India vs West Indies • ODI" → "IW"; "Asian Games 2026" → "AG"; "IPL" → "IP".
function competitionInitials(label: string): string {
  const main = label.split("•")[0].trim();
  const parts = main.includes(" vs ") ? main.split(" vs ") : main.split(/\s+/);
  const letters = parts.map((p) => p.trim()[0] ?? "").join("").replace(/[^\p{L}\p{N}]/gu, "");
  return (letters.length >= 2 ? letters.slice(0, 2) : main.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2)).toUpperCase();
}

function competitionSubtitle(c: Pick<CompetitionFields, "label" | "category">): string {
  const format = c.label.split("•")[1]?.trim();
  if (format) return `${format} series`;
  if (c.category === null) return "Multi-sport event";
  return `${categoryChipStyle(c.category).label} competition`;
}

export function competitionToEntity(c: CompetitionFields): EntityResult {
  return {
    kind: "series",
    slug: c.key,
    name: c.label,
    subtitle: competitionSubtitle(c),
    href: `/series/${c.key}`,
    initials: competitionInitials(c.label),
    color: c.category ? categoryChipStyle(c.category).color : "#3d5a73",
  };
}

// Minimum stories in the last 7 days for a bilateral series to count as
// happening — below this it's usually a one-off mention (a look-back
// piece naming an old series), not a series being played.
export const HAPPENING_MIN_RECENT_STORIES = 3;

// "Happening now" (homepage row, empty search box, For You picker) — a
// stricter bar than "active" (searchable). Named events (eventTagging.ts)
// use their season dates, since story volume can't tell an in-season IPL
// from off-season coaching news; an event with no season set never counts.
// Everything else (bilateral cricket series) goes by recent volume.
export function isHappeningNow(c: { key: string; recentCount: number }, now: Date = new Date()): boolean {
  const event = eventSeason(c.key);
  if (event) {
    if (!event.season) return false;
    const today = now.toISOString().slice(0, 10);
    return today >= event.season.start && today <= event.season.end;
  }
  return c.recentCount >= HAPPENING_MIN_RECENT_STORIES;
}
