// Max manually-picked hero articles at once, per section (see sectionOf
// below) — not a single sitewide total. Picking one more than this within
// the same section auto-retires that section's oldest pick (see
// featureArticle in admin/actions.ts) rather than blocking the action or
// affecting other sections' picks at all.
export const HERO_CAP = 5;

// A manual hero pick (see /admin's "Feature as hero") stops qualifying for
// the hero carousel once it's this many days old — this site's own content
// turns over multiple times an hour, so an unrotated pick would otherwise
// advertise stale news indefinitely. Shared between the homepage's hero
// selection (page.tsx) and the admin queue's "Featured hero" chip, so the
// two never disagree about whether a given pick is still actually live.
export const HERO_FEATURE_MAX_AGE_DAYS = 2;

export function isHeroFeatureStale(featuredAt: Date | null): boolean {
  if (!featuredAt) return true;
  const cutoff = Date.now() - HERO_FEATURE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return featuredAt.getTime() < cutoff;
}

// Groups a raw category ("football", "football/world-cup", "cricket",
// "american-football") down to the top-level section it belongs to — the
// same grouping the homepage's own category filter already uses
// (`category: { startsWith: category } }`), so a football pick and a
// world-cup pick correctly share one cap instead of getting two separate
// budgets that could together exceed what the hero carousel (itself capped
// at 5 visible slides) can actually show at once for that section.
export function sectionOf(category: string): string {
  return category.split("/")[0];
}
