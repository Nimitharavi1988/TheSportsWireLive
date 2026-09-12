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

// Below this, a paragraph reads fine as one block — above it, confirmed
// live (2026-09-12): Gemini's commentary (commentary.ts asks for "2 short
// paragraphs" but doesn't force a literal blank-line separator) frequently
// comes back as one unbroken 4-6 sentence block, rendering as a dense wall
// of text. Match-recap text and any other body source has the same risk.
// Rather than depend on every text source reliably inserting real
// paragraph breaks, this guarantees readable-sized paragraphs at display
// time regardless of source — real \n\n breaks are respected first (kept
// intact, never re-merged), only a block that's still too long afterward
// gets regrouped into smaller ~2-sentence chunks.
const MAX_PARAGRAPH_CHARS = 320;
const SENTENCES_PER_PARAGRAPH = 2;

export function splitIntoParagraphs(text: string): string[] {
  const rawParagraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const result: string[] = [];
  for (const paragraph of rawParagraphs) {
    if (paragraph.length <= MAX_PARAGRAPH_CHARS) {
      result.push(paragraph);
      continue;
    }

    // Sentence-boundary split (end punctuation + following whitespace) —
    // imperfect for abbreviations, but this content is short-form sports
    // commentary, not prose dense with them, and an occasional
    // slightly-early break reads far better than one long block.
    const sentences = paragraph.match(/[^.!?]+[.!?]+(?:\s+|$)/g) ?? [paragraph];
    let chunk: string[] = [];
    for (const sentence of sentences) {
      chunk.push(sentence.trim());
      if (chunk.length >= SENTENCES_PER_PARAGRAPH) {
        result.push(chunk.join(" "));
        chunk = [];
      }
    }
    if (chunk.length > 0) result.push(chunk.join(" "));
  }

  return result;
}
