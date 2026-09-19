import { Suspense } from "react";
import { db } from "@/db";
import { article as articleTable } from "@/db/schema";
import { and, eq, like, isNotNull, desc } from "drizzle-orm";
import { isMatchDataSource } from "@/lib/matchDataSources";
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
import { fetchNflStandingsTable } from "@/lib/ingestion/nflData";
import { NflStandingsCarousel } from "@/components/NflStandingsCarousel";
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
import { isHeroFeatureStale, isHighlightStale } from "@/lib/heroConfig";
import { SentimentLeaderboard } from "@/components/SentimentLeaderboard";
import { LiveScoreboardCarousel } from "@/components/LiveScoreboardCarousel";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { fetchLiveMatches } from "@/lib/liveMatches";
import { playerInitials, playerAvatarColor } from "@/lib/playerAvatar";
import StarIcon from "@mui/icons-material/Star";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArticleIcon from "@mui/icons-material/Article";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import SportsCricketIcon from "@mui/icons-material/SportsCricket";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

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

export const revalidate = 60;

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


const CATEGORY_META: Record<string, { title: string; description: string }> = {
  football: {
    title: "Football News, Scores & Standings",
    description: "Latest football results, previews, transfer news, and live league standings.",
  },
  "football/world-cup": {
    title: "World Cup News & Scores",
    description: "Latest World Cup match results, previews, and news.",
  },
  cricket: {
    title: "Cricket News & Scores",
    description: "Latest cricket news, match reports, and transfer stories.",
  },
  "american-football": {
    title: "NFL News, Scores & Standings",
    description: "Latest NFL results, previews, and news.",
  },
  athletics: {
    title: "Athletics News",
    description: "Latest track and field news from around the world.",
  },
  baseball: {
    title: "MLB News, Scores & Results",
    description: "Latest MLB results, previews, and news.",
  },
  basketball: {
    title: "NBA News, Scores & Results",
    description: "Latest NBA results, previews, and news.",
  },
  rugby: {
    title: "Rugby News",
    description: "Latest rugby union news from around the world.",
  },
  hockey: {
    title: "NHL News, Scores & Results",
    description: "Latest NHL results, previews, and news.",
  },
  volleyball: {
    title: "Volleyball News & Scores",
    description: "Latest volleyball match results, previews, and news from leagues around the world.",
  },
  "formula-1": {
    title: "Formula 1 News",
    description: "Latest Formula 1 news, race previews, and results.",
  },
};

