/**
 * ESPN Cricinfo publishes a dedicated RSS feed per player — confirmed live
 * (2026-09-12): https://www.cricinfo.com/rss/content/story/feeds/{id}.xml
 * returns real headlines, a real description (genuine editorial content,
 * not a repeated headline — unlike Google News' per-player search, see
 * playerNewsFeeds.ts), and a direct cricinfo.com article URL (no redirect
 * page to resolve). Same officially-syndicated feed family as the country
 * feeds already used in rssFeeds.ts (feeds/0.xml, feeds/6.xml).
 *
 * This is the primary source for tracked cricket players going forward —
 * Google News search (playerNewsFeeds.ts) stays in place as a
 * breadth-of-coverage fallback for players/stories Cricinfo doesn't carry,
 * but its links can't be resolved to real article text (Google's redirect
 * requires client-side JS), so it can never produce a real body the way
 * this feed can.
 */
import Parser from "rss-parser";
import { TRACKED_PLAYERS } from "../players";
import type { RawMatchItem } from "./footballData";

const parser = new Parser();
const SOURCE_NAME = "ESPN Cricinfo";

export function cricinfoPlayerFeedUrl(cricinfoPlayerId: number): string {
  return `https://www.cricinfo.com/rss/content/story/feeds/${cricinfoPlayerId}.xml`;
}

// A very active player's personal feed can carry a dozen+ recent items —
// capped the same as playerNewsFeeds.ts's Google News search, same
// reasoning (closing a coverage gap, not flooding the review queue with
// near-duplicate coverage of one event).
const MAX_ITEMS_PER_PLAYER = 5;

export async function fetchCricinfoPlayerNews(): Promise<RawMatchItem[]> {
  const items: RawMatchItem[] = [];
  const players = TRACKED_PLAYERS.filter(
    (p): p is typeof p & { cricinfoPlayerId: number } => p.sport === "cricket" && p.cricinfoPlayerId !== undefined
  );

  for (const player of players) {
    try {
      const feed = await parser.parseURL(cricinfoPlayerFeedUrl(player.cricinfoPlayerId));

      for (const entry of (feed.items ?? []).slice(0, MAX_ITEMS_PER_PLAYER)) {
        if (!entry.title || !entry.link) continue;

        items.push({
          title: entry.title,
          // Same "headline + attribution, no reproduced text" pattern as
          // every other RSS source — entry.contentSnippet is real content
          // here (unlike Google News), but it's still the publisher's own
          // prose, so it's carried through only as sourceSnippet (private
          // grounding for the Gemini rewrite in commentary.ts), never
          // shown as-is.
          summary: `Full coverage from ${SOURCE_NAME}. Read the original report at the source link below.`,
          sourceSnippet: entry.contentSnippet?.slice(0, 1200),
          sourceUrl: entry.link,
          sourceName: SOURCE_NAME,
          category: "cricket",
          publishedAt: entry.isoDate ? new Date(entry.isoDate) : new Date(),
          // We already know exactly who this is about — see
          // RawMatchItem.knownPersonName — for the real Wikimedia photo
          // lookup, same as playerNewsFeeds.ts.
          knownPersonName: player.name,
        });
      }
    } catch (err) {
      console.error(`Cricinfo player feed failed for "${player.name}" (${player.cricinfoPlayerId}):`, err);
    }
  }

  return items;
}
