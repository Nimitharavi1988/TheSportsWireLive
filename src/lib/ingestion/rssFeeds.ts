import Parser from "rss-parser";
import type { RawMatchItem } from "./footballData";

const parser = new Parser();

const FEEDS: { url: string; category: string; sourceName: string }[] = [
  { url: "http://feeds.bbci.co.uk/sport/football/rss.xml", category: "football", sourceName: "BBC Sport" },
  { url: "http://feeds.bbci.co.uk/sport/cricket/rss.xml", category: "cricket", sourceName: "BBC Sport" },
  { url: "https://www.skysports.com/rss/12040", category: "auto", sourceName: "Sky Sports" },
  { url: "http://www.espncricinfo.com/rss/content/story/feeds/0.xml", category: "cricket", sourceName: "ESPN Cricinfo" },
  { url: "https://www.theguardian.com/sport/cricket/rss", category: "cricket", sourceName: "The Guardian" },
];

export async function fetchRssNews(): Promise<RawMatchItem[]> {
  const items: RawMatchItem[] = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);

      for (const entry of parsed.items ?? []) {
        if (!entry.title || !entry.link) continue;

        let category = feed.category;
        if (category === "auto") {
          const lower = entry.title.toLowerCase();
          if (lower.includes("cricket")) category = "cricket";
          else if (lower.includes("football") || lower.includes("premier league") || lower.includes("champions league")) category = "football";
          else continue;
        }

        items.push({
          title: entry.title,
          // Deliberately NOT reusing entry.contentSnippet (the source's own
          // article text) as our summary — that would republish the
          // publisher's copyrighted prose as if it were our own content.
          // Standard aggregator pattern instead: headline + attribution +
          // link out to the original for the full story.
          summary: `Full coverage from ${feed.sourceName}. Read the original report at the source link below.`,
          // Carried through the pipeline only as grounding input for the
          // optional LLM commentary step (commentary.ts) — never stored or
          // displayed as-is, so it never republishes the source's own prose.
          sourceSnippet: entry.contentSnippet?.slice(0, 1200),
          sourceUrl: entry.link,
          sourceName: feed.sourceName,
          category,
          publishedAt: entry.isoDate ? new Date(entry.isoDate) : new Date(),
        });
      }
    } catch (err) {
      console.error(`RSS fetch failed for ${feed.url}:`, err);
    }
  }

  return items;
}