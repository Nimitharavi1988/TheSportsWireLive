import { db } from "@/db";
import { article, articleTag } from "@/db/schema";
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { TRACKED_PLAYERS, type TrackedPlayer } from "./players";
import { TRACKED_CLUBS, type TrackedClub } from "./clubs";
import { TRACKED_COUNTRIES, type TrackedCountry } from "./countries";
import { VENUES, type Venue } from "./venues";

// Tags an editor picks for a story (ArticleTag), alongside the automatic
// headline matching the site already does for players, clubs and
// countries. Each kind points at an existing page.
export const TAG_KINDS = ["player", "club", "country", "venue"] as const;
export type TagKind = (typeof TAG_KINDS)[number];

export interface TagOption {
  kind: TagKind;
  slug: string;
  label: string;
}

const KIND_LABEL: Record<TagKind, string> = { player: "Player", club: "Team", country: "Country", venue: "Venue" };

export function tagGroupLabel(kind: TagKind): string {
  return KIND_LABEL[kind];
}

// Everything that can be tagged, for the editor's picker.
export function tagOptions(): TagOption[] {
  return [
    ...TRACKED_COUNTRIES.map((c) => ({ kind: "country" as const, slug: c.slug, label: c.name })),
    ...TRACKED_CLUBS.map((c) => ({ kind: "club" as const, slug: c.slug, label: c.name })),
    ...TRACKED_PLAYERS.map((p) => ({ kind: "player" as const, slug: p.slug, label: p.name })),
    ...VENUES.map((v) => ({ kind: "venue" as const, slug: v.slug, label: `${v.name}, ${v.city}` })),
  ];
}

export function isKnownTag(t: { kind: string; slug: string }): t is { kind: TagKind; slug: string } {
  return tagOptions().some((o) => o.kind === t.kind && o.slug === t.slug);
}

// "This story is tagged with it" as a WHERE condition on Article, for the
// player/club/country/venue pages (OR'd with their headline matching).
export function taggedWith(kind: TagKind, slug: string): SQL {
  return inArray(
    article.id,
    db.select({ id: articleTag.articleId }).from(articleTag).where(and(eq(articleTag.kind, kind), eq(articleTag.slug, slug)))
  );
}

export interface StoryTags {
  players: TrackedPlayer[];
  clubs: TrackedClub[];
  countries: TrackedCountry[];
  venues: Venue[];
}

export async function fetchStoryTags(articleId: string): Promise<StoryTags> {
  const rows = await db.select({ kind: articleTag.kind, slug: articleTag.slug }).from(articleTag).where(eq(articleTag.articleId, articleId));
  const has = (kind: TagKind) => new Set(rows.filter((r) => r.kind === kind).map((r) => r.slug));
  const players = has("player");
  const clubs = has("club");
  const countries = has("country");
  const venues = has("venue");
  return {
    players: TRACKED_PLAYERS.filter((p) => players.has(p.slug)),
    clubs: TRACKED_CLUBS.filter((c) => clubs.has(c.slug)),
    countries: TRACKED_COUNTRIES.filter((c) => countries.has(c.slug)),
    venues: VENUES.filter((v) => venues.has(v.slug)),
  };
}
