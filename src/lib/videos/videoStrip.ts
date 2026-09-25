/**
 * Which videos the Videos strip shows (pure, unit-tested). Same freshness
 * rule as the news sections — nothing older than a few days — and at most
 * a few per channel, so one busy channel (Sky Sports posts dozens a day)
 * can't fill the whole strip. Highlights go first: they're what a reader
 * came for after a game.
 */
export const VIDEO_FRESH_MS = 3 * 24 * 60 * 60 * 1000;
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
