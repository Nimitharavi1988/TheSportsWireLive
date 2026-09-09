// `summary` is deliberately generic for RSS-sourced articles ("Full coverage
// from {source}. Read the original report at the source link below.") --
// it's a structured field the ingestion pipeline can always populate safely
// without risking republishing the publisher's own copyrighted prose. Once
// `body` exists (the AI-written commentary, or a match recap), it's a much
// better, more specific teaser for list/card/meta-description display than
// that generic line. Falls back to `summary` only when there's no body yet.
export function displaySummary(
  article: { summary: string; body: string | null },
  maxLength = 200
): string {
  if (!article.body) return article.summary;
  const trimmed = article.body.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const cut = trimmed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}
