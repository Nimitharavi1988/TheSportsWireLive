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

// Stories about these players stay worth posting as they age: their audience keeps reading them, so
// they are ranked as if at most STAR_MAX_AGE_HOURS old (whole words: "Messi" is not "Messina", and
// "Ronaldo" is not "Ronaldinho").
export const STAR_MAX_AGE_HOURS = 1;
export const STAR_TERMS = /(^|[^a-z])(messi|ronaldo|cristiano)([^a-z]|$)/i;
export const isStarStory = (title: string | null | undefined): boolean => Boolean(title && STAR_TERMS.test(title));

// 1 for a story published just now (or in the future, as match rows can be),
// 0.5 after the half-life, 0.25 after two, and so on (pure, unit-tested). A star story (see above)
// never decays past STAR_MAX_AGE_HOURS, when its title is passed.
export function freshnessMultiplier(publishedAt: Date | null | undefined, now: Date, title?: string | null): number {
  if (!publishedAt) return 1;
  let ageHours = (now.getTime() - publishedAt.getTime()) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours <= 0) return 1;
  if (isStarStory(title)) ageHours = Math.min(ageHours, STAR_MAX_AGE_HOURS);
  return Math.pow(0.5, ageHours / FRESHNESS_HALF_LIFE_HOURS);
}
