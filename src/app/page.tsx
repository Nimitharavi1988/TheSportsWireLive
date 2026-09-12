import { db } from "@/lib/db";
import Link from "next/link";
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
import { EVENT_KEYWORDS } from "@/lib/eventKeywords";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { StandingsCarousel } from "@/components/StandingsCarousel";
import { SUPERSTAR_SEARCH_TERMS, TRACKED_PLAYERS } from "@/lib/players";
import { PLAYER_QUOTES } from "@/lib/quotes";
import { QuotesStrip } from "@/components/QuotesStrip";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ArticleThumb } from "@/components/ArticleThumb";
import { fetchPersonPhoto, sportSearchHint } from "@/lib/ingestion/wikimediaImages";
import { SentimentLeaderboard } from "@/components/SentimentLeaderboard";
import { LiveScoreboardCarousel } from "@/components/LiveScoreboardCarousel";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { fetchLiveCricketMatches } from "@/lib/liveCricket";
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
// primary section dividers they are.
const SECTION_HEADING_SX = { fontFamily: "var(--font-body)", color: "text.secondary" };

export const revalidate = 60;

// "ESPN" covers both the soccer feed and the new NFL news feed (rssFeeds.ts)
// — both are genuine RSS editorial news, not structured match data, so both
// belong in the sidebar/highlight sections, not mixed into the crest-based
// Match Results/NFL Scores sections. Discovered while adding NFL news that
// "ESPN" (soccer) was missing from this list already — a pre-existing gap
// this also fixes, not something new-sport-specific.
const RSS_SOURCES = ["BBC Sport", "The Guardian", "Sky Sports", "ESPN Cricinfo", "ESPN"];