export async function generateMetadata(
  props: {
    searchParams: Promise<{ category?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const meta = searchParams.category ? CATEGORY_META[searchParams.category] : undefined;
  // alternates replaces (not merges with) the root layout's alternates —
  // including its RSS feed `types` entry — so it has to be repeated here
  // rather than relying on the layout default to survive.
  const rssTypes = { types: { "application/rss+xml": "/feed.xml" } };
  if (!meta) return { alternates: { canonical: "/", ...rssTypes } };
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/?category=${searchParams.category}`, ...rssTypes },
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
  const nflStandings = await fetchNflStandingsTable();
  if (!nflStandings || nflStandings.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <NflStandingsCarousel conferences={nflStandings} />
    </Box>
  );
}

export default async function HomePage(
  props: {
    searchParams: Promise<{ category?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const category = searchParams.category;

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
  const [articlesRanked, manuallyFeaturedRaw, liveMatches, activeSeriesRow] = await Promise.all([
    db.select().from(articleTable)
      .where(and(...baseConditions))
      .orderBy(desc(articleTable.trendingScore), desc(articleTable.publishedAt))
      .limit(80),
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
    // section — and to "All" when no filter is set.
    fetchLiveMatches(30, category),
    // The single most recently active cricket series (cricketSeries.ts),
    // for a discovery banner under the hero — no permanent nav item for
    // this (same reasoning as the World Cup nav exclusion above: a series
    // runs for a couple of weeks then goes quiet, so a fixed link would sit
    // empty most of the time; /series stays reachable via the footer).
    category === undefined || category === "cricket"
      ? db.select({ seriesKey: articleTable.seriesKey, seriesLabel: articleTable.seriesLabel })
          .from(articleTable)
          .where(and(isNotNull(articleTable.seriesKey), eq(articleTable.status, "published")))
          .orderBy(desc(articleTable.publishedAt))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);
  const rankedIds = new Set(articlesRanked.map((a) => a.id));
  const articles = [...manuallyFeaturedRaw.filter((a) => !rankedIds.has(a.id)), ...articlesRanked];

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
  // Same fetched `articles` list re-sorted by `publishedAt`, no extra query.
  const justIn = [...articles]
    .filter((a) => a.publishedAt)
    .sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime())
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

  const allMatchArticlesFull = remainingAfterHighlighted.filter((a) => isMatchDataSource(a.sourceName));
  const allBriefArticlesFull = remainingAfterHighlighted.filter((a) => !isMatchDataSource(a.sourceName));

  // Hero carousel: manual picks (up to 5, latest first) always win the
  // first slots; any remaining slots fill with the top-ranked match
  // articles, falling back to top RSS headlines if there aren't enough
  // (cricket, right now, has no non-RSS "match" data source at all —
  // without this fallback the hero would be empty there). Capped at 5
  // slides total — enough to feel like a real rotation without turning the
  // front page into an endless slideshow.
  const heroCandidates = [...manuallyFeatured, ...allMatchArticlesFull, ...allBriefArticlesFull];
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

  const automaticHighlights = allBriefArticles
    .filter((a) => isHighlightWorthy(a.title))
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
      <InstallAppBanner />
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
              <Link href="/?category=football" style={{ textDecoration: "none" }}>
                <Chip label="Football" clickable color="primary" variant="outlined" />
              </Link>
              <Link href="/?category=cricket" style={{ textDecoration: "none" }}>
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
        {/* Split out from <main> below so it can carry its own mobile
            `order` — the hero is the site's first impression and needs to
            render immediately after the nav on mobile, ahead of the Live
            Cricket sidebar block (order -1) which itself needs to beat
            everything else in <main> (order 0, thousands of pixels down
            otherwise). Same gridColumn as <main> below so desktop/tablet
            layout is unaffected. */}
        {heroSlides.length > 0 && (
          <Box sx={{ gridColumn: { xs: "1 / -1", md: "1", lg: "2" }, order: { xs: -2, md: 0 }, minWidth: 0 }}>
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

        <Box component="main" sx={{ gridColumn: { xs: "1 / -1", md: "1", lg: "2" }, minWidth: 0 }}>
          {activeSeriesRow?.seriesKey && (
            <Link href={`/series/${activeSeriesRow.seriesKey}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  mb: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  borderColor: "primary.main",
                  transition: "background-color 0.15s",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <SportsCricketIcon sx={{ color: "primary.main" }} />
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
                  All coverage: {activeSeriesRow.seriesLabel}
                </Typography>
                <ChevronRightIcon sx={{ color: "text.secondary" }} />
              </Paper>
            </Link>
          )}

          {playerNewsMatches.length > 0 && (
            <Suspense fallback={<PlayerNewsSkeleton />}>
              <PlayerNewsSection playerNewsMatches={playerNewsMatches} />
            </Suspense>
          )}

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
                        <Stack direction="row" spacing={2}>
                          <ArticleThumb article={article} size={84} fallbackColor="#f59e0b" />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            {/* Sport/category badge at the top, same spot and
                                style "Match Results & Previews" etc. already use
                                — this is our own taxonomy, not third-party
                                attribution, so it's fine (good, even) for
                                scanning to keep it prominent up here. */}
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
                            </Stack>
                            <Typography variant="h6" component="h2" gutterBottom>
                              {article.title}
                            </Typography>
                            {article.publishedAt && (
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {article.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </Typography>
                            )}
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
                        <Stack direction="row" spacing={2}>
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
                        <Stack direction="row" spacing={2}>
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

        {(liveMatches.length > 0 || briefArticles.length > 0 || PLAYER_QUOTES.length > 0) && (
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
              // Same fix as the aside's own gridRow comment above — at md/lg
              // this block shares a column with the hero image (a separate,
              // short grid item now — see the hero Box's own comment) and
              // <main>. Without spanning both implicit rows, auto-placement
              // put this block in the same row as the hero alone, stretching
              // that row to this block's full height and pushing <main> down
              // by the difference — a large visible gap (confirmed live).
              gridRow: { md: "1 / span 2" },
              position: { md: "sticky" },
              top: { md: 84 },
            }}
          >
            {liveMatches.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <LiveScoreboardCarousel matches={liveMatches} />
              </Box>
            )}

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
            {liveMatches.length === 0 && briefArticles.length === 0 && PLAYER_QUOTES.length > 0 && (
              <QuotesStrip quotes={PLAYER_QUOTES} />
            )}
          </Box>
        )}
      </Box>

      {moreArticles.length > 0 && (
        <Box component="section" sx={{ mt: 5 }}>
          <Typography variant="h5" sx={{ ...SECTION_HEADING_SX, mb: 2 }}>
            More Headlines
          </Typography>
          <ScrollRow gap={2}>
            {moreArticles.map((article) => (
              <Card
                key={article.id}
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
                      <Image src={article.homeCrestUrl} alt={crestAltText(article.summary).home} width={32} height={32} />
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 600
                        }}>
                        vs
                      </Typography>
                      <Image src={article.awayCrestUrl} alt={crestAltText(article.summary).away} width={32} height={32} />
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
                          {article.heroImageCreditUrl ? (
                            <a
                              href={article.heroImageCreditUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "inherit" }}
                            >
                              {article.heroImageCredit}
                            </a>
                          ) : (
                            article.heroImageCredit
                          )}
                        </Typography>
                      )}
                    </Box>
                  ) : null}
                  <Typography variant="subtitle2" component="h3" gutterBottom>
                    <Link href={`/article/${article.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {article.title}
                    </Link>
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </ScrollRow>
        </Box>
      )}
    </Container>
  );
}
