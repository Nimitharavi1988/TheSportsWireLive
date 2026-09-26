import { AnalysisStrip } from "@/components/AnalysisStrip";
import { TeamCrest } from "@/components/TeamCrest";
import { CATEGORY_META } from "@/lib/categoryMeta";
import { Suspense } from "react";
import { db } from "@/db";
import { article as articleTable } from "@/db/schema";
import { and, eq, like, isNotNull, isNull, ne, or, desc, gte, type SQL } from "drizzle-orm";
import { ForYouStrip } from "@/components/ForYouStrip";
import { HappeningNow } from "@/components/HappeningNow";
import { LatestVideos, VideoStripSkeleton } from "@/components/videos/VideoStrip";
import { happeningNowEntities } from "@/lib/competitions";
import { getMedalLeaderLines } from "@/lib/events/queries";
import { isMatchDataSource } from "@/lib/matchDataSources";
import { hasRealImage } from "@/lib/contentQuality";
import { isHeroQualityImage } from "@/lib/imageQuality";
import Link from "next/link";
import Image from "next/image";
import { ScrollRow } from "@/components/ScrollRow";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import { fetchOneStockImage } from "@/lib/ingestion/stockImages";
import { fetchStandingsTable, STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import type { NflConferenceStandings } from "@/lib/ingestion/nflData";
import { SNAPSHOT_KEYS, readSnapshot } from "@/lib/snapshots/read";
import { NflStandingsCarousel } from "@/components/NflStandingsCarousel";
import type { NbaConferenceStandings } from "@/lib/ingestion/nbaData";
import { NbaStandingsCarousel } from "@/components/NbaStandingsCarousel";
import type { MlbConferenceStandings } from "@/lib/ingestion/mlbData";
import { MlbStandingsCarousel } from "@/components/MlbStandingsCarousel";
import type { NhlConferenceStandings } from "@/lib/ingestion/nhlData";
import { NhlStandingsCarousel } from "@/components/NhlStandingsCarousel";
import { crestAltText, competitionFromSummary } from "@/lib/teamNames";
import { displaySummary } from "@/lib/articleSummary";
import { relativeTime } from "@/lib/relativeTime";
import { isHighlightWorthy } from "@/lib/highlightWorthy";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { StandingsCarousel } from "@/components/StandingsCarousel";
import { TRACKED_PLAYERS, type TrackedPlayer } from "@/lib/players";
import { PLAYER_QUOTES } from "@/lib/quotes";
import { QuotesStrip } from "@/components/QuotesStrip";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ArticleThumb } from "@/components/ArticleThumb";
import { fetchPersonPhoto, sportSearchHint } from "@/lib/ingestion/wikimediaImages";
import {
  isHeroFeatureStale,
  isHighlightStale,
  HIGHLIGHT_MAX_AGE_DAYS,
  FRESH_NEWS_WINDOWS_DAYS,
  FRESH_NEWS_MIN_RESULTS,
} from "@/lib/heroConfig";
import { SentimentLeaderboard } from "@/components/SentimentLeaderboard";
import { MobileScoresRow } from "@/components/scores/MobileScoresRow";
import { CollapsibleAdBox } from "@/components/CollapsibleAdBox";
import { MoreHeadlinesAdTile } from "@/components/MoreHeadlinesAdTile";
import { HomeBanners } from "@/components/HomeBanners";
import { fetchLiveNow } from "@/lib/scores/scoreboard";
import { playerInitials, playerAvatarColor } from "@/lib/playerAvatar";
import StarIcon from "@mui/icons-material/Star";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArticleIcon from "@mui/icons-material/Article";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";

// Main-column section headers (Player News, Transfers & Big News, etc.) were
// using the theme's default h5 styling — Poppins, near-black — while the
// left rail's headers (By Category, Just In) use Inter and a muted gray.
// Standardizing the main column on the sidebar's font/color per user
// feedback, while keeping the larger h5 size so these still read as the
// primary section dividers they are. fontWeight explicitly dialed back
// from the inherited theme h5 weight (700, tuned for Poppins) to 600 —
// Inter's bold cut reads visibly heavier than Poppins bold at the same
// numeric weight, so switching font family alone (without this) made these
// headers look bolder than every other heading on the page even though the
// CSS weight number was identical.
const SECTION_HEADING_SX = { fontFamily: "var(--font-body)", color: "text.secondary", fontWeight: 600 };


// Was a hardcoded allowlist of RSS source names — confirmed live (twice
// now) that this drifts stale every time a new RSS feed or player-news
// source is added: CBS Sports/Yahoo Sports/Hindustan Times (real editorial
// RSS feeds) and every dynamic Google News player-news source name were
// all missing, so those articles were silently miscategorized as "match
// data" and never reached "Also in the News" — confirmed live for NFL
// (CBS Sports/Yahoo Sports specifically). isMatchDataSource is the
// actively-maintained single source of truth for the opposite
// classification (matchDataSources.ts) — inverting it here means a new
// structured-data source only ever needs adding in one place, and every
// genuine editorial article (any source, RSS feed or player-news) is
// correctly treated as "brief" content by default.



