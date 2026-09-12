import Parser from "rss-parser";
import type { RawMatchItem } from "./footballData";

// Each publisher includes a real, story-specific photo directly in their own
// RSS feed — media:thumbnail (BBC) or media:content, sometimes with a
// nested media:credit (Guardian), sometimes as a plain <coverImages> string
// (ESPN Cricinfo). This is the RSS spec's own mechanism for exactly this —
// letting an aggregator show a preview image next to the headline — so it's
// extracted the same way the headline/link/date already are: displayed with
// credit and a link back to the original, never re-hosted as if it were our
// own photography. Confirmed via raw feed inspection, not assumed.
const parser = new Parser({
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail"],
      ["media:content", "mediaContent", { keepArray: true }],
      ["coverImages", "coverImages"],
    ],
  },
});

interface RssImage {
  url: string;
  credit?: string;
}

function firstOrOnly<T>(value: T | T[] | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

// media:content can appear once (ESPN Cricinfo) or multiple times as
// different size variants of the same photo (Guardian) — when there are
// several, the largest is the best fit for a hero-style display.
export function extractRssImage(entry: any): RssImage | null {
  const contents: any[] = Array.isArray(entry.mediaContent)
    ? entry.mediaContent
    : entry.mediaContent
      ? [entry.mediaContent]
      : [];

  if (contents.length > 0) {
    const largest = contents.reduce((best, c) => {
      const width = Number(c?.$?.width) || 0;
      const bestWidth = Number(best?.$?.width) || 0;
      return width > bestWidth ? c : best;
    });
    const url: string | undefined = largest?.$?.url;
    if (url) {
      const credit = firstOrOnly(largest["media:credit"])?._;
      return { url, credit: typeof credit === "string" ? credit.trim() : undefined };
    }
  }

  const thumbnailUrl: string | undefined = entry.mediaThumbnail?.$?.url;
  if (thumbnailUrl) return { url: thumbnailUrl };

  if (typeof entry.coverImages === "string" && entry.coverImages.trim()) {
    return { url: entry.coverImages.trim() };
  }

  // Standard RSS 2.0 <enclosure> — a core field rss-parser already parses
  // without any customFields config (unlike the Media RSS extensions
  // above). Sky Sports uses this instead of media:thumbnail/media:content.
  const enclosureUrl: string | undefined =
    typeof entry.enclosure?.url === "string" && entry.enclosure.type?.startsWith("image")
      ? entry.enclosure.url
      : undefined;
  if (enclosureUrl) return { url: enclosureUrl };

  return null;
}

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
  // Cricinfo's India-specific country feed — overlaps with the general
  // cricket feed above for stories that make the global cut (the existing
  // title+publishedAt dedupe handles that safely), but surfaces a lot of
  // India-specific coverage (domestic cricket, IPL-adjacent news, player
  // stories) that doesn't make the global feed's limited item count.
  // Confirmed live and working directly (2026-09-10) — the country feed
  // numbering is Cricinfo's own (6 = India), not something documented
  // publicly beyond their RSS index page.
  { url: "https://www.cricinfo.com/rss/content/story/feeds/6.xml", category: "cricket", sourceName: "ESPN Cricinfo" },
  { url: "https://www.theguardian.com/sport/cricket/rss", category: "cricket", sourceName: "The Guardian" },
  // ESPN's general soccer feed — broader global coverage than the UK-focused
  // feeds above, more likely to pick up MLS (Messi/Inter Miami) and Saudi
  // Pro League (Ronaldo/Al-Nassr) news, which football-data.org's structured
  // match data doesn't cover for either league (checked: football-data.org
  // has no Saudi Pro League at any pricing tier, and MLS only on a paid
  // tier) — a real coverage gap this at least partially closes for free.
  { url: "https://www.espn.com/espn/rss/soccer/news", category: "football", sourceName: "ESPN" },
  // NFL editorial news (injuries, roster moves, storylines) — the American
  // football section previously had only nflData.ts's game previews/results,
  // no news coverage at all, unlike football and cricket which both have
  // structured match data AND RSS news side by side. Confirmed live and
  // working directly (2026-09-10).
  { url: "https://www.espn.com/espn/rss/nfl/news", category: "american-football", sourceName: "ESPN" },
  // NFL previously had only this one feed (vs football's 3 / cricket's 4) —
  // confirmed real, thin coverage as a result. Both checked live and
  // working directly (2026-09-11).
  { url: "https://www.cbssports.com/rss/headlines/nfl/", category: "american-football", sourceName: "CBS Sports" },
  // Yahoo's feed embeds its image inside <content:encoded> as an <img> tag
  // rather than media:thumbnail/media:content/enclosure like every other
  // feed here — extractRssImage doesn't parse that, so these items fall
  // back to the category stock photo. Not worth a bespoke HTML-parsing path
  // for one feed; same stock-photo fallback plenty of other items already
  // use.
  { url: "https://sports.yahoo.com/nfl/rss/", category: "american-football", sourceName: "Yahoo Sports" },
];

export async function fetchRssNews(): Promise<RawMatchItem[]> {
  const items: RawMatchItem[] = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);

      for (const entry of parsed.items ?? []) {
        if (!entry.title || !entry.link) continue;

        const image = extractRssImage(entry);

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
          heroImageUrl: image?.url,
          heroImageCredit: image?.credit,
        });
      }
    } catch (err) {
      console.error(`RSS fetch failed for ${feed.url}:`, err);
    }
  }

  return items;
}