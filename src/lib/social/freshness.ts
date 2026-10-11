/**
 * Freshness for choosing what to post to social media (2026-10-05). The stored
 * trending score has no time component, so a story that scored well 20 hours
 * ago kept outranking this hour's stories: the Page's posts averaged 5-15
 * hours old (22 hours at worst) and clicks fell. The posting picker multiplies
 * its ranking score by this, which halves every FRESHNESS_HALF_LIFE_HOURS.
 * It only reorders: when fresh supply is thin the picker still reaches older
 * stories, so a run is never left without a post. The stored score, and the
 * homepage that ranks by it, are untouched.
 */
export const FRESHNESS_HALF_LIFE_HOURS = 6;

// 1 for a story published just now (or in the future, as match rows can be),
// 0.5 after the half-life, 0.25 after two, and so on (pure, unit-tested).
export function freshnessMultiplier(publishedAt: Date | null | undefined, now: Date): number {
  if (!publishedAt) return 1;
  const ageHours = (now.getTime() - publishedAt.getTime()) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours <= 0) return 1;
  return Math.pow(0.5, ageHours / FRESHNESS_HALF_LIFE_HOURS);
}

// Reels are for fresh news only (2026-10-11): a story published more than this many hours ago is
// not posted as a reel, by the automation or by hand. REEL_MAX_AGE_HOURS overrides it; 0 turns the
// rule off. The age is from when the story was published (created, if it has no publish time).
export const REEL_MAX_AGE_HOURS = 6;

export function reelMaxAgeHours(env: Record<string, string | undefined> = process.env): number {
  const raw = env.REEL_MAX_AGE_HOURS?.trim();
  if (raw === undefined || raw === "") return REEL_MAX_AGE_HOURS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : REEL_MAX_AGE_HOURS;
}

// Whether a story is fresh enough for a reel (pure, unit-tested).
export function reelIsFresh(publishedAt: Date | null | undefined, createdAt: Date | null | undefined, now: Date, maxHours: number = reelMaxAgeHours()): boolean {
  if (maxHours <= 0) return true;
  const base = publishedAt ?? createdAt;
  if (!base) return true;
  return now.getTime() - base.getTime() <= maxHours * 3_600_000;
}
