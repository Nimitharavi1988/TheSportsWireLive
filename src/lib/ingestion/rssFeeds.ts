import Parser from "rss-parser";
import type { RawMatchItem } from "./footballData";

const parser = new Parser();

const FEEDS: { url: string; category: string; sourceName: string }[] = [
  { url: "http://feeds.bbci.co.uk/sport/football/rss.xml", category: "football", sourceName: "BBC Sport" },
  { url: "http://feeds.bbci.co.uk/sport/cricket/rss.xml", category: "cricket", sourceName: "BBC Sport" },
  // Feed 11095 is Sky's football-only feed — confirmed by inspecting its
  // actual content (25/25 items football, no darts/golf/F1). The previously
  // used feed 12040 is a mixed all-sports feed, which combined with the
  // narrow "auto" keyword filter below was silently dropping real football
  // transfer news (e.g. Man City/Man Utd stories with no literal "football"
  // or "premier league" in the title).
  { url: "https://www.skysports.com/rss/11095", category: "football", sourceName: "Sky Sports" },
  { url: "http://www.espncricinfo.com/rss/content/story/feeds/0.xml", category: "cricket", sourceName: "ESPN Cricinfo" },
  { url: "https://www.theguardian.com/sport/cricket/rss", category: "cricket", sourceName: "The Guardian" },
  // ESPN's general soccer feed — broader global coverage than the UK-focused
  // feeds above, more likely to pick up MLS (Messi/Inter Miami) and Saudi
  // Pro League (Ronaldo/Al-Nassr) news, which football-data.org's structured
  // match data doesn't cover for either league (checked: football-data.org
  // has no Saudi Pro League at any pricing tier, and MLS only on a paid
  // tier) — a real coverage gap this at least partially closes for free.
  { url: "https://www.espn.com/espn/rss/soccer/news", category: "football", sourceName: "ESPN" },
];

export async function fetchRssNews(): Promise<RawMatchItem[]> {
  const items: RawMatchItem[] = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);

      for (const entry of parsed.items ?? []) {
        if (!entry.title || !entry.link) continue;

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
          category: feed.category,
          publishedAt: entry.isoDate ? new Date(entry.isoDate) : new Date(),
        });
      }
    } catch (err) {
      console.error(`RSS fetch failed for ${feed.url}:`, err);
    }
  }

  return items;
}