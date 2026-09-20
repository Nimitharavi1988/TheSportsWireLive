// Catches "same real-world event, different publisher's headline" — the
// exact-normalized-title dedupe in dedupe.ts only blocks a byte-identical
// headline, so 3-4 outlets covering the same match/moment each get ingested
// as a genuinely separate article (different wording), and each was then
// independently eligible to post to Facebook/Instagram. Confirmed live
// 2026-09-20: 4 different sources' "Salah hat-trick vs Galatasaray" articles
// each posted to the Page within ~8 hours.
//
// This is a word-overlap heuristic, not true semantic similarity — it won't
// catch every near-duplicate (a differently-angled piece on the same event,
// e.g. "Why Salah made history", shares few literal words with a plain match
// recap), but it catches the common case (most real duplicate coverage
// reuses the same names/score/opponent) with no added API cost or latency
// on every post attempt.
const STOPWORDS = new Set([
  "a", "an", "the", "as", "for", "and", "in", "on", "at", "to", "of", "is",
  "was", "were", "with", "after", "before", "his", "her", "he", "she", "it",
  "this", "that", "from", "by", "vs", "v", "over", "out", "up", "down",
  "into", "than", "but", "or", "not", "has", "have", "had", "be", "are",
]);

export function significantWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

// Overlap coefficient (intersection / smaller set size) rather than
// Jaccard — a short, punchy headline ("Salah hits hat-trick") should still
// count as a near-duplicate of a longer one that contains all the same
// words plus more color commentary, not get diluted by the longer title's
// extra word count.
export function isSimilarTitle(a: string, b: string, threshold = 0.5): boolean {
  const wa = significantWords(a);
  const wb = significantWords(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.min(wa.size, wb.size) >= threshold;
}

export function isSimilarToAny(title: string, others: string[], threshold = 0.5): boolean {
  return others.some((other) => isSimilarTitle(title, other, threshold));
}
