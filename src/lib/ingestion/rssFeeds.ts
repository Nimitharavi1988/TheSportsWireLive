import Parser from "rss-parser";
import type { RawMatchItem } from "./footballData";
import { decodeHtmlEntities } from "../htmlEntities";

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

// Some publishers (ESPN Cricinfo's coverImages field in particular) still
// serve image URLs over plain http:// — loaded on our https:// pages, that's
// mixed content. Browsers auto-upgrade it, but it still logs a console
// warning and isn't guaranteed everywhere, so normalize at extraction time.
function toHttps(url: string): string {
  return url.startsWith("http://") ? `https://${url.slice(7)}` : url;
}

// BBC's own media:thumbnail is a small 240px-wide crop by default — the
// same source image is available at full resolution from the identical
// ichef.bbci.co.uk URL, just with a different width segment in the path
// (confirmed live: swapping /standard/240/ for /standard/976/ on a real
// article's image URL served an 11x larger file, genuinely higher
// resolution, not just a bigger byte size for the same pixels). Only
// rewrites BBC's own CDN URLs — leaves every other publisher's image
// exactly as given, since only ichef's URL shape is confirmed predictable
// this way.
function upscaleBbcImage(url: string): string {
  if (!url.includes("ichef.bbci.co.uk")) return url;
  return url.replace(/\/standard\/\d+\//, "/standard/976/");
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
      return { url: toHttps(url), credit: typeof credit === "string" ? credit.trim() : undefined };
    }
  }

  const thumbnailUrl: string | undefined = entry.mediaThumbnail?.$?.url;
  if (thumbnailUrl) return { url: toHttps(upscaleBbcImage(thumbnailUrl)) };

  if (typeof entry.coverImages === "string" && entry.coverImages.trim()) {
    return { url: toHttps(entry.coverImages.trim()) };
  }

  // Standard RSS 2.0 <enclosure> — a core field rss-parser already parses
  // without any customFields config (unlike the Media RSS extensions
  // above). Sky Sports uses this instead of media:thumbnail/media:content.
  const enclosureUrl: string | undefined =
    typeof entry.enclosure?.url === "string" && entry.enclosure.type?.startsWith("image")
      ? entry.enclosure.url
      : undefined;
  if (enclosureUrl) return { url: toHttps(enclosureUrl) };

  return null;
}

