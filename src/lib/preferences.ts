/**
 * Superseded by follows.ts (entity-level follows) — this sport-only cookie
 * is still read as a fallback there, so existing visitors keep their picks,
 * and SELECTABLE_SPORTS remains the list of followable sports.
 *
 * "My Feed" sport preferences -- guest-only, no login required (this site
 * has no public user accounts, see voterCookie.ts's own comment). Stored in
 * a plain (NOT httpOnly, unlike voterCookie.ts's swl_voter_id) cookie so the
 * client component can write it directly via document.cookie with no API
 * round-trip.
 *
 * The homepage server component (page.tsx) deliberately does NOT read this
 * cookie -- an earlier version did, and a real production build caught the
 * problem: page.tsx has `export const revalidate = 60` (ISR, cached at
 * Cloudflare's edge), and reading a per-visitor cookie inside it would risk
 * one visitor's personalized render being cached and served to a different
 * visitor. Personalization instead renders client-side, a beat after the
 * rest of the (still fully cached) page: MyFeedPicker reads this cookie in
 * the browser and fetches /api/my-feed itself. See that route's own comment
 * for the full reasoning.
 *
 * Shared constants only in this file (no `next/headers` import) so it's
 * safe to import from both server components (page.tsx) and the "use
 * client" picker component -- next/headers can't be bundled into client
 * code at all. (No server component currently reads FAVORITE_SPORTS_COOKIE
 * for exactly the reason above, but the constant stays shared in case a
 * future, genuinely dynamic route wants it.)
 */
import { categoryChipStyle } from "./categoryDisplay";

export const FAVORITE_SPORTS_COOKIE = "swl_fav_sports";
export const FAVORITE_SPORTS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, matches voterCookie.ts

// Every real top-level category except football/world-cup, which is a
// seasonal sub-filter of football (see page.tsx's CATEGORY_META) rather
// than a distinct sport someone would pick as a standing favorite.
export const SELECTABLE_SPORTS = [
  "football",
  "cricket",
  "american-football",
  "basketball",
  "baseball",
  "hockey",
  "athletics",
  "rugby",
  "volleyball",
  "formula-1",
] as const;

export type SelectableSport = (typeof SELECTABLE_SPORTS)[number];

export function isSelectableSport(value: string): value is SelectableSport {
  return (SELECTABLE_SPORTS as readonly string[]).includes(value);
}

// A cookie value is client-writable input, not trusted data -- this is the
// same defensive parse any such input gets, not just decorative. Used by
// both the server (page.tsx, reading the raw cookie string) and the client
// component (reading its own last-written value back).
export function parseFavoriteSports(raw: string | undefined | null): SelectableSport[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(isSelectableSport);
}

export function sportLabel(sport: string): string {
  return categoryChipStyle(sport).label;
}
