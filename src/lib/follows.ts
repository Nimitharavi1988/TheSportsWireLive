/**
 * Follows — the entity-level successor to preferences.ts's sport-only "My
 * Feed" favorites. A visitor follows specific clubs, players, countries, or
 * whole sports (the ESPN "Favorites" / The Athletic "Following" / FotMob
 * pattern), not just a sport. Still guest-only and cookie-based for the
 * same reasons preferences.ts documents (no public accounts on this site;
 * a plain, non-httpOnly cookie so client components can write it directly).
 *
 * Cookie format: comma-separated `kind:slug` pairs, e.g.
 * `club:arsenal,player:virat-kohli,sport:cricket`. Client-writable input,
 * so everything read back goes through parseFollows' format check here and
 * entitySearch.ts's resolveFollows (which drops anything not in the real
 * tracked catalogs) before touching a query.
 *
 * Deliberately no imports of clubs.ts/players.ts here — this file is
 * bundled into client components, and those catalogs are large. Name/href
 * resolution lives server-side in entitySearch.ts.
 */
import { FAVORITE_SPORTS_COOKIE, parseFavoriteSports } from "./preferences";

export const FOLLOWS_COOKIE = "swl_follows";
export const FOLLOWS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, matches preferences.ts
export const FOLLOWS_CHANGED_EVENT = "swl:follows-changed";

export const FOLLOW_KINDS = ["club", "player", "country", "sport", "series"] as const;
export type FollowKind = (typeof FOLLOW_KINDS)[number];

export interface FollowRef {
  kind: FollowKind;
  slug: string;
}

// Generous but finite — keeps the cookie well under the 4KB limit and the
// For You query's OR list bounded.
export const MAX_FOLLOWS = 40;

const SLUG_PATTERN = /^[a-z0-9-]{1,60}$/;

export function followKey(ref: FollowRef): string {
  return `${ref.kind}:${ref.slug}`;
}

export function isFollowKind(value: string): value is FollowKind {
  return (FOLLOW_KINDS as readonly string[]).includes(value);
}

export function parseFollows(raw: string | undefined | null): FollowRef[] {
  if (!raw) return [];
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return []; // malformed %-escape in a hand-edited cookie
  }
  const seen = new Set<string>();
  const result: FollowRef[] = [];
  for (const part of decoded.split(",")) {
    const [kind, slug] = part.trim().split(":");
    if (!kind || !slug || !isFollowKind(kind) || !SLUG_PATTERN.test(slug)) continue;
    const ref = { kind, slug };
    const key = followKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
    if (result.length >= MAX_FOLLOWS) break;
  }
  return result;
}

export function serializeFollows(refs: FollowRef[]): string {
  return refs.slice(0, MAX_FOLLOWS).map(followKey).join(",");
}

// Reads the follows cookie, falling back to the older sport-only favorites
// cookie so visitors who already picked sports under "My Feed" keep them.
// Takes a getter rather than touching document/next-headers itself, so the
// same logic serves both the browser (document.cookie) and the server
// (next/headers' cookies()).
export function readFollowsFrom(getCookie: (name: string) => string | undefined): FollowRef[] {
  const raw = getCookie(FOLLOWS_COOKIE);
  if (raw !== undefined) return parseFollows(raw);
  return parseFavoriteSports(getCookie(FAVORITE_SPORTS_COOKIE)).map((slug) => ({ kind: "sport", slug }));
}

// --- Browser-only helpers ---

export function browserCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function readBrowserFollows(): FollowRef[] {
  return readFollowsFrom(browserCookie);
}

export function writeBrowserFollows(refs: FollowRef[]) {
  document.cookie = `${FOLLOWS_COOKIE}=${encodeURIComponent(serializeFollows(refs))}; path=/; max-age=${FOLLOWS_COOKIE_MAX_AGE}; samesite=lax`;
  // Every FollowButton/strip on the page listens for this, so following a
  // club from the search dropdown updates the homepage strip immediately.
  window.dispatchEvent(new CustomEvent(FOLLOWS_CHANGED_EVENT));
}
