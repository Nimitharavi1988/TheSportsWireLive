import Parser from "rss-parser";
import { TRACKED_PLAYERS } from "../players";
import type { RawMatchItem } from "./footballData";

// Google News' public, no-key RSS search endpoint — returns real headlines
// from hundreds of publishers matching a query, not just our fixed feed
// list. Same copyright-safe usage as every other RSS source on the site:
// headline + short snippet (grounding input only, never displayed/stored
// as-is) + link-out, never full article text. Built specifically to close
// the gap where a tracked player's name simply never appears in whichever
// handful of stories our 8 fixed feeds happen to be carrying right now
// (confirmed directly for Sanju Samson: zero mentions across all 4 cricket
// feeds at the time this was built).
const parser = new Parser({
  customFields: {
    item: [["source", "sourceTag"]],
  },
});

export function googleNewsSearchUrl(name: string): string {
  // when:3d matches the site's existing MAX_RSS_ITEM_AGE_MS staleness
  // window (runIngest.ts) — avoids fetching/parsing old matches we'd just
  // discard anyway.
  const query = `"${name}" when:3d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

// Google News titles are suffixed with " - {Publisher}" and the <source>
// tag already carries that same publisher name structurally — stripped so
// the displayed title matches every other source's plain-headline style
// instead of showing the publisher's name twice.
export function stripPublisherSuffix(title: string, publisher: string | undefined): string {
  if (!publisher) return title;
  const suffix = ` - ${publisher}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

export function extractPublisher(entry: any): string | undefined {
  const tag = entry.sourceTag;
  const name = typeof tag === "string" ? tag : tag?._;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
}

// A popular player can return up to ~100 matches, with the same real-world
// event (e.g. a big transfer) independently covered by five-plus outlets at
// once (confirmed directly: Messi's Eldense purchase alone had ESPN, NYT,
// Yahoo, MLSsoccer.com and Al Jazeera all in the first 5 results). Capping
// per player keeps this closing the real gap it was built for — a player
// with zero coverage getting some — without flooding the review queue with
// near-duplicate coverage of the same single event for every popular name.
const MAX_ITEMS_PER_PLAYER = 5;

export async function fetchPlayerNews(): Promise<RawMatchItem[]> {
  const items: RawMatchItem[] = [];

  for (const player of TRACKED_PLAYERS) {
    try {
      const feed = await parser.parseURL(googleNewsSearchUrl(player.name));

      for (const entry of (feed.items ?? []).slice(0, MAX_ITEMS_PER_PLAYER)) {
        if (!entry.title || !entry.link) continue;

        const publisher = extractPublisher(entry);
        const sourceName = publisher ?? "Google News";

        items.push({
          title: stripPublisherSuffix(entry.title, publisher),
          // Same "headline + attribution, no reproduced text" pattern as
          // every other RSS source (rssFeeds.ts) — see its comment for why.
          summary: `Full coverage from ${sourceName}. Read the original report at the source link below.`,
          sourceSnippet: entry.contentSnippet?.slice(0, 1200),
          sourceUrl: entry.link,
          sourceName,
          category: player.sport,
          publishedAt: entry.isoDate ? new Date(entry.isoDate) : new Date(),
        });
      }
    } catch (err) {
      console.error(`Google News search failed for "${player.name}":`, err);
    }
  }

  return items;
}