const FEEDS: { url: string; category: string; sourceName: string }[] = [
  // No structured race-data source exists on any free tier (confirmed live:
  // api-sports.io's Formula-1 API free plan rejects the current season
  // entirely — "try from 2022 to 2024"), so F1 is RSS-only editorial
  // content, same as this file's other sources, rather than the
  // RawMatchItem match-data pattern the other new sports use.
  { url: "https://www.autosport.com/rss/f1/news/", category: "formula-1", sourceName: "Autosport" },
  // Added 2026-09-20 (explicit request) after Autosport alone went ~33h
  // with no new item, which read as a real gap even though it wasn't an
  // ingestion bug (confirmed live by comparing the DB directly against
  // Autosport's own feed — every item present, feed itself just quiet).
  // Motorsport.com is a sister publication under the same Motorsport
  // Network as Autosport (identical feed shape, confirmed live), but
  // publishes independently and was meaningfully fresher when checked
  // (items from within the hour vs. Autosport's 33h-old latest) — a real,
  // different update cadence despite the shared parent company, not a
  // near-duplicate source. BBC Sport F1 adds a genuinely different
  // publisher/voice, same domain pattern already proven reliable for this
  // pipeline's football/cricket feeds below.
  { url: "https://www.motorsport.com/rss/f1/news/", category: "formula-1", sourceName: "Motorsport.com" },
  { url: "http://feeds.bbci.co.uk/sport/formula1/rss.xml", category: "formula-1", sourceName: "BBC Sport" },
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
  // Added specifically to close the "same repeated photo" gap for Indian
  // cricket player coverage: confirmed live (2026-09-12) that stories like
  // the Samson/Sooryavanshi selection debate are largely NOT covered by
  // Cricinfo's own editorial desk (their per-player feed hadn't published
  // anything about Samson in over two months, despite heavy coverage
  // elsewhere) — they're covered by outlets like this one instead. Direct
  // feed, real media:content images (1600x900, confirmed), real article
  // URLs — same legitimate syndication pattern as every other feed here,
  // and it sidesteps Google News search's unresolvable-redirect problem
  // entirely for whatever this outlet covers.
  { url: "https://www.hindustantimes.com/feeds/rss/cricket/rssfeed.xml", category: "cricket", sourceName: "Hindustan Times" },
  // Added 2026-09-23 (explicit request to increase real cricket volume,
  // specifically during Asia daytime hours) after confirming two real gaps:
  // CricketData.org's free-tier match API doesn't surface domestic/A-team
  // cricket (Ranji Trophy, India A, U19), and most of cricket's Google News
  // search volume was structurally unable to produce a real article body
  // (see runIngest.ts's resolveGrounding — those links can never be
  // extracted). Both feeds checked live: direct article URLs (not Google
  // News redirects), robots.txt allows crawling, and real extraction
  // succeeded at 2100-3000 chars on every sampled item, including genuine
  // domestic coverage (Ranji Trophy) and Asian Games content Google News
  // search alone was missing.
  { url: "https://timesofindia.indiatimes.com/rssfeeds/54829575.cms", category: "cricket", sourceName: "The Times of India" },
  { url: "https://www.wisden.com/feed", category: "cricket", sourceName: "Wisden" },
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
  // MLB/NBA editorial news (injuries, roster moves, storylines) — mlbData.ts/
  // nbaData.ts only ever provide game previews/results, no news coverage,
  // the exact same gap NFL originally had (see ESPN NFL feed comment above).
  // This is also what populates the homepage's "Also in the News" sidebar
  // for these categories — that module only ever draws from RSS-sourced
  // articles, so without a feed here it stayed completely empty for these
  // two categories even with real match-data content in the main column.
  // Confirmed live and working directly (2026-09-12).
  { url: "https://www.espn.com/espn/rss/mlb/news", category: "baseball", sourceName: "ESPN" },
  { url: "https://www.espn.com/espn/rss/nba/news", category: "basketball", sourceName: "ESPN" },
  // Hockey editorial news — same gap NFL/MLB/NBA originally had:
  // nhlData.ts only ever provides structured match data (scores/standings)
  // via ESPN's scoreboard API, no news coverage. Added 2026-09-20 — real
  // audience relevance for the confirmed Sweden secondary audience too,
  // since Swedish NHL players are frequent subjects in NHL editorial
  // coverage even without a dedicated Swedish Hockey League feed (checked;
  // no confirmed-working free SHL-specific source found). Confirmed live
  // and working directly (2026-09-20).
  { url: "https://www.espn.com/espn/rss/nhl/news", category: "hockey", sourceName: "ESPN" },
  // MLB/NBA/NHL news that actually publishes (added 2026-09-26). The ESPN
  // feeds above (and CBS's) were producing zero published stories: their
  // article pages can't be extracted, so commentary fails and every item
  // is rejected on its first run (7-day check: MLB 0 published, NBA 0,
  // NHL 0 — leaving those pages with no news and no hero at all). Yahoo's
  // NFL feed is the one US source that works end to end, and its MLB/NBA/
  // NHL feeds have the identical shape: ~50 items a day, short snippets
  // (<200 chars, so grounding extracts the page — which is where the photo
  // comes from, since these feeds carry none). Checked live on sampled
  // items: page text + a hero-quality photo extracted for MLB 3/3, NBA 2/3,
  // NHL 3/3. MLB.com is the league's own newsroom (~25 a day, no feed
  // description, page photo 3/3). The Guardian adds low-volume (a few a
  // week) but well-photographed features, with photos in the feed itself.
  { url: "https://www.mlb.com/feeds/news/rss.xml", category: "baseball", sourceName: "MLB.com" },
  { url: "https://sports.yahoo.com/mlb/rss/", category: "baseball", sourceName: "Yahoo Sports" },
  { url: "https://sports.yahoo.com/nba/rss/", category: "basketball", sourceName: "Yahoo Sports" },
  { url: "https://sports.yahoo.com/nhl/rss/", category: "hockey", sourceName: "Yahoo Sports" },
  { url: "https://www.theguardian.com/sport/mlb/rss", category: "baseball", sourceName: "The Guardian" },
  { url: "https://www.theguardian.com/sport/nba/rss", category: "basketball", sourceName: "The Guardian" },
  { url: "https://www.theguardian.com/sport/nhl/rss", category: "hockey", sourceName: "The Guardian" },
  // Volleyball had match results only (espnVolleyballData.ts/
  // volleyballData.ts), no news. Checked live 2026-09-26 (Volleyball
  // World's own feeds 404): Volleyball Magazine (~1/day), FIVB — the
  // international federation (~10/week), NCAA.com D1 women's (~4/week, the
  // same college game the ESPN scores cover). None carry images in the
  // feed; the page photo is extracted during grounding (runIngest.ts),
  // found on 2-3 of 3 sampled items per feed.
  { url: "https://volleyballmag.com/feed/", category: "volleyball", sourceName: "Volleyball Magazine" },
  { url: "https://www.fivb.com/feed/", category: "volleyball", sourceName: "FIVB" },
  { url: "https://www.ncaa.com/news/volleyball-women/d1/rss.xml", category: "volleyball", sourceName: "NCAA.com" },
  // College football and WNBA news (added 2026-09-26 with the sections
  // themselves) — same Yahoo feed shape as NFL/MLB/NBA/NHL above. Checked
  // live: 50 items in the last 24h each; sampled pages readable 3/3, with a
  // hero-quality photo on WNBA 3/3 and college football 1/3 (the rest keep
  // the team-crest/stock fallback like any photo-less item).
  { url: "https://sports.yahoo.com/college-football/rss/", category: "college-football", sourceName: "Yahoo Sports" },
  { url: "https://sports.yahoo.com/wnba/rss/", category: "wnba", sourceName: "Yahoo Sports" },
  // Athletics/track and field — news-only section (no structured match-data
  // source exists the way football-data.org/CricketData.org/ESPN NFL do for
  // the others; athletics is start-list/results based, not "matches"), per
  // explicit request. Confirmed live and working directly (2026-09-12) —
  // real current items (e.g. Ingebrigtsen/Kerr 1500m), real media:thumbnail
  // images.
  { url: "https://feeds.bbci.co.uk/sport/athletics/rss.xml", category: "athletics", sourceName: "BBC Sport" },
  // Second athletics source — BBC alone was too thin (only 6 published
  // items even after several days), most of which get consumed by the
  // hero carousel/highlight picks before "Also in the News" has anything
  // left. Confirmed live and working directly (2026-09-13): real current
  // items (Ultimate Championship coverage), no native RSS image tags (no
  // media:thumbnail/content/enclosure) — falls back to og:image extraction
  // during commentary grounding, same as any other image-less feed.
  { url: "https://athleticsweekly.com/feed/", category: "athletics", sourceName: "Athletics Weekly" },
  // Third athletics source — ESPN's Olympic-sports desk, added 2026-09-20
  // (explicit request for multi-sport-games coverage like the Asian Games).
  // Confirmed live: current items (Sept 18-20 2026), and its very first
  // item on check was real Asian Games coverage. Deliberately picked ESPN's
  // own take on these games over a foreign wire/official source — this
  // site's confirmed real audience is US-majority, so a US outlet's
  // framing of an event like the Asian Games is a better fit than a
  // dedicated Asian-Games-specific feed would be. Broader than pure track
  // and field (Olympic sports generally), but "athletics" is the closest
  // existing category and every other athletics source here is already
  // similarly broad (start-list/results news, not a fixed sport list).
  { url: "https://www.espn.com/espn/rss/oly/news", category: "athletics", sourceName: "ESPN" },
  // Rugby — news-only, same reasoning as Athletics: no single clean
  // structured-data source exists. Specifically no ESPN scoreboard-style
  // endpoint either, unlike NBA/MLB/NFL — rugby is fragmented across many
  // separate competitions (Six Nations, Rugby Championship, Premiership,
  // Top 14, World Cup...), each its own ESPN tournament ID with no unified
  // "rugby" feed, and most are out of season most of the year (checked:
  // Six Nations' own endpoint returns its already-finished Jan-Mar season,
  // nothing current in September). Confirmed live and working directly
  // (2026-09-12).
  { url: "https://feeds.bbci.co.uk/sport/rugby-union/rss.xml", category: "rugby", sourceName: "BBC Sport" },
];

