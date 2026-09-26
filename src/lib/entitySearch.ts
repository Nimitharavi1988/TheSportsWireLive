/**
 * One searchable catalog of everything a visitor can look up or follow:
 * tracked clubs, players, countries, and sports. Powers the header search's
 * "Teams, players and sports" suggestions (ESPN/FotMob-style entity-first
 * results), the /search page's entity row, and name/href resolution for
 * follows. Server-only by convention — it pulls in the full clubs/players
 * catalogs, which client components shouldn't bundle (see follows.ts).
 */
import { TRACKED_CLUBS } from "./clubs";
import { TRACKED_PLAYERS } from "./players";
import { TRACKED_COUNTRIES } from "./countries";
import { SELECTABLE_SPORTS } from "./preferences";
import { categoryChipStyle } from "./categoryDisplay";
import { playerInitials } from "./playerAvatar";
import { followKey, type FollowKind, type FollowRef } from "./follows";

export interface EntityResult {
  kind: FollowKind;
  slug: string;
  name: string;
  subtitle: string;
  href: string;
  initials: string;
  color: string;
}

interface CatalogEntry extends EntityResult {
  // Lowercased, accent-stripped name + search terms, precomputed once.
  haystack: string[];
  // Article-matching inputs for the For You feed.
  titleTerms: string[];
  category?: string;
}

// Two letters either way: "Manchester City" → "MC", "Arsenal" → "AR"
// (playerInitials alone gives a lone "A" for one-word names).
function entityInitials(name: string): string {
  const initials = playerInitials(name);
  return initials.length >= 2 ? initials : name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase();
}

export function normalizeForSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const CATALOG: CatalogEntry[] = [
  ...SELECTABLE_SPORTS.map((sport) => {
    const { label, color } = categoryChipStyle(sport);
    return {
      kind: "sport" as const,
      slug: sport,
      name: label,
      subtitle: "Sport",
      href: `/sport/${sport}`,
      initials: label.slice(0, 2).toUpperCase(),
      color,
      haystack: [normalizeForSearch(label), normalizeForSearch(sport.replace(/-/g, " "))],
      titleTerms: [],
      category: sport,
    };
  }),
  ...TRACKED_CLUBS.map((club) => {
    const sport = club.sport ?? "football";
    const { label, color } = categoryChipStyle(sport);
    return {
      kind: "club" as const,
      slug: club.slug,
      name: club.name,
      subtitle: `${label} team`,
      href: `/club/${club.slug}`,
      initials: entityInitials(club.name),
      color,
      haystack: [club.name, ...club.searchTerms].map(normalizeForSearch),
      titleTerms: club.searchTerms,
    };
  }),
  ...TRACKED_PLAYERS.map((player) => {
    const { label, color } = categoryChipStyle(player.sport);
    return {
      kind: "player" as const,
      slug: player.slug,
      name: player.name,
      subtitle: `${label} player`,
      href: `/player/${player.slug}`,
      initials: entityInitials(player.name),
      color,
      haystack: [player.name, ...player.searchTerms].map(normalizeForSearch),
      titleTerms: player.searchTerms,
    };
  }),
  ...TRACKED_COUNTRIES.map((country) => ({
    kind: "country" as const,
    slug: country.slug,
    name: country.name,
    subtitle: "Country",
    href: `/country/${country.slug}`,
    initials: entityInitials(country.name),
    color: "#3d5a73",
    haystack: [country.name, ...country.searchTerms].map(normalizeForSearch),
    titleTerms: country.searchTerms,
  })),
];

const BY_KEY = new Map(CATALOG.map((entry) => [followKey(entry), entry]));

function toResult(entry: CatalogEntry): EntityResult {
  const { kind, slug, name, subtitle, href, initials, color } = entry;
  return { kind, slug, name, subtitle, href, initials, color };
}

