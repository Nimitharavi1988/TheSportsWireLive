// Article link for a social post, tagged so Google Analytics can separate
// Facebook visitors from everyone else and show how far they read on
// (pages per session, which posts keep people on the site). Facebook's
// in-app browser often sends no usable referrer, so without this most of
// that traffic lands under "direct". Kept to the two standard tags — the
// caption shows the link as visible text, so it should stay short. The
// article page's canonical URL has no query string, so search engines
// never index the tagged variant.
export function socialArticleUrl(siteUrl: string, slug: string, source: "facebook" | "instagram"): string {
  return `${siteUrl}/article/${slug}?utm_source=${source}&utm_medium=social`;
}