export async function fetchRssNews(): Promise<RawMatchItem[]> {
  const items: RawMatchItem[] = [];

  for (const feed of FEEDS) {
    // Per-feed item count, logged unconditionally (not just on error) —
    // added 2026-09-23 after discovering the ESPN Olympic-sports feed
    // (sourceName "ESPN", category "athletics") had silently produced
    // zero articles for 3 full days despite the feed itself being live,
    // current, and passing every check when tested directly (real items,
    // real snippets, no dedupe collisions, not excluded). The existing
    // catch block below only logs when parseURL itself throws — it can't
    // explain a feed that "succeeds" from outside this exact runtime (this
    // repo's own dev machine, this sandbox) but silently returns nothing,
    // times out, or gets rate-limited/blocked specifically from GitHub
    // Actions' shared IP range in production, which is the leading
    // suspect here and can't be confirmed without this line existing in
    // the actual run logs. A one-line count per feed, every run, is cheap
    // and makes a repeat of this exact 3-day blind spot impossible.
    const startCount = items.length;
    try {
      const parsed = await parser.parseURL(feed.url);

      for (const entry of parsed.items ?? []) {
        if (!entry.title || !entry.link) continue;

        const image = extractRssImage(entry);

        items.push({
          // Decoded: some feeds (Yahoo Sports) encode titles twice — see htmlEntities.ts.
          title: decodeHtmlEntities(entry.title),
          // Deliberately NOT reusing entry.contentSnippet (the source's own
          // article text) as our summary — that would republish the
          // publisher's copyrighted prose as if it were our own content.
          // Standard aggregator pattern instead: headline + attribution +
          // link out to the original for the full story.
          summary: `Full coverage from ${feed.sourceName}. Read the original report at the source link below.`,
          // Carried through the pipeline only as grounding input for the
          // optional LLM commentary step (commentary.ts) — never stored or
          // displayed as-is, so it never republishes the source's own prose.
          sourceSnippet: entry.contentSnippet ? decodeHtmlEntities(entry.contentSnippet).slice(0, 1200) : undefined,
          sourceUrl: entry.link,
          sourceName: feed.sourceName,
          category: feed.category,
          publishedAt: entry.isoDate ? new Date(entry.isoDate) : new Date(),
          heroImageUrl: image?.url,
          heroImageCredit: image?.credit,
          // Stable dedupe key, same mechanism match-data sources already
          // use (see footballData.ts) — confirmed live that a live-
          // updating blog post (same URL, headline changing as the story
          // develops) was creating a fresh duplicate article every time
          // its title changed, since the title+day-bucket hash
          // (dedupe.ts's computeDedupeHash, the fallback when no
          // dedupeKey is set) has no way to recognize it as the same
          // underlying story. The URL itself doesn't change.
          dedupeKey: entry.link,
        });
      }
      console.log(`[rssFeeds] ${feed.sourceName} (${feed.category}, ${feed.url}): ${items.length - startCount} items`);
    } catch (err) {
      console.error(`RSS fetch failed for ${feed.url}:`, err);
    }
  }

  return items;
}