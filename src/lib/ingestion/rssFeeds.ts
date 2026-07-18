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
          summary: entry.contentSnippet?.slice(0, 400) || entry.title,
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