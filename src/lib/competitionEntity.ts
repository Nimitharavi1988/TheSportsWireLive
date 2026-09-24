// Pure display helpers for competitions (see competitions.ts), kept apart
// from the database code so they can be unit-tested without a DB.
import { categoryChipStyle } from "./categoryDisplay";
import type { EntityResult } from "./entitySearch";

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