function isHighlightWorthy(title: string): boolean {
  const lower = title.toLowerCase();
  if (EVENT_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  // Unlike HIGHLIGHT_KEYWORDS, this catches stories by WHO they're about —
  // "record" or "transfer" shows up literally in a headline, but a match
  // report or interview about a superstar player often doesn't contain any
  // special trigger word at all. Shares its list (players.ts) with the
  // /player/[slug] pages so the two never drift apart.
  return SUPERSTAR_SEARCH_TERMS.some((term) => lower.includes(term.toLowerCase()));
}

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

export default async function HomePage(
  props: {
    searchParams: Promise<{ category?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const category = searchParams.category;

  const articleWhere = {
    status: "published" as const,
    ...(category ? { category: { startsWith: category } } : {}),
  };

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
  const [articlesRanked, manuallyFeaturedRaw, liveCricketMatches, activeSeriesRow] = await Promise.all([
    db.article.findMany({
      where: articleWhere,
      orderBy: [{ trendingScore: "desc" }, { publishedAt: "desc" }],
      take: 80,
    }),
    db.article.findMany({
      where: { ...articleWhere, featured: true },
      orderBy: { featuredAt: "desc" },
      take: 5,
    }),
    // Capped at 6 — the right-sidebar carousel cycles through these one at
    // a time via prev/next arrows, so a slightly higher cap than a stacked
    // list doesn't cost extra vertical space. Only fetched on "All" or
    // "Cricket" — showing cricket scores while browsing a Football-only or
    // NFL-only view read as wrong/out of place (same rule /scores already
    // follows for its own in-progress section).
    // Not just a "top few" — a real Test match runs 5 days, so it sorts
    // toward the back of a kickoffAt-desc order behind every shorter-format
    // domestic match that started more recently. A low cap silently cut
    // international Tests out of the carousel entirely; this is cheap
    // enough to just fetch everything currently live instead.
    category === undefined || category === "cricket" ? fetchLiveCricketMatches(30) : Promise.resolve([]),
    // The single most recently active cricket series (cricketSeries.ts),
    // for a discovery banner under the hero — no permanent nav item for
    // this (same reasoning as the World Cup nav exclusion above: a series
    // runs for a couple of weeks then goes quiet, so a fixed link would sit
    // empty most of the time; /series stays reachable via the footer).
    category === undefined || category === "cricket"
      ? db.article.findFirst({
          where: { seriesKey: { not: null }, status: "published" },
          orderBy: { publishedAt: "desc" },
          select: { seriesKey: true, seriesLabel: true },
        })
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

  // Real Wikimedia photo per player, same source the player's own page uses
  // — previously this rail showed a generic colored-initials avatar even for
  // players whose own page already has a real photo, which read as
  // inconsistent when you clicked through. Falls back to the initials
  // avatar (rendered below) when no free-licensed photo is found.
  const playerNewsPhotos = await Promise.all(
    playerNewsMatches.map((entry) => fetchPersonPhoto(entry.player.name, sportSearchHint(entry.player.sport)))
  );
  const playerNews = playerNewsMatches.map((entry, i) => ({ ...entry, photo: playerNewsPhotos[i] }));

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
  const manuallyFeatured = articles
    .filter((a) => a.featured)
    .sort((a, b) => (b.featuredAt?.getTime() ?? 0) - (a.featuredAt?.getTime() ?? 0));
  const manuallyFeaturedIds = new Set(manuallyFeatured.map((a) => a.id));
  const remainingAfterFeatured = articles.filter((a) => !manuallyFeaturedIds.has(a.id));

  // Manually-highlighted articles (set from /admin) are pinned into
  // "Transfers & Big News" alongside — not instead of — the automatic
  // keyword match, most-recently-picked first, capped at 4 total so the
  // section can't grow unbounded.
  const manuallyHighlighted = remainingAfterFeatured
    .filter((a) => a.highlighted)
    .sort((a, b) => (b.highlightedAt?.getTime() ?? 0) - (a.highlightedAt?.getTime() ?? 0))
    .slice(0, 4);
  const manuallyHighlightedIds = new Set(manuallyHighlighted.map((a) => a.id));
  const remainingAfterHighlighted = remainingAfterFeatured.filter((a) => !manuallyHighlightedIds.has(a.id));

  const allMatchArticlesFull = remainingAfterHighlighted.filter((a) => !RSS_SOURCES.includes(a.sourceName));
  const allBriefArticlesFull = remainingAfterHighlighted.filter((a) => RSS_SOURCES.includes(a.sourceName));

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
  const moreArticles = allFootballCricketArticles.slice(10, 25);
  const nflArticles = allNflArticles.slice(0, 10);

  // Only fetch a generic stock photo per slide when there's no real image to
  // show instead — a match article with real team crests shouldn't also get
  // an unrelated random stadium photo layered on top of them. Runs for every
  // hero slide (not just one), but each is a cheap, free-tier Pexels call
  // and there are at most 5 slides.
  const heroSlides = await Promise.all(
    heroArticles.map(async (article) => {
      const hasCrests = Boolean(article.homeCrestUrl && article.awayCrestUrl);
      const banner = !hasCrests && !article.heroImageUrl ? await fetchOneStockImage(article.category) : null;
      return { article, banner };
    })
  );

  // Standings only exist for domestic leagues on this API tier (not Champions
  // League/World Cup/Euros — no data — and cricket has no active standings
  // source at all), so only show this on "All" or the plain "Football" filter.
  const showStandings = !category || category === "football";
  const standingsApiKey = process.env.FOOTBALL_DATA_API_KEY;
  const standings =
    showStandings && standingsApiKey ? await fetchStandingsTable(standingsApiKey, "PL") : null;

  // NFL's left rail was otherwise nearly empty (Standings is football-only,
  // By Category/Competition are "All"-view-only) — real conference standings
  // data, same ESPN source nflData.ts already draws on for match context.
  const nflStandings = category === "american-football" ? await fetchNflStandingsTable() : null;

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
        {((standings && standings.rows.length > 0) || (nflStandings && nflStandings.length > 0) || categoryTiles.length > 0 || justIn.length > 0 || PLAYER_QUOTES.length > 0) && (
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
            {standings && standings.rows.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <StandingsCarousel leagues={STANDINGS_LEAGUES} initialCode="PL" initialTable={standings} />
              </Box>
            )}

            {nflStandings && nflStandings.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <NflStandingsCarousel conferences={nflStandings} />
              </Box>
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
        <Box component="main" sx={{ gridColumn: { xs: "1 / -1", md: "1", lg: "2" }, minWidth: 0 }}>
          {heroSlides.length > 0 && (
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
          )}

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

          {playerNews.length > 0 && (
            <Box component="section" sx={{ mb: 4 }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
                <StarIcon sx={{ fontSize: 20, color: "primary.main" }} />
                <Typography variant="h5" sx={SECTION_HEADING_SX}>Player News</Typography>
              </Stack>
              <Box
                sx={{
                  display: "flex",
                  gap: 1.5,
                  overflowX: "auto",
                  pb: 1,
                  "&::-webkit-scrollbar": { height: 8 },
                  "&::-webkit-scrollbar-thumb": { backgroundColor: "divider", borderRadius: 4 },
                }}
              >
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
                            component="img"
                            src={photo.url}
                            alt={player.name}
                            sx={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", objectPosition: "top", flexShrink: 0 }}
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
              </Box>
            </Box>
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
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}>
                              <Chip label={article.sourceName} size="small" variant="outlined" sx={{
                                color: "warning"
                              }} />
                              {article.highlighted && <Chip label="📌 Editor's pick" size="small" sx={{
                                color: "warning"
                              }} />}
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

        {(liveCricketMatches.length > 0 || briefArticles.length > 0) && (
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
              position: { md: "sticky" },
              top: { md: 84 },
            }}
          >
            {liveCricketMatches.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <LiveScoreboardCarousel matches={liveCricketMatches} />
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
                        <Chip
                          label={article.sourceName}
                          size="small"
                          variant="outlined"
                          sx={{ height: 16, fontSize: 9, "& .MuiChip-label": { px: 0.75 } }}
                        />
                      </Box>
                    </Stack>
                  </Link>
                </Box>
              ))}
            </Stack>
              </Paper>
            )}
          </Box>
        )}
      </Box>

      {moreArticles.length > 0 && (
        <Box component="section" sx={{ mt: 5 }}>
          <Typography variant="h5" sx={{ ...SECTION_HEADING_SX, mb: 2 }}>
            More Headlines
          </Typography>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              overflowX: "auto",
              pb: 1,
              "&::-webkit-scrollbar": { height: 8 },
              "&::-webkit-scrollbar-thumb": { backgroundColor: "divider", borderRadius: 4 },
            }}
          >
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
                      <img src={article.homeCrestUrl} alt={crestAltText(article.summary).home} width={32} height={32} />
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 600
                        }}>
                        vs
                      </Typography>
                      <img src={article.awayCrestUrl} alt={crestAltText(article.summary).away} width={32} height={32} />
                    </Stack>
                  ) : article.heroImageUrl ? (
                    // height:110 on a 260-wide card was a 2.36:1 crop —
                    // checked directly against a real portrait photo (330x495
                    // Wikimedia source): that only showed the top 32% of the
                    // image, cutting well below the chin on most headshots.
                    // 190 brings visible coverage up to ~55%, close to what
                    // ArticleThumb's own square crop shows (~67%) for the
                    // same source.
                    <Box sx={{ position: "relative", mb: 1 }}>
                      <Box
                        component="img"
                        src={article.heroImageUrl}
                        alt={article.title}
                        sx={{ width: "100%", height: 190, objectFit: "cover", objectPosition: "top", borderRadius: 1, display: "block" }}
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
          </Box>
        </Box>
      )}
    </Container>
  );
}
