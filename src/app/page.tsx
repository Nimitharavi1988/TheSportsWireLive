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
import { crestAltText, competitionFromSummary } from "@/lib/teamNames";
import { displaySummary } from "@/lib/articleSummary";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { StandingsCarousel } from "@/components/StandingsCarousel";
import { SUPERSTAR_SEARCH_TERMS, TRACKED_PLAYERS } from "@/lib/players";
import { PLAYER_QUOTES } from "@/lib/quotes";
import { QuotesStrip } from "@/components/QuotesStrip";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ArticleThumb } from "@/components/ArticleThumb";
import { fetchPersonPhoto } from "@/lib/ingestion/wikimediaImages";
import { playerInitials, playerAvatarColor } from "@/lib/playerAvatar";
import StarIcon from "@mui/icons-material/Star";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArticleIcon from "@mui/icons-material/Article";

// Main-column section headers (Player News, Transfers & Big News, etc.) were
// using the theme's default h5 styling — Poppins, near-black — while the
// left rail's headers (By Category, Just In) use Inter and a muted gray.
// Standardizing the main column on the sidebar's font/color per user
// feedback, while keeping the larger h5 size so these still read as the
// primary section dividers they are.
const SECTION_HEADING_SX = { fontFamily: "var(--font-body)", color: "text.secondary" };

// "2h ago" / "3d ago" style — distinct from the "Sep 6" date chips used
// elsewhere, since the whole point of "Just In" is a freshness signal.
function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export const revalidate = 60;

const RSS_SOURCES = ["BBC Sport", "The Guardian", "Sky Sports", "ESPN Cricinfo"];

// Simple keyword match to surface transfer/retirement stories in their own
// highlighted section — these tend to be the highest-interest RSS stories.
// This catches stories by EVENT TYPE (words that show up in the headline
// regardless of who the story is about) — living config, add to it as gaps
// are found in the review queue.
const HIGHLIGHT_KEYWORDS = [
  "transfer", "sign", "signing", "signs", "deal", "retire", "retirement",
  "retires", "quits", "quit", "move to", "confirmed", "departure", "leave",
  "leaves", "exit", "farewell",
  // Deaths/tributes of sports figures are exactly the kind of major story
  // this section exists to surface — real sports journalism, not gossip.
  "dies", "dead at", "death of", "passes away", "obituary", "tribute",
  "tributes",
  // Records/milestones — another class of story that's always high-interest
  // regardless of which player it's about.
  "record", "milestone", "history", "historic", "breaks", "first player",
  "youngest", "oldest", "hat-trick", "hat trick",
];

function isHighlightWorthy(title: string): boolean {
  const lower = title.toLowerCase();
  if (HIGHLIGHT_KEYWORDS.some((kw) => lower.includes(kw))) return true;
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
};

export async function generateMetadata(
  props: {
    searchParams: Promise<{ category?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const meta = searchParams.category ? CATEGORY_META[searchParams.category] : undefined;
  if (!meta) return {};
  return {
    title: meta.title,
    description: meta.description,
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

  const articles = await db.article.findMany({
    where: {
      status: "published",
      ...(category ? { category: { startsWith: category } } : {}),
    },
    orderBy: [{ trendingScore: "desc" }, { publishedAt: "desc" }],
    take: 80,
  });

  // For each tracked player, find their single most prominent recent
  // article (reusing the already-fetched, trending-sorted `articles` list —
  // no extra queries) and show that real headline instead of a bare
  // nav-shortcut chip. Players with nothing recent are left out entirely,
  // since an empty card under a "Player News" heading would be confusing.
  const playerNewsMatches = TRACKED_PLAYERS.map((player) => {
    const match = articles.find((a) =>
      player.searchTerms.some((term) => a.title.toLowerCase().includes(term.toLowerCase()))
    );
    return match ? { player, article: match } : null;
  }).filter((entry): entry is { player: (typeof TRACKED_PLAYERS)[number]; article: (typeof articles)[number] } => entry !== null);

  // Real Wikimedia photo per player, same source the player's own page uses
  // — previously this rail showed a generic colored-initials avatar even for
  // players whose own page already has a real photo, which read as
  // inconsistent when you clicked through. Falls back to the initials
  // avatar (rendered below) when no free-licensed photo is found.
  const playerNewsPhotos = await Promise.all(
    playerNewsMatches.map((entry) => fetchPersonPhoto(entry.player.name))
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
  const briefArticles = allBriefArticles.filter((a) => !highlightIds.has(a.id));

  const matchArticles = allMatchArticles.slice(0, 10);
  const moreArticles = allMatchArticles.slice(10, 25);

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

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
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
        {((standings && standings.rows.length > 0) || categoryTiles.length > 0 || justIn.length > 0 || PLAYER_QUOTES.length > 0) && (
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
                  <Card key={article.id} variant="outlined" sx={{ borderColor: "warning.main" }}>
                    <CardContent>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
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
                        <Link href={`/article/${article.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {article.title}
                        </Link>
                      </Typography>
                    </CardContent>
                  </Card>
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
                  <Card key={article.id} variant="outlined">
                    <CardContent>
                      {article.homeCrestUrl && article.awayCrestUrl ? (
                        <Stack
                          direction="row"
                          spacing={1.5}
                          sx={{
                            alignItems: "center",
                            mb: 1.5
                          }}>
                          <img src={article.homeCrestUrl} alt={crestAltText(article.summary).home} width={40} height={40} />
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontWeight: 600
                            }}>
                            vs
                          </Typography>
                          <img src={article.awayCrestUrl} alt={crestAltText(article.summary).away} width={40} height={40} />
                        </Stack>
                      ) : article.heroImageUrl ? (
                        <Box
                          component="img"
                          src={article.heroImageUrl}
                          alt={article.title}
                          sx={{ width: "100%", height: 160, objectFit: "cover", objectPosition: "top", borderRadius: 1, mb: 1.5 }}
                        />
                      ) : null}
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
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
                        <Link href={`/article/${article.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {article.title}
                        </Link>
                      </Typography>
                      <Typography variant="body2" sx={{
                        color: "text.secondary"
                      }}>
                        {displaySummary(article)}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}
        </Box>

        {briefArticles.length > 0 && (
          <Paper
            component="aside"
            variant="outlined"
            sx={{
              p: 3,
              gridColumn: { xs: "1 / -1", md: "2", lg: "3" },
              position: { md: "sticky" },
              // Same 68px header + 16px gap fix as the left rail.
              top: { md: 84 },
            }}
          >
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.5 }}>
              <ArticleIcon sx={{ fontSize: 18, color: "primary.main" }} />
              <Typography variant="h6" sx={{ fontSize: 17 }}>
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
                    <Box
                      component="img"
                      src={article.heroImageUrl}
                      alt={article.title}
                      sx={{ width: "100%", height: 110, objectFit: "cover", objectPosition: "top", borderRadius: 1, mb: 1 }}
                    />
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