export function homeMetadata(category?: string) {
  const meta = category ? CATEGORY_META[category] : undefined;
  // alternates replaces (not merges with) the root layout's alternates —
  // including its RSS feed `types` entry — so it has to be repeated here
  // rather than relying on the layout default to survive.
  const rssTypes = { types: { "application/rss+xml": "/feed.xml" } };
  if (!meta) return { alternates: { canonical: "/", ...rssTypes } };
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/sport/${category}`, ...rssTypes },
    openGraph: { title: meta.title, description: meta.description },
    twitter: { title: meta.title, description: meta.description },
  };
}

// Streamed independently of the rest of the page (see the Suspense
// boundary around this in HomePage) — the real fix for "load part by
// part": this section's data (real Wikimedia photos, multi-step lookups
// per player) was confirmed the slowest of the page's external calls, so
// isolating it means the rest of the page no longer waits on it.
async function PlayerNewsSection({
  playerNewsMatches,
}: {
  playerNewsMatches: { player: TrackedPlayer; article: { slug: string; title: string }; articleIndex: number }[];
}) {
  const playerNewsPhotos = await Promise.all(
    playerNewsMatches.map((entry) => fetchPersonPhoto(entry.player.name, sportSearchHint(entry.player.sport)))
  );
  const playerNews = playerNewsMatches.map((entry, i) => ({ ...entry, photo: playerNewsPhotos[i] }));

  if (playerNews.length === 0) return null;

  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
        <StarIcon sx={{ fontSize: 20, color: "primary.main" }} />
        <Typography variant="h5" sx={SECTION_HEADING_SX}>Player News</Typography>
      </Stack>
      <ScrollRow>
        {playerNews.map(({ player, article, photo }) => (
          <Paper
            key={player.slug}
            variant="outlined"
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              p: 1.5,
              width: 176,
              flexShrink: 0,
            }}
          >
            {/* Avatar/name link to the player's own dedicated page,
                headline links to the specific article — two
                different destinations, so can't be one wrapping
                <Link> (invalid nested <a> tags). This is also the
                only real navigable entry point into /player/[slug]
                anywhere on the site — it's in the sitemap for SEO,
                but had no clickable path to it in the UI at all
                before this. */}
            <Link
              href={`/player/${player.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  "&:hover": { color: "primary.main" },
                }}
              >
                {photo ? (
                  <Box
                    component={Image}
                    src={photo.url}
                    alt={player.name}
                    width={32}
                    height={32}
                    sx={{ borderRadius: "50%", objectFit: "cover", objectPosition: "top", flexShrink: 0 }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: playerAvatarColor(player.name),
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {playerInitials(player.name)}
                  </Box>
                )}
                <Typography variant="caption" noWrap sx={{ fontWeight: 700 }}>
                  {player.name}
                </Typography>
              </Stack>
            </Link>
            <Link
              href={`/article/${article.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontSize: 12.5,
                  lineHeight: 1.35,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  "&:hover": { color: "primary.main" },
                }}
              >
                {article.title}
              </Typography>
            </Link>
          </Paper>
        ))}
      </ScrollRow>
    </Box>
  );
}

// Lightweight placeholder matching PlayerNewsSection's approximate shape —
// shown while the Wikipedia photo lookups above are still in flight, so
// the layout doesn't jump once the real section streams in.
function PlayerNewsSkeleton() {
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
        <StarIcon sx={{ fontSize: 20, color: "primary.main" }} />
        <Typography variant="h5" sx={SECTION_HEADING_SX}>Player News</Typography>
      </Stack>
      <ScrollRow>
        {[...Array(4)].map((_, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 1.5, width: 176, flexShrink: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: "action.hover" }} />
              <Box sx={{ width: 80, height: 12, borderRadius: 0.5, bgcolor: "action.hover" }} />
            </Stack>
            <Box sx={{ width: "100%", height: 36, borderRadius: 0.5, bgcolor: "action.hover" }} />
          </Paper>
        ))}
      </ScrollRow>
    </Box>
  );
}

// Streamed independently (see Suspense boundary in HomePage) — a real
// football-data.org round-trip, one of the slowest of the page's external
// calls alongside Player News, confirmed live.
async function FootballStandingsWidget({ apiKey }: { apiKey: string }) {
  const standings = await fetchStandingsTable(apiKey, "PL");
  if (!standings || standings.rows.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <StandingsCarousel leagues={STANDINGS_LEAGUES} initialCode="PL" initialTable={standings} />
    </Box>
  );
}

// Streamed independently (see Suspense boundary in HomePage) — same
// reasoning as FootballStandingsWidget, ESPN instead of football-data.org.
async function NflStandingsWidget() {
  const nflStandings = await readSnapshot<NflConferenceStandings[]>(SNAPSHOT_KEYS.nflStandings);
  if (!nflStandings || nflStandings.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <NflStandingsCarousel conferences={nflStandings} />
    </Box>
  );
}

// Same streaming/null-check pattern as NflStandingsWidget above — added
// 2026-09-20 to close the empty sidebar slot that basketball/baseball/
// hockey category views previously had (only football and NFL had a
// standings widget before this).
async function NbaStandingsWidget() {
  const nbaStandings = await readSnapshot<NbaConferenceStandings[]>(SNAPSHOT_KEYS.nbaStandings);
  if (!nbaStandings || nbaStandings.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <NbaStandingsCarousel conferences={nbaStandings} />
    </Box>
  );
}

async function MlbStandingsWidget() {
  const mlbStandings = await readSnapshot<MlbConferenceStandings[]>(SNAPSHOT_KEYS.mlbStandings);
  if (!mlbStandings || mlbStandings.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <MlbStandingsCarousel conferences={mlbStandings} />
    </Box>
  );
}

async function NhlStandingsWidget() {
  const nhlStandings = await readSnapshot<NhlConferenceStandings[]>(SNAPSHOT_KEYS.nhlStandings);
  if (!nhlStandings || nhlStandings.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <NhlStandingsCarousel conferences={nhlStandings} />
    </Box>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The homepage's main trending list (top 80 by trendingScore), limited to
// recent stories: the first window in FRESH_NEWS_WINDOWS_DAYS (24h) that
// yields enough stories, widening step by step on a quiet sport page (see
// heroConfig.ts). Every section built from `articles` inherits the limit.
async function fetchFreshRanked(baseConditions: SQL[]) {
  const query = (days: number) =>
    db.select().from(articleTable)
      .where(and(...baseConditions, gte(articleTable.publishedAt, new Date(Date.now() - days * DAY_MS))))
      .orderBy(desc(articleTable.trendingScore), desc(articleTable.publishedAt))
      .limit(80);
  let rows: Awaited<ReturnType<typeof query>> = [];
  for (const days of FRESH_NEWS_WINDOWS_DAYS) {
    rows = await query(days);
    if (rows.length >= FRESH_NEWS_MIN_RESULTS) break;
  }
  return rows;
}

// The homepage for all sports (category undefined) or one sport section.
// Rendered by src/app/page.tsx and src/app/sport/[...category]/page.tsx.
export async function HomeView({ category }: { category?: string }) {

  const baseConditions = [
    eq(articleTable.status, "published"),
    ...(category ? [like(articleTable.category, `${category}%`)] : []),
  ];

  // Fetched as two separate queries and merged, rather than relying on the
  // trending-sorted query alone to happen to include them: an admin's
  // manual "Feature as hero" pick is an explicit override of the automatic
  // ranking, and a low-trending pick (a niche county cricket story, say)
  // can genuinely fall outside the top-80-by-trendingScore cutoff below —
  // especially now that the per-player Google News search can add
  // hundreds of new candidates in a single run. Without this, a real admin
  // decision was silently getting overridden by a score cutoff instead of
  // actually taking priority. Capped at 5 (the same cap `featureArticle`
  // itself enforces), so this can never balloon the query.
  const [articlesRanked, manuallyFeaturedRaw, liveMatches, activeCompetitions, medalLines, justInRaw, highlightCandidatesRaw, matchCandidatesRaw] = await Promise.all([
    // Main trending list, limited to fresh stories — see heroConfig.ts's
    // FRESH_NEWS_* for why (trendingScore never decays: on 2026-09-25 an
    // 11-day-old story with score 175 was still leading the hero).
    fetchFreshRanked(baseConditions),
    db.select().from(articleTable)
      .where(and(...baseConditions, eq(articleTable.featured, true)))
      .orderBy(desc(articleTable.featuredAt))
      .limit(5),
    // Cross-sport "Live Now" widget (liveMatches.ts) — standardized
    // 2026-09-18 across every match-data sport, not just cricket (which
    // used to be the only one with live/finished/upcoming badges and
    // related-news links at all). Scoped to the current category filter —
    // showing NFL scores while browsing a Cricket-only view would read as
    // wrong/out of place, same rule /scores follows for its own in-progress
    // section — and to "All" when no filter is set. Now the standard
    // scoreboard (src/lib/scores/) — same cards and live rules as /scores.
    fetchLiveNow({ take: 30, sport: category?.split("/")[0] }),
    // Competitions being played now (competitions.ts isHappeningNow) for the
    // "Happening now" row under the hero. Replaced a single "most recent
    // cricket series" banner that could only show one of several series/
    // events running at once. A sport filter narrows it to that sport's
    // competitions (multi-sport events like the Asian Games only show on
    // "All"). No permanent nav item per competition: each runs for a couple
    // of weeks then goes quiet; /series lists them all.
    happeningNowEntities(8, category),
    getMedalLeaderLines().catch(() => ({})),
    // Independent pure-recency query for "Just In" below — deriving this
    // from `articlesRanked` (trending-sorted, LIMIT 80) instead used to
    // silently cap "newest" at whatever happened to also be inside that
    // trending-limited pool: confirmed live, a brand-new article with no
    // trending signal yet simply isn't a candidate there, so "Just In"
    // could show an article hours old as the "latest" while genuinely
    // fresher ones existed just outside the top-80-by-trending cutoff.
    // Excludes scheduled previews IN the query, not after — confirmed live
    // that a scheduled match's `publishedAt` is set to its future kickoff
    // date (e.g. "Oct 3"), not the ingestion time, so sorting by publishedAt
    // DESC put dozens of future-dated preview articles ahead of every real,
    // present-day article: the top 60 rows by date were ALL scheduled
    // previews, leaving nothing for a post-fetch filter to find. Real image
    // presence is still filtered in JS below (over-fetched to 15 for that).
    db.select().from(articleTable)
      .where(and(
        ...baseConditions,
        isNotNull(articleTable.publishedAt),
        or(isNull(articleTable.matchStatus), ne(articleTable.matchStatus, "scheduled"))
      ))
      .orderBy(desc(articleTable.publishedAt))
      .limit(15),
    // Independent freshness-first query for "Transfers & Big News" below —
    // same bug class as justInRaw above (see its comment), confirmed live
    // 2026-09-20: deriving this from the trending-limited `articlesRanked`
    // (LIMIT 80) meant an old article whose trendingScore never decays
    // could permanently occupy the top-80 window, silently squeezing out
    // genuinely fresh, real, qualifying candidates — the section rendered
    // completely empty for cricket/football while 71/48 fresh, real-image,
    // highlight-worthy articles actually existed in the database. Ordered
    // by trendingScore within the fresh window (not pure recency, unlike
    // justInRaw) so the best fresh stories still surface first; the
    // isHighlightWorthy/real-image/match-data-exclusion filters stay in JS
    // below, unchanged.
    db.select().from(articleTable)
      .where(and(
        ...baseConditions,
        gte(articleTable.publishedAt, new Date(Date.now() - HIGHLIGHT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000))
      ))
      .orderBy(desc(articleTable.trendingScore))
      .limit(60),
    // Independent freshness-first query for "Match Results & Previews" and
    // "NFL Scores & Previews" below — same bug class as justInRaw/
    // highlightCandidatesRaw above (confirmed live 2026-09-20: a 10-day-old
    // NFL recap was still showing under "NFL Scores & Previews" because its
    // trendingScore never decayed and it stayed inside the un-windowed
    // top-80 `articlesRanked` pool). `gte(publishedAt, cutoff)` correctly
    // handles both halves of this section: a real result's publishedAt is a
    // real past date and needs the recency window, while a not-yet-played
    // "Preview: X vs Y" article's publishedAt is set to its future kickoff
    // time (see runIngest.ts's match-data sources) — always >= any past
    // cutoff, so previews are never wrongly excluded by this filter.
    db.select().from(articleTable)
      .where(and(
        ...baseConditions,
        gte(articleTable.publishedAt, new Date(Date.now() - HIGHLIGHT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000))
      ))
      .orderBy(desc(articleTable.trendingScore))
      .limit(100),
  ]);
  const rankedIds = new Set(articlesRanked.map((a) => a.id));
  const articlesWithDupes = [...manuallyFeaturedRaw.filter((a) => !rankedIds.has(a.id)), ...articlesRanked];

  // Real duplicate rows do exist in the DB for the same underlying story
  // (confirmed live: identical Sky Sports headlines with different
  // dedupeHash values) -- the ingest-time dedup hash buckets by UTC day,
  // and a source's own pubDate can drift across a midnight boundary
  // between two polls of the same RSS item, hashing the same real article
  // differently each time. That's a deeper ingestion-level fix; this is
  // the display-layer safety net, deduplicating by normalized title once
  // here so every section built from `articles` below (hero, Transfers &
  // Big News, Match Results, Also in the News, Just In, etc.) benefits at
  // once. Keeps the first occurrence, which is always the highest-ranked
  // one since manuallyFeatured/articlesRanked are already sorted.
  const seenNormalizedTitles = new Set<string>();
  const articles = articlesWithDupes.filter((a) => {
    // Main sections only show stories with a real image (hasRealImage: a
    // real photo or a team-crest pair, not the generic Pexels stock
    // fallback or a broken URL) — explicit request 2026-09-25. An admin's
    // own hero/highlight pick is kept regardless: it's a deliberate choice.
    if (!a.featured && !a.highlighted && !hasRealImage(a)) return false;
    const norm = a.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seenNormalizedTitles.has(norm)) return false;
    seenNormalizedTitles.add(norm);
    return true;
  });

  // For each tracked player, find their single most prominent recent
  // article (reusing the already-fetched, trending-sorted `articles` list —
  // no extra queries) and show that real headline instead of a bare
  // nav-shortcut chip. Players with nothing recent are left out entirely,
  // since an empty card under a "Player News" heading would be confusing.
  const allPlayerNewsMatches = TRACKED_PLAYERS.map((player) => {
    const articleIndex = articles.findIndex((a) =>
      player.searchTerms.some((term) => a.title.toLowerCase().includes(term.toLowerCase()))
    );
    return articleIndex === -1 ? null : { player, article: articles[articleIndex], articleIndex };
  }).filter(
    (entry): entry is { player: (typeof TRACKED_PLAYERS)[number]; article: (typeof articles)[number]; articleIndex: number } =>
      entry !== null
  );

  // Capped, and sorted by how trending the matched article is (articles is
  // already trending-sorted, so a lower articleIndex is a hotter story) —
  // real production outage caused by this NOT being capped: TRACKED_PLAYERS
  // has grown to 85 entries, 35 of which matched simultaneously on one real
  // day's news (confirmed live), each triggering its own multi-step
  // Wikipedia photo lookup in the same Promise.all below. That blew past
  // Cloudflare Workers' per-request execution budget — reproduced
  // consistently in production while working fine in unconstrained local
  // dev, which is exactly the signature of a platform resource limit, not
  // a code exception (fetchPersonPhoto already catches everything). This
  // cap is both the fix and, incidentally, a real UX improvement — a
  // horizontal strip of 35 avatars was never a reasonable display anyway.
  const MAX_PLAYER_NEWS = 10;
  const playerNewsMatches = allPlayerNewsMatches
    .sort((a, b) => a.articleIndex - b.articleIndex)
    .slice(0, MAX_PLAYER_NEWS);

  // "Just In": pure recency, unlike everything else on this page (which is
  // trending-sorted, category-grouped, or player-matched) — a plain
  // freshness signal, the one sidebar module almost every news site has.
  // Its own query (justInRaw, fetched above) — see that query's comment for
  // why reusing the trending-limited `articles` list here was a real bug.
  //
  // Scheduled previews are already excluded at the query level above (see
  // its comment). Still filters for a real image here — same reasoning as
  // the hero carousel: this module is meant to showcase real news, not a
  // bare line with no photo or crest at all.
  const justIn = justInRaw
    .filter((a) => Boolean(a.heroImageUrl) || Boolean(a.homeCrestUrl && a.awayCrestUrl))
    .slice(0, 3);

  // "By Category" sidebar tiles: one representative story per sport, so
  // Cricket/World Cup still get real homepage visibility on the "All" view
  // even when they don't happen to rank highly enough for the trending
  // main feed. Only shown on "All" (no category filter already applied) —
  // redundant once you're already looking at a single category. Reuses the
  // same fetched `articles` list, no extra queries; prefers an article that
  // actually has an image, since the whole point is a visual tile.
  const categoryTiles = category
    ? []
    : Object.keys(CATEGORY_META)
        .map((cat) => {
          const inCategory = articles.filter((a) => a.category === cat);
          const withImage = inCategory.find((a) => a.heroImageUrl || (a.homeCrestUrl && a.awayCrestUrl));
          const chosen = withImage ?? inCategory[0];
          return chosen ? { category: cat, article: chosen } : null;
        })
        .filter((entry): entry is { category: string; article: (typeof articles)[number] } => entry !== null);

  // "By Competition" sidebar tiles — same idea and same visual pattern as By
  // Category, one level more specific (Premier League, La Liga, Champions
  // League, etc. instead of just "Football"). Competition name is parsed out
  // of the already-reliable summary format via `competitionFromSummary`
  // (only works for football-data.org-sourced match summaries — RSS
  // articles correctly return null and are skipped rather than guessed).
  // Capped at 4 so the sidebar doesn't grow tall again after just fixing
  // that. Only on "All" (no category filter), matching By Category's scope.
  const competitionTiles = category
    ? []
    : (() => {
        const seen = new Map<string, (typeof articles)[number]>();
        for (const a of articles) {
          const competition = competitionFromSummary(a.summary);
          if (competition && !seen.has(competition)) seen.set(competition, a);
        }
        return [...seen.entries()].slice(0, 4).map(([competition, article]) => ({ competition, article }));
      })();

  // Manually-picked hero articles (set from /admin) always win the first
  // slots, most-recently-picked first — the rest of the hero carousel
  // auto-fills with top-ranked stories below. Capped at 5 in actions.ts
  // (picking a 6th auto-retires the oldest pick), so no need to slice here.
  //
  // A pick older than HERO_FEATURE_MAX_AGE_DAYS stops qualifying here —
  // confirmed live: an admin's pick with nothing rotating it out could sit
  // in the hero indefinitely, advertising stale news on a site whose own
  // content turns over multiple times an hour. Filtered at query time
  // rather than a separate cleanup job that flips `featured` back to
  // false: self-correcting the moment a pick ages out (no risk of a missed
  // cron run leaving it stuck), and the admin's pick/featuredAt stay
  // intact in the database — re-featuring later needs no extra step. A
  // stale pick simply falls back into the normal candidate pool below like
  // any other article, rather than becoming ineligible for the hero
  // entirely.
  const manuallyFeatured = articles
    .filter((a) => a.featured && !isHeroFeatureStale(a.featuredAt))
    .sort((a, b) => (b.featuredAt?.getTime() ?? 0) - (a.featuredAt?.getTime() ?? 0));
  const manuallyFeaturedIds = new Set(manuallyFeatured.map((a) => a.id));
  const remainingAfterFeatured = articles.filter((a) => !manuallyFeaturedIds.has(a.id));

  // Manually-highlighted articles (set from /admin) are pinned into
  // "Transfers & Big News" alongside — not instead of — the automatic
  // keyword match, most-recently-picked first, capped at 4 total so the
  // section can't grow unbounded. A pick older than HIGHLIGHT_MAX_AGE_DAYS
  // stops qualifying here — same self-correcting staleness fix as the hero
  // carousel's manuallyFeatured above, so a forgotten pick doesn't
  // permanently occupy a slot that genuinely new highlight-worthy stories
  // (automaticHighlights below) should be filling instead.
  const manuallyHighlighted = remainingAfterFeatured
    .filter((a) => a.highlighted && !isHighlightStale(a.highlightedAt))
    .sort((a, b) => (b.highlightedAt?.getTime() ?? 0) - (a.highlightedAt?.getTime() ?? 0))
    .slice(0, 4);
  const manuallyHighlightedIds = new Set(manuallyHighlighted.map((a) => a.id));
  const remainingAfterHighlighted = remainingAfterFeatured.filter((a) => !manuallyHighlightedIds.has(a.id));

  // Sourced from matchCandidatesRaw (its own freshness-first query, see
  // above) rather than remainingAfterHighlighted/articlesRanked — the same
  // top-80-by-trending pool with no age bound that already caused "Just In"
  // and "Transfers & Big News" to go stale before their own dedicated
  // queries were added. Still excludes anything already claimed as a
  // manual hero/highlight pick, same as every other section here.
  const excludedFromMatchPool = new Set([...manuallyFeaturedIds, ...manuallyHighlightedIds]);
  const allMatchArticlesFull = matchCandidatesRaw.filter(
    (a) => isMatchDataSource(a.sourceName) && !excludedFromMatchPool.has(a.id)
  );
  const allBriefArticlesFull = remainingAfterHighlighted.filter((a) => !isMatchDataSource(a.sourceName));

  // Hero carousel: manual picks (up to 5, latest first) always win the
  // first slots; any remaining slots fill from match articles and RSS
  // headlines merged into ONE pool and re-ranked by trending score —
  // standardized 2026-09-20 (explicit request) after a real complaint: a
  // bare, minimal-content match-result template (crests only, ~100-char
  // body) was winning a hero slot over genuinely bigger, better-illustrated
  // stories, simply because match articles used to be concatenated ahead
  // of RSS articles regardless of actual trending score. Merit now decides
  // — a bare score template only leads the hero when it's genuinely the
  // most trending story available, not by category default. Capped at 5
  // slides total — enough to feel like a real rotation without turning the
  // front page into an endless slideshow.
  //
  // Not-yet-played "Preview: X vs Y" match articles are excluded from the
  // candidate pool here — a scheduled match structurally never has a real
  // photo yet (just team crests, or nothing), so it reads as a bare/broken
  // slide next to genuinely photo-led stories. They still show normally in
  // "Match Results & Previews" below (matchStatus is untouched there) —
  // this only narrows what's eligible to lead the hero.
  const heroEligibleMatchArticles = allMatchArticlesFull.filter((a) => a.matchStatus !== "scheduled");
  // allBriefArticlesFull is fresh now that articlesRanked is windowed
  // (fetchFreshRanked), so the hero shares it with every other section.
  // The hero is a large, full-width photo slot: automatic candidates need a
  // real photo that isn't known to be small (lib/imageQuality.ts). Crest-only
  // match results ("Royals 1-9 White Sox" with two logos) and 240px BBC
  // thumbnails were leading it (2026-09-25); they still show in their own
  // sections. Admin hero picks (manuallyFeatured) are exempt.
  const heroMergedPool = [...heroEligibleMatchArticles, ...allBriefArticlesFull].filter((a) => isHeroQualityImage(a.heroImageUrl)).sort(
    (a, b) => b.trendingScore - a.trendingScore
  );
  const heroCandidates = [...manuallyFeatured, ...heroMergedPool];
  const seenHeroIds = new Set<string>();
  const heroArticles = heroCandidates
    .filter((a) => {
      if (seenHeroIds.has(a.id)) return false;
      seenHeroIds.add(a.id);
      return true;
    })
    .slice(0, 5);
  const heroIds = new Set(heroArticles.map((a) => a.id));
  const allMatchArticles = allMatchArticlesFull.filter((a) => !heroIds.has(a.id));
  const allBriefArticles = allBriefArticlesFull.filter((a) => !heroIds.has(a.id));

  // Two guards added here that automatic picks previously had neither of:
  // a recency bound (matching HIGHLIGHT_MAX_AGE_DAYS, the same 3-day
  // threshold manual picks already expire after — allBriefArticles is
  // trending-sorted, not date-sorted, so an old-but-still-trending
  // article could otherwise sit here indefinitely) and a real-image
  // requirement (same reasoning as the hero carousel/"Just In" filters —
  // this is a visual, photo-led section, not a bare text link list).
  // Was deriving purely from `allBriefArticles` (itself sliced from the
  // trending-limited `articlesRanked` query, LIMIT 80) — same bug class
  // already fixed for "Just In" above (see that query's comment): old
  // articles whose trendingScore never decays can permanently occupy the
  // top-80 window, silently squeezing out genuinely fresh candidates.
  // Confirmed live (2026-09-20): 71 real, fresh (published <3 days),
  // highlight-worthy, real-image cricket articles existed in the database
  // at the moment this section was rendering completely empty — all of
  // them were simply outside the top-80-by-trending cutoff, out-ranked by
  // older, higher-scoring stories. `highlightCandidatesRaw` (fetched above,
  // its own dedicated freshness-first query) fixes this the same way
  // `justInRaw` already does for "Just In" — a candidate pool that can
  // never silently exclude a real, fresh, qualifying story just because an
  // older one out-scored it in an unrelated query's LIMIT.
  const highlightCandidateIds = new Set(heroArticles.map((a) => a.id));
  const highlightEligiblePool = highlightCandidatesRaw
    .filter((a) => !highlightCandidateIds.has(a.id) && !manuallyHighlightedIds.has(a.id) && !isMatchDataSource(a.sourceName))
    .filter((a) => Boolean(a.heroImageUrl && !a.heroImageUrl.includes("pexels.com")) || Boolean(a.homeCrestUrl && a.awayCrestUrl));
  const highlightWorthyPicks = highlightEligiblePool.filter((a) => isHighlightWorthy(a.title));
  // Fallback for categories that structurally almost never clear
  // isHighlightWorthy — confirmed live (2026-09-20): rugby had 42 fresh,
  // real-image articles and ZERO passed, because isHighlightWorthy only
  // matches EVENT_KEYWORDS or a TRACKED_PLAYERS name, and rugby has no
  // tracked players. Same root cause already solved for hockey/volleyball/
  // formula-1 in autoApprove.ts's RESERVED_CATEGORIES (their Facebook/
  // Instagram slot), but that fix never covered this homepage section.
  // Rather than hardcode a category list here too, fall back to the best
  // remaining fresh/real-image articles by trending score whenever the
  // highlight-worthy set alone doesn't fill the section — a no-op for
  // football/cricket, which already have plenty of highlight-worthy
  // matches, but guarantees a single-category page is never left with
  // nothing to show just because its sport isn't one Gemini/EVENT_KEYWORDS
  // happens to recognize.
  const highlightFallbackPicks = highlightEligiblePool.filter((a) => !isHighlightWorthy(a.title));
  const automaticHighlights = [...highlightWorthyPicks, ...highlightFallbackPicks]
    .slice(0, Math.max(0, 4 - manuallyHighlighted.length));
  const highlightArticles = [...manuallyHighlighted, ...automaticHighlights];
  const highlightIds = new Set(highlightArticles.map((a) => a.id));
  // Was completely uncapped — every RSS article not already used as a hero
  // or highlight pick landed here, which could genuinely be 30+ items,
  // making this sidebar module far taller than the main column next to it
  // (both are in the same sticky grid row, so a much-taller sidebar means
  // scrolling past the main column's real content into visually empty
  // space before this one's is exhausted too). Capped to match the scale
  // of every other sidebar list module ("Just In" caps at 3).
  const briefArticles = allBriefArticles.filter((a) => !highlightIds.has(a.id)).slice(0, 8);

  // NFL gets its own section rather than being mixed into the generic
  // football/cricket match list — three different sports sharing one
  // trending-sorted list diluted the feed for readers focused on any one
  // of them. Splitting here (rather than a separate query) means this
  // still works correctly on every filtered view for free: on `?category=
  // american-football` the generic list is naturally empty and only this
  // section renders; on `?category=football`/`cricket` it's the reverse.
  const allNflArticles = allMatchArticles.filter((a) => a.sourceName === "ESPN NFL");
  const allFootballCricketArticles = allMatchArticles.filter((a) => a.sourceName !== "ESPN NFL");

  const matchArticles = allFootballCricketArticles.slice(0, 10);
  const nflArticles = allNflArticles.slice(0, 10);
  // Was allFootballCricketArticles.slice(10, 25) — that pool is genuine
  // match-data sources only (football-data.org/CricketData.org), which is
  // correct for "Match Results & Previews" above but far too small a pool
  // to also slice a 15-item overflow from (a finite number of real matches
  // per day, often under 10 total). Confirmed live: this section was
  // rendering empty/near-empty after allMatchArticlesFull was correctly
  // narrowed to match-data-only sources (see isMatchDataSource fix) — this
  // section was accidentally relying on that pool being oversized (a bug)
  // to have any volume at all. Draws from the large editorial pool instead
  // (same source as "Also in the News"), excluding whatever's already
  // shown in Transfers & Big News / Also in the News just above it.
  const usedBriefIds = new Set([...highlightIds, ...briefArticles.map((a) => a.id)]);
  const moreArticles = allBriefArticles.filter((a) => !usedBriefIds.has(a.id)).slice(0, 15);

  // Standings only exist for domestic leagues on this API tier (not Champions
  // League/World Cup/Euros — no data — and cricket has no active standings
  // source at all), so only show this on "All" or the plain "Football" filter.
  const showStandings = !category || category === "football";
  const standingsApiKey = process.env.FOOTBALL_DATA_API_KEY;

  // Yesterday's fix batched player photos/hero banners/standings/NFL
  // standings into one Promise.all, which cut total wait to the slowest
  // single stage instead of the sum of all four — a real improvement, but
  // the WHOLE page still waited for that slowest stage (the Wikipedia
  // player-photo lookups, confirmed the dominant one) before sending
  // ANYTHING to the browser. This is the real "load part by part" fix:
  // Player News and both standings widgets are now separate async
  // components, each wrapped in its own <Suspense> below — the fast,
  // DB-only content (hero, main feed) streams immediately, and each slow
  // section fills in on its own as soon as ITS data resolves, instead of
  // every section waiting on whichever one is slowest. heroSlides stays
  // here (blocking) since the hero is the first thing a visitor sees —
  // popping in after the rest of the page would be a worse experience than
  // the extra wait, unlike the below-the-fold sections deferred below.
  const heroSlides = await Promise.all(
    heroArticles.map(async (article) => {
      const hasCrests = Boolean(article.homeCrestUrl && article.awayCrestUrl);
      const banner = !hasCrests && !article.heroImageUrl ? await fetchOneStockImage(article.category) : null;
      return { article, banner };
    })
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Phones only: scores at the very top (see MobileScoresRow). */}
      <MobileScoresRow matches={liveMatches.slice(0, 12)} sport={category?.split("/")[0]} />
      <HomeBanners />
      {!category && <ForYouStrip />}
      {/* Our writers' latest pieces lead the page once there are several (see AnalysisStrip). */}
      <Suspense fallback={null}>
        <AnalysisStrip category={category} placement="top" />
      </Suspense>
      {articles.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="h6" gutterBottom>
            {category === "football/world-cup"
              ? "No World Cup coverage right now"
              : "No articles here yet"}
          </Typography>
          <Typography sx={{ color: "text.secondary", mb: 3 }}>
            {category === "football/world-cup"
              ? "The tournament only runs every four years — check back closer to the next one, or see what's happening in Football and Cricket right now."
              : category
                ? "Nothing published in this category yet — check back soon."
                : "No articles published yet — approve some in /admin to see them here."}
          </Typography>
          {category === "football/world-cup" && (
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center" }}>
              <Link href="/sport/football" style={{ textDecoration: "none" }}>
                <Chip label="Football" clickable color="primary" variant="outlined" />
              </Link>
              <Link href="/sport/cricket" style={{ textDecoration: "none" }}>
                <Chip label="Cricket" clickable color="primary" variant="outlined" />
              </Link>
            </Stack>
          )}
        </Box>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr", lg: "240px 1fr 340px" },
          gap: 5,
          alignItems: "start",
        }}
      >
        {/* Standings widgets are now streamed independently (see below), so
            this container no longer knows synchronously whether they'll
            have content — always shows when any of the fast/sync sections
            do, which in practice is virtually always true (PLAYER_QUOTES is
            a non-empty static list). The rare page with none of these but
            real standings data would just show a container with only the
            streamed widget in it once it resolves — a fine tradeoff for not
            blocking the whole sidebar on the same slow calls being deferred. */}
        {(categoryTiles.length > 0 || justIn.length > 0 || PLAYER_QUOTES.length > 0 || showStandings || category === "american-football") && (
          <Box
            component="aside"
            sx={{
              gridColumn: { xs: "1 / -1", md: "1 / -1", lg: "1" },
              // On mobile/tablet (single column), this sidebar comes before
              // <main> in the source, so without an explicit order it was
              // rendering above the hero story and all headlines — pushing
              // real content below the fold under a standings table. Push it
              // after main there; lg has its own explicit column already so
              // order doesn't affect that layout.
              order: { xs: 2, lg: 0 },
              // At lg, the hero image and <main> are now two separate grid
              // items in the same column (split so the hero can reorder
              // ahead of the Live Cricket block on mobile — see that Box's
              // own order comment below) — without this, auto-placement put
              // this aside in the SAME implicit row as the (short) hero,
              // forcing that row to stretch to this aside's full height and
              // leaving a large visible gap between the hero and <main>
              // (confirmed live). Spanning both implicit rows here lets
              // hero's row stay hero-sized and <main>'s row size to <main>.
              gridRow: { lg: "1 / span 2" },
              position: { lg: "sticky" },
              // 68px sticky header + a 16px gap — without this it sticks at
              // the old top:32 offset and slides up underneath the header.
              top: { lg: 84 },
              // No internal scrollbar on this sidebar — it read as confusing
              // (an unexpected nested scrollbar) even though it was working
              // as designed. Trimmed "Just In" to 3 items instead so the
              // four stacked modules fit within a typical viewport without
              // needing one; on a genuinely short window it just un-sticks
              // and scrolls with the page like a normal element, which is a
              // fine fallback.
            }}
          >
            {showStandings && standingsApiKey && (
              <Suspense fallback={null}>
                <FootballStandingsWidget apiKey={standingsApiKey} />
              </Suspense>
            )}

            {category === "american-football" && (
              <Suspense fallback={null}>
                <NflStandingsWidget />
              </Suspense>
            )}

            {category === "basketball" && (
              <Suspense fallback={null}>
                <NbaStandingsWidget />
              </Suspense>
            )}

            {category === "baseball" && (
              <Suspense fallback={null}>
                <MlbStandingsWidget />
              </Suspense>
            )}

            {category === "hockey" && (
              <Suspense fallback={null}>
                <NhlStandingsWidget />
              </Suspense>
            )}

            {categoryTiles.length > 0 && (
              <Paper component="section" variant="outlined" sx={{ p: 2 }}>
                <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, mb: 1, display: "block" }}>
                  By Category
                </Typography>
                <Stack spacing={1.25}>
                  {categoryTiles.map(({ category: cat, article }) => (
                    <Link
                      key={cat}
                      href={`/article/${article.slug}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.25}
                        sx={{
                          alignItems: "center",
                          p: 0.75,
                          borderRadius: 2,
                          transition: "background-color 0.15s",
                          "&:hover": { bgcolor: "action.hover" },
                        }}
                      >
                        <ArticleThumb article={article} size={48} fallbackColor={categoryChipStyle(cat).color} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="caption"
                            sx={{ color: categoryChipStyle(cat).color, fontWeight: 700, display: "block" }}
                          >
                            {categoryChipStyle(cat).label}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: 12.5,
                              lineHeight: 1.3,
                              fontWeight: 500,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {article.title}
                          </Typography>
                        </Box>
                      </Stack>
                    </Link>
                  ))}
                </Stack>
              </Paper>
            )}

            {competitionTiles.length > 0 && (
              <Paper component="section" variant="outlined" sx={{ p: 2, mt: 3 }}>
                <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, mb: 1, display: "block" }}>
                  By Competition
                </Typography>
                <Stack spacing={1.25}>
                  {competitionTiles.map(({ competition, article }) => (
                    <Link
                      key={competition}
                      href={`/article/${article.slug}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.25}
                        sx={{
                          alignItems: "center",
                          p: 0.75,
                          borderRadius: 2,
                          transition: "background-color 0.15s",
                          "&:hover": { bgcolor: "action.hover" },
                        }}
                      >
                        <ArticleThumb article={article} size={48} fallbackColor="#1d6b3f" />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700, display: "block" }}>
                            {competition}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: 12.5,
                              lineHeight: 1.3,
                              fontWeight: 500,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {article.title}
                          </Typography>
                        </Box>
                      </Stack>
                    </Link>
                  ))}
                </Stack>
              </Paper>
            )}

            <SentimentLeaderboard />

            {justIn.length > 0 && (
              <Paper component="section" variant="outlined" sx={{ p: 2, mt: 3 }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
                  <AccessTimeIcon sx={{ fontSize: 15, color: "primary.main" }} />
                  <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, lineHeight: 1 }}>
                    Just In
                  </Typography>
                </Stack>
                <Stack spacing={1.25}>
                  {justIn.map((article, i) => (
                    <Box key={article.id}>
                      {i > 0 && <Divider sx={{ mb: 1.25 }} />}
                      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                        {/* flex-start, not center — this row has a secondary
                            timestamp line below the title, which pulls the
                            true vertical center down and makes a centered
                            thumbnail look misaligned with the headline. */}
                        <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
                          <ArticleThumb article={article} size={40} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontSize: 12.5,
                                fontWeight: 500,
                                lineHeight: 1.35,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {article.title}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              {relativeTime(article.publishedAt!)}
                            </Typography>
                          </Box>
                        </Stack>
                      </Link>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}

            {PLAYER_QUOTES.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <QuotesStrip quotes={PLAYER_QUOTES} />
              </Box>
            )}
          </Box>
        )}

        {/* minWidth: 0 overrides the grid item's default min-width:auto —
            without it, the Star Players horizontal-scroll strip's intrinsic
            content width pushes this whole column (and the page) wider
            instead of scrolling inside its own box, a classic CSS Grid trap. */}
        {/* Hero and <main> share ONE grid item (flex column inside it)
            instead of being two separate grid siblings — fixed 2026-09-20
            (confirmed live, a real user-visible bug): as two siblings, each
            got its own auto-placed grid row at md/lg, and whenever the
            sidebar's own content (e.g. "Also in the News") was taller than
            hero+main combined, the shared row stretched to match it,
            leaving a large visible gap below <main>'s actual content before
            the next section — worst on categories like cricket where
            <main> itself is short (see the aside's own gridRow comment
            below for the mirror-image version of this same fix). Combining
            them into one grid item means this cell's height is governed
            purely by ITS OWN content, immune to how tall its neighbor is.
            The `order: -2` at xs still needs to live on this outer wrapper
            (not just the hero) — the hero is the site's first impression
            and needs to render immediately after the nav on mobile, ahead
            of the Live Cricket sidebar block (order -1), which itself needs
            to beat the rest of this combined block's content. `gap: 5`
            replicates the spacing the grid's own `gap` used to provide
            between hero and <main> when they were separate grid items. */}
        <Box
          sx={{
            gridColumn: { xs: "1 / -1", md: "1", lg: "2" },
            order: { xs: -2, md: 0 },
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
        {heroSlides.length > 0 && (
          <Box sx={{ minWidth: 0 }}>
            <HeroCarousel
              slides={heroSlides.map(({ article, banner }) => ({
                slug: article.slug,
                title: article.title,
                summary: displaySummary(article, 260),
                heroImageUrl: article.heroImageUrl,
                homeCrestUrl: article.homeCrestUrl,
                awayCrestUrl: article.awayCrestUrl,
                bannerUrl: banner?.url ?? null,
                bannerCredit: banner?.credit ?? null,
                bannerCreditUrl: banner?.creditUrl ?? null,
              }))}
            />
          </Box>
        )}

        <Box component="main" sx={{ minWidth: 0 }}>
          <HappeningNow competitions={activeCompetitions} medalLines={medalLines} />

          {playerNewsMatches.length > 0 && (
            <Suspense fallback={<PlayerNewsSkeleton />}>
              <PlayerNewsSection playerNewsMatches={playerNewsMatches} />
            </Suspense>
          )}

          {/* Official league/broadcaster videos (src/lib/videos/), filtered
              to the current sport; its own Suspense so the query never
              delays the news below. */}
          <Suspense fallback={<VideoStripSkeleton headingSx={SECTION_HEADING_SX} />}>
            <LatestVideos category={category} headingSx={SECTION_HEADING_SX} />
          </Suspense>

          {highlightArticles.length > 0 && (
            <Box component="section" sx={{ mb: 4 }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
                <SwapHorizIcon sx={{ color: "warning.main" }} />
                <Typography variant="h5" sx={SECTION_HEADING_SX}>Transfers &amp; Big News</Typography>
              </Stack>
              <Stack spacing={2}>
                {highlightArticles.map((article) => (
                  // Whole card is now clickable (previously only the title
                  // text was, with no hover feedback anywhere on the rest of
                  // the card) — safe now that ArticleThumb's credit badge is
                  // plain text, not a nested <a> (see the hydration-crash
                  // fix earlier). Hover lift is the same "attract users"
                  // affordance the player/club/series pages already use.
                  <Link
                    key={article.id}
                    href={`/article/${article.slug}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Card
                      variant="outlined"
                      sx={{
                        borderColor: "warning.main",
                        transition: "box-shadow 0.15s, transform 0.15s",
                        "&:hover": { boxShadow: "0 4px 14px rgba(0,0,0,0.1)", transform: "translateY(-2px)" },
                      }}
                    >
                      <CardContent>
                        {/* alignItems: "center" -- without it, Stack's row
                            layout leaves this fixed-height thumbnail
                            top-aligned against the taller title+summary
                            text block beside it, a visible empty gap under
                            the image whenever the text runs longer than the
                            thumbnail (confirmed live 2026-09-24, real user
                            report: same root cause found in 8 places
                            site-wide, all fixed together). */}
                        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                          <ArticleThumb article={article} size={84} fallbackColor="#f59e0b" />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            {/* Sport/category badge at the top, same spot and
                                style "Match Results & Previews" etc. already use
                                — this is our own taxonomy, not third-party
                                attribution, so it's fine (good, even) for
                                scanning to keep it prominent up here. Date
                                moved inline here too (2026-09-24, explicit
                                request) — was its own line below the title;
                                now on the top line alongside the category
                                chip, matching "Match Results & Previews" and
                                "NFL Scores & Previews" exactly instead of
                                being the one section styled differently. */}
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}>
                              <Chip
                                label={categoryChipStyle(article.category).label}
                                size="small"
                                variant="outlined"
                                sx={{
                                  color: categoryChipStyle(article.category).color,
                                  borderColor: categoryChipStyle(article.category).color,
                                  fontWeight: 600,
                                }}
                              />
                              {article.highlighted && (
                                <Chip label="📌 Editor's pick" size="small" sx={{
                                  color: "warning.contrastText", bgcolor: "warning.main"
                                }} />
                              )}
                              {article.publishedAt && (
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                  {article.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </Typography>
                              )}
                            </Stack>
                            <Typography variant="h6" component="h2" gutterBottom>
                              {article.title}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </Stack>
            </Box>
          )}

          {matchArticles.length > 0 && (
            <Box component="section">
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
                <ScoreboardIcon sx={{ color: "primary.main" }} />
                <Typography variant="h5" sx={SECTION_HEADING_SX}>Match Results &amp; Previews</Typography>
              </Stack>
              <Stack spacing={2}>
                {matchArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/article/${article.slug}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Card
                      variant="outlined"
                      sx={{
                        transition: "box-shadow 0.15s, border-color 0.15s, transform 0.15s",
                        "&:hover": {
                          borderColor: "primary.main",
                          boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                          transform: "translateY(-2px)",
                        },
                      }}
                    >
                      <CardContent>
                        {/* alignItems: "center" -- see the Transfers & Big
                            News section above for why. */}
                        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                          <ArticleThumb article={article} size={84} fallbackColor={categoryChipStyle(article.category).color} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}>
                              <Chip
                                label={categoryChipStyle(article.category).label}
                                size="small"
                                variant="outlined"
                                sx={{
                                  color: categoryChipStyle(article.category).color,
                                  borderColor: categoryChipStyle(article.category).color,
                                  fontWeight: 600,
                                }}
                              />
                              {article.publishedAt && (
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                  {article.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </Typography>
                              )}
                            </Stack>
                            <Typography variant="h6" component="h2" gutterBottom>
                              {article.title}
                            </Typography>
                            <Typography variant="body2" sx={{
                              color: "text.secondary"
                            }}>
                              {displaySummary(article)}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </Stack>
            </Box>
          )}

          {nflArticles.length > 0 && (
            <Box component="section" sx={{ mt: matchArticles.length > 0 ? 4 : 0 }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
                <SportsFootballIcon sx={{ color: categoryChipStyle("american-football").color }} />
                <Typography variant="h5" sx={SECTION_HEADING_SX}>NFL Scores &amp; Previews</Typography>
              </Stack>
              <Stack spacing={2}>
                {nflArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/article/${article.slug}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Card
                      variant="outlined"
                      sx={{
                        transition: "box-shadow 0.15s, border-color 0.15s, transform 0.15s",
                        "&:hover": {
                          borderColor: "primary.main",
                          boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                          transform: "translateY(-2px)",
                        },
                      }}
                    >
                      <CardContent>
                        {/* alignItems: "center" -- see the Transfers & Big
                            News section above for why. */}
                        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                          <ArticleThumb article={article} size={84} fallbackColor={categoryChipStyle(article.category).color} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}>
                              <Chip
                                label={categoryChipStyle(article.category).label}
                                size="small"
                                variant="outlined"
                                sx={{
                                  color: categoryChipStyle(article.category).color,
                                  borderColor: categoryChipStyle(article.category).color,
                                  fontWeight: 600,
                                }}
                              />
                              {article.publishedAt && (
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                  {article.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </Typography>
                              )}
                            </Stack>
                            <Typography variant="h6" component="h2" gutterBottom>
                              {article.title}
                            </Typography>
                            <Typography variant="body2" sx={{
                              color: "text.secondary"
                            }}>
                              {displaySummary(article)}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
        </Box>

        {(briefArticles.length > 0 || PLAYER_QUOTES.length > 0) && (
          // Both modules share ONE sticky wrapper, same pattern as the left
          // rail's multiple stacked modules — two independent
          // position:"sticky" siblings at the same top offset was the actual
          // bug here: each stuck on its own once scrolled past, so "Also in
          // the News" could end up pinned in a place that didn't match its
          // normal-flow position, reading as "not where it should be."
          <Box
            sx={{
              gridColumn: { xs: "1 / -1", md: "2", lg: "3" },
              // Without this, "order:0" (the default) falls back to DOM
              // source order on mobile/tablet — landing thousands of pixels
              // down, after every article in <main>, since this block comes
              // later in the JSX. A live scoreboard needs to be prominent
              // on every screen size, not just desktop's 3-column layout.
              order: { xs: -1, md: 0 },
              // Was `"1 / span 2"` — needed when hero and <main> were two
              // separate grid rows in column 1, so this column-2 block had
              // to span both to avoid stretching just the (short) hero row.
              // Now that hero+<main> are one combined grid item (see that
              // Box's own comment above — same underlying gap bug, fixed at
              // the source instead of worked around here), there's only one
              // real row in column 1, so spanning a second one left an
              // artificial empty row behind (confirmed live: a real visible
              // gap remained below <main>'s content even after that fix).
              gridRow: { md: "1" },
              position: { md: "sticky" },
              top: { md: 84 },
            }}
          >
            {/* The one deliberately chosen ad placement — see
                DisplayAd.tsx's comment. Sits among this column's other
                supplementary modules, not competing with headlines.
                Hidden below md — confirmed live that AdSense's responsive
                format expands to a large ~375x375 square at full mobile
                width, nothing like the compact, embedded look it has
                confined to this column's 340px width on desktop. The
                "More Headlines" scroll-tile ad below still covers mobile.
                CollapsibleAdBox also collapses this on desktop when
                there's nothing to fill (e.g. pre-approval) -- confirmed
                live that an empty ad's own margin was otherwise leaving a
                visible gap between Live Now and Also in the News with no
                ad content to show for it. */}
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <CollapsibleAdBox slot="9489682012" sx={{ mb: 3 }} />
            </Box>

            {briefArticles.length > 0 && (
              <Paper
                component="aside"
                variant="outlined"
                sx={{ p: 3 }}
              >
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.5 }}>
              <ArticleIcon sx={{ fontSize: 18, color: "primary.main" }} />
              <Typography variant="h6">
                Also in the News
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: "block",
                mb: 2
              }}>
              Quick links to coverage from around the web — click through for the full story.
            </Typography>
            <Stack spacing={1.5}>
              {briefArticles.map((article, index) => (
                <Box key={article.id}>
                  {index > 0 && <Divider sx={{ mb: 1.5 }} />}
                  <Link
                    href={`/article/${article.slug}`}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {/* flex-start, not center — the source Chip below the
                        title pulls the true vertical center down, same
                        reason as the Just In fix above. */}
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start", py: 0.5 }}>
                      <ArticleThumb article={article} size={40} fallbackColor={categoryChipStyle(article.category).color} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          gutterBottom
                          sx={{
                            fontWeight: 500,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {article.title}
                        </Typography>
                      </Box>
                    </Stack>
                  </Link>
                </Box>
              ))}
            </Stack>
              </Paper>
            )}

            {/* Generic fallback so this column is never a bare empty gap —
                confirmed live: a sparse category (e.g. NBA during preseason,
                ESPN's own feed down to a single item) can genuinely have
                neither a live cricket match nor any brief articles, and
                previously that meant nothing rendered here at all. */}
            {briefArticles.length === 0 && PLAYER_QUOTES.length > 0 && (
              <QuotesStrip quotes={PLAYER_QUOTES} />
            )}
            {/* Our writers' pieces while there are only a few (see
                AnalysisStrip's placement). */}
            <Suspense fallback={null}>
              <AnalysisStrip category={category} placement="side" />
            </Suspense>
          </Box>
        )}
      </Box>

      {moreArticles.length > 0 && (
        <Box component="section" sx={{ mt: 5 }}>
          <Typography variant="h5" sx={{ ...SECTION_HEADING_SX, mb: 2 }}>
            More Headlines
          </Typography>
          <ScrollRow gap={2}>
            {/* One native-feeling ad tile, matching the real cards'
                dimensions so it reads as part of the same scroll row
                instead of a separate banner block — see DisplayAd.tsx's
                comment on why this is manual, not Auto ads. Labeled
                "Advertisement" for transparency, same as any other ad.
                Collapses out of the row entirely when there's nothing to
                fill (e.g. pre-approval) — see MoreHeadlinesAdTile.tsx. */}
            <MoreHeadlinesAdTile slot="3029496703" />
            {moreArticles.map((article) => (
              <Link
                key={article.id}
                href={`/article/${article.slug}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
              <Card
                variant="outlined"
                sx={{ minWidth: 260, maxWidth: 260, flexShrink: 0 }}
              >
                <CardContent>
                  {article.homeCrestUrl && article.awayCrestUrl ? (
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: "center",
                        mb: 1
                      }}>
                      <TeamCrest name={article.homeTeam} crestUrl={article.homeCrestUrl} alt={crestAltText(article.summary).home} size={32} />
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 600
                        }}>
                        vs
                      </Typography>
                      <TeamCrest name={article.awayTeam} crestUrl={article.awayCrestUrl} alt={crestAltText(article.summary).away} size={32} />
                    </Stack>
                  ) : article.heroImageUrl ? (
                    // height:110 on a 260-wide card was a 2.36:1 crop —
                    // checked directly against a real portrait photo (330x495
                    // Wikimedia source): that only showed the top 32% of the
                    // image, cutting well below the chin on most headshots.
                    // 190 brings visible coverage up to ~55%, close to what
                    // ArticleThumb's own square crop shows (~67%) for the
                    // same source.
                    <Box sx={{ position: "relative", mb: 1, height: 190 }}>
                      <Box
                        component={Image}
                        src={article.heroImageUrl}
                        alt={article.title}
                        fill
                        sizes="(max-width: 900px) 100vw, 33vw"
                        sx={{ objectFit: "cover", objectPosition: "top", borderRadius: 1 }}
                      />
                      {article.heroImageCredit && (
                        // Same syndication-credit requirement the hero and
                        // article page already honor (see schema comment on
                        // Article.heroImageCredit) — was previously only
                        // shown on those two, silently dropped on every
                        // other card that reuses the same licensed photo.
                        // Deliberately near-invisible: no background pill, a
                        // text-shadow instead so it stays legible without
                        // reading as a heavy badge on a small card.
                        <Typography
                          variant="caption"
                          sx={{
                            position: "absolute",
                            right: 6,
                            bottom: 6,
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 9,
                            lineHeight: 1.4,
                            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                            maxWidth: "calc(100% - 12px)",
                            transition: "color 0.15s",
                            "&:hover": { color: "rgba(255,255,255,0.85)" },
                          }}
                          noWrap
                        >
                          {article.heroImageCredit}
                        </Typography>
                      )}
                    </Box>
                  ) : null}
                  <Typography
                    variant="subtitle2"
                    component="h3"
                    sx={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {article.title}
                  </Typography>
                </CardContent>
              </Card>
              </Link>
            ))}
          </ScrollRow>
        </Box>
      )}
    </Container>
  );
}