// Word-prefix matching, scored so the most natural hit wins: "ars" ranks
// Arsenal (name starts with it) above anything that merely contains a word
// starting with it. A match may start at any word boundary and span words
// ("west indies" finds "India vs West Indies • ODI"), but never mid-word —
// "ma" shouldn't surface every name with "ma" buried inside a word.
export function scoreHaystack(haystack: string[], q: string): number {
  let best = 0;
  haystack.forEach((text, i) => {
    const isName = i === 0;
    if (text === q) best = Math.max(best, isName ? 100 : 90);
    else if (text.startsWith(q)) best = Math.max(best, isName ? 80 : 60);
    else if ((" " + text.replace(/[\s-]+/g, " ")).includes(" " + q)) best = Math.max(best, isName ? 50 : 40);
  });
  return best;
}

export const MIN_QUERY_LENGTH = 2;

// Something searchable that isn't in the static catalog — today, active
// competitions from competitions.ts, which come from the database.
export interface ExtraSearchItem {
  entity: EntityResult;
  haystack: string[];
}

export function searchEntities(query: string, limit = 6, extra: ExtraSearchItem[] = []): EntityResult[] {
  const q = normalizeForSearch(query);
  if (q.length < MIN_QUERY_LENGTH) return [];
  return [
    ...CATALOG.map((entry) => ({ entity: toResult(entry), s: scoreHaystack(entry.haystack, q) })),
    ...extra.map((item) => ({ entity: item.entity, s: scoreHaystack(item.haystack, q) })),
  ]
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || a.entity.name.length - b.entity.name.length)
    .slice(0, limit)
    .map(({ entity }) => entity);
}

// Drops anything not in the real catalogs — a cookie or query param can
// name any slug, but only tracked entities are ever shown or queried.
export function resolveFollows(refs: FollowRef[]): EntityResult[] {
  return refs.flatMap((ref) => {
    const entry = BY_KEY.get(followKey(ref));
    return entry ? [toResult(entry)] : [];
  });
}

export interface FollowMatchers {
  titleTerms: { key: string; name: string; terms: string[] }[];
  categories: { key: string; name: string; category: string }[];
}

export function followMatchers(refs: FollowRef[]): FollowMatchers {
  const matchers: FollowMatchers = { titleTerms: [], categories: [] };
  for (const ref of refs) {
    const entry = BY_KEY.get(followKey(ref));
    if (!entry) continue;
    if (entry.category) matchers.categories.push({ key: followKey(entry), name: entry.name, category: entry.category });
    else matchers.titleTerms.push({ key: followKey(entry), name: entry.name, terms: entry.titleTerms });
  }
  return matchers;
}

// Search-as-you-type needs prefix matching ("arse" should already find
// Arsenal stories), which websearch_to_tsquery (used by /search) doesn't do.
// Split into two parts because the stored vector is English-stemmed:
// - `complete`: every word but the last, finished words, matched normally
//   through the english config ("champions" -> 'champion').
// - `partial`: the word still being typed. Matched as a literal prefix via
//   the simple config — english would stem the fragment first (confirmed
//   live: "ars" became 'ar:*' and matched Arkansas and Argonauts). The
//   route also ORs in an exact english match, so a finished last word like
//   "running" still hits the stemmed 'run'.
// Tokens are reduced to letters/digits, so no tsquery operator from user
// input can reach the query text (it's also passed as a bound parameter).
export function buildPrefixTsQuery(q: string): { complete: string | null; partial: string } | null {
  const tokens = q.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 6) ?? [];
  if (tokens.length === 0) return null;
  const partial = tokens[tokens.length - 1];
  const complete = tokens.slice(0, -1);
  return { complete: complete.length > 0 ? complete.join(" & ") : null, partial };
}

// Shown when the search box is empty and as starting suggestions in the
// follow picker. A fixed editorial list rather than a computed "trending"
// one — labeled "Popular" in the UI, not "Trending", so it doesn't claim
// something it isn't measuring.
const POPULAR_KEYS = [
  "club:arsenal",
  "club:real-madrid",
  "player:messi",
  "player:virat-kohli",
  "country:india",
  "club:kansas-city-chiefs",
  "club:los-angeles-lakers",
  "sport:cricket",
];

export function popularEntities(): EntityResult[] {
  return POPULAR_KEYS.flatMap((key) => {
    const entry = BY_KEY.get(key);
    return entry ? [toResult(entry)] : [];
  });
}
