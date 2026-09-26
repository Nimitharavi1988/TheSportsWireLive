/**
 * Which videos the Videos strip shows (pure, unit-tested). Same freshness
 * rule as the news sections — nothing older than a few days — and at most
 * a few per channel, so one busy channel (Sky Sports posts dozens a day)
 * can't fill the whole strip. Highlights go first: they're what a reader
 * came for after a game.
 */
export const VIDEO_FRESH_MS = 3 * 24 * 60 * 60 * 1000;
// The /videos page is the library: a couple of weeks, so a reader can
// still find last weekend's highlights.
export const VIDEO_PAGE_FRESH_MS = 14 * 24 * 60 * 60 * 1000;

// /videos page layout: split into Match Highlights and Latest, and where
// the in-feed ads go in its grid — after every AD_EVERY cards, which is
// every 2 rows at the 3-column desktop width (AdSense in-feed units belong
// between content items, never over a player).
export const AD_EVERY = 6;

export function splitLibrary<T extends { isHighlights: boolean }>(videos: T[]): { featured: T | null; highlights: T[]; latest: T[] } {
  const featured = videos.find((v) => v.isHighlights) ?? videos[0] ?? null;
  const rest = videos.filter((v) => v !== featured);
  return { featured, highlights: rest.filter((v) => v.isHighlights), latest: rest.filter((v) => !v.isHighlights) };
}

// Cards with ad slots interleaved: ["card", "card", ..., "ad", ...]. Never
// ends on an ad, and a short list gets none.
export function withAdSlots<T>(items: T[], every: number = AD_EVERY): ({ kind: "video"; item: T } | { kind: "ad"; index: number })[] {
  const out: ({ kind: "video"; item: T } | { kind: "ad"; index: number })[] = [];
  items.forEach((item, i) => {
    out.push({ kind: "video", item });
    if ((i + 1) % every === 0 && i + 1 < items.length) out.push({ kind: "ad", index: (i + 1) / every });
  });
  return out;
}
export const MAX_PER_CHANNEL = 3;

export function pickVideoStrip<T extends { channelTitle: string; publishedAt: Date; isHighlights: boolean }>(rows: T[], limit: number): T[] {
  const sorted = [...rows].sort(
    (a, b) => Number(b.isHighlights) - Number(a.isHighlights) || b.publishedAt.getTime() - a.publishedAt.getTime()
  );
  const perChannel = new Map<string, number>();
  const picked: T[] = [];
  for (const row of sorted) {
    const count = perChannel.get(row.channelTitle) ?? 0;
    if (count >= MAX_PER_CHANNEL) continue;
    perChannel.set(row.channelTitle, count + 1);
    picked.push(row);
    if (picked.length === limit) break;
  }
  return picked;
}
