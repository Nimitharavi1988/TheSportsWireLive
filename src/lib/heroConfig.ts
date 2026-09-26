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

// Same staleness problem as hero picks, one section down: a manual
// "Highlight (transfers/big news)" pick (see /admin) that's never
// explicitly un-highlighted would otherwise sit in one of the 4 Transfers
// & Big News slots forever, permanently crowding out genuinely new
// highlight-worthy stories (isHighlightWorthy's own automatic picks) even
// after the manual pick is old news. Also shared with page.tsx's
// `highlightCandidatesRaw` query window, which governs how far back the
// *automatic* picks can come from — the two were drifting (3 days each,
// duplicated as a separate hardcoded literal in page.tsx) until this was
// unified. Matches the hero carousel's own 2-day window now (tightened
// from 3, explicit request 2026-09-20: "don't keep any news in the
// highlight sections which is more than 2 days old") — still finite, so
// the section self-corrects without needing an admin to remember to come
// back and clear it. Shared between the homepage's highlight selection
// (page.tsx) and the admin queue's "📌 Highlighted" chip.
export const HIGHLIGHT_MAX_AGE_DAYS = 2;

export function isHighlightStale(highlightedAt: Date | null): boolean {
  if (!highlightedAt) return true;
  const cutoff = Date.now() - HIGHLIGHT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return highlightedAt.getTime() < cutoff;
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

// Homepage news freshness. trendingScore never decays, so the homepage's
// main list — the one most sections are built from (hero, Player News,
// Also in the News, category tiles, ...) — is limited to recent stories:
// the last 24 hours (2026-09-26, was 2 days: a daily visitor should find
// new headlines every day). A page with fewer than FRESH_NEWS_MIN_RESULTS
// such stories widens one step at a time through FRESH_NEWS_WINDOWS_DAYS
// instead of rendering empty sections — measured 2026-09-26: All, NFL,
// Football, Cricket, Volleyball, F1 and Athletics fill from 24h; MLB and
// Rugby need 2 days; NHL and NBA 7. Nothing older than the last window is
// ever shown.
export const FRESH_NEWS_WINDOWS_DAYS = [1, 2, 7] as const;
export const FRESH_NEWS_MAX_AGE_DAYS = FRESH_NEWS_WINDOWS_DAYS[0];
export const FRESH_NEWS_FALLBACK_DAYS = FRESH_NEWS_WINDOWS_DAYS[FRESH_NEWS_WINDOWS_DAYS.length - 1];
export const FRESH_NEWS_MIN_RESULTS = 25;
