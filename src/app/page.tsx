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
import { crestAltText } from "@/lib/teamNames";
import { CompactStandingsTable } from "@/components/StandingsTable";

export const revalidate = 60;

const RSS_SOURCES = ["BBC Sport", "The Guardian", "Sky Sports", "ESPN Cricinfo"];

// Simple keyword match to surface transfer/retirement stories in their own
// highlighted section — these tend to be the highest-interest RSS stories.
const HIGHLIGHT_KEYWORDS = [
  "transfer", "sign", "signing", "signs", "deal", "retire", "retirement",
  "retires", "quits", "quit", "move to", "confirmed", "departure", "leave",
  "leaves", "exit", "farewell",
];

function isHighlightWorthy(title: string): boolean {
  const lower = title.toLowerCase();
  return HIGHLIGHT_KEYWORDS.some((kw) => lower.includes(kw));
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

  // A manually-featured article (set from /admin) always wins as hero;
  // otherwise fall back to the top-ranked match article automatically.
  const manuallyFeatured = articles.find((a) => a.featured);
  const remainingAfterFeatured = manuallyFeatured
    ? articles.filter((a) => a.id !== manuallyFeatured.id)
    : articles;

  // Manually-highlighted articles (set from /admin) are pinned into
  // "Transfers & Big News" alongside — not instead of — the automatic
  // keyword match, capped at 4 total so the section can't grow unbounded.
  const manuallyHighlighted = remainingAfterFeatured.filter((a) => a.highlighted).slice(0, 4);
  const manuallyHighlightedIds = new Set(manuallyHighlighted.map((a) => a.id));
  const remainingAfterHighlighted = remainingAfterFeatured.filter((a) => !manuallyHighlightedIds.has(a.id));

  const allMatchArticlesFull = remainingAfterHighlighted.filter((a) => !RSS_SOURCES.includes(a.sourceName));
  const allBriefArticlesFull = remainingAfterHighlighted.filter((a) => RSS_SOURCES.includes(a.sourceName));

  // Hero: a manual pick always wins; otherwise the top-ranked match article.
  // Some categories (cricket, right now) have no non-RSS "match" data source
  // at all, so without this second fallback the hero section would just be
  // empty there — fall back to the top RSS headline instead.
  const heroArticle = manuallyFeatured ?? allMatchArticlesFull[0] ?? allBriefArticlesFull[0];
  const allMatchArticles = allMatchArticlesFull.filter((a) => a.id !== heroArticle?.id);
  const allBriefArticles = allBriefArticlesFull.filter((a) => a.id !== heroArticle?.id);

  const automaticHighlights = allBriefArticles
    .filter((a) => isHighlightWorthy(a.title))
    .slice(0, Math.max(0, 4 - manuallyHighlighted.length));
  const highlightArticles = [...manuallyHighlighted, ...automaticHighlights];
  const highlightIds = new Set(highlightArticles.map((a) => a.id));
  const briefArticles = allBriefArticles.filter((a) => !highlightIds.has(a.id));

  const matchArticles = allMatchArticles.slice(0, 10);
  const moreArticles = allMatchArticles.slice(10, 25);

  // Only fetch a generic stock photo for the hero when there's no real image
  // to show instead — a match article with real team crests shouldn't also
  // get an unrelated random stadium photo layered on top of them.
  const heroHasCrests = Boolean(heroArticle?.homeCrestUrl && heroArticle?.awayCrestUrl);
  const heroBanner =
    heroArticle && !heroHasCrests && !heroArticle.heroImageUrl
      ? await fetchOneStockImage(heroArticle.category)
      : null;

  // Standings only exist for domestic leagues on this API tier (not Champions
  // League/World Cup/Euros — no data — and cricket has no active standings
  // source at all), so only show this on "All" or the plain "Football" filter.
  const showStandings = !category || category === "football";
  const standingsApiKey = process.env.FOOTBALL_DATA_API_KEY;
  const standings =
    showStandings && standingsApiKey ? await fetchStandingsTable(standingsApiKey, "PL") : null;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {articles.length === 0 && (
        <Typography
          align="center"
          sx={{
            color: "text.secondary",
            py: 5
          }}>
          {category
            ? "No published articles in this category yet."
            : "No articles published yet — approve some in /admin to see them here."}
        </Typography>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
          gap: 5,
          alignItems: "start",
        }}
      >
        <Box component="main">
          {heroArticle && (
            <Card variant="outlined" sx={{ mb: 4, borderColor: "primary.main", borderWidth: 2 }}>
              {(heroBanner || heroArticle.heroImageUrl) && (
                <Box
                  component="img"
                  src={heroBanner?.url ?? heroArticle.heroImageUrl!}
                  alt={heroArticle.title}
                  sx={{ width: "100%", height: 320, objectFit: "cover", display: "block" }}
                />
              )}
              <CardContent sx={{ p: 3 }}>
                {heroArticle.homeCrestUrl && heroArticle.awayCrestUrl && (
                  <Stack
                    direction="row"
                    spacing={2.5}
                    sx={{
                      alignItems: "center",
                      mb: 2
                    }}>
                    <img src={heroArticle.homeCrestUrl} alt={crestAltText(heroArticle.summary).home} width={96} height={96} />
                    <Typography
                      variant="h6"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 600
                      }}>
                      vs
                    </Typography>
                    <img src={heroArticle.awayCrestUrl} alt={crestAltText(heroArticle.summary).away} width={96} height={96} />
                  </Stack>
                )}
                <Chip
                  label="Top Story"
                  size="small"
                  sx={{
                    color: "primary",
                    mb: 1
                  }} />
                <Typography variant="h4" component="h2" gutterBottom>
                  <Link href={`/article/${heroArticle.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {heroArticle.title}
                  </Link>
                </Typography>
                <Typography variant="body1" sx={{
                  color: "text.secondary"
                }}>
                  {heroArticle.summary}
                </Typography>
              </CardContent>
              {heroBanner?.credit && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    px: 3,
                    pb: 2,
                    display: "block"
                  }}>
                  <a href={heroBanner.creditUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                    {heroBanner.credit}
                  </a>
                </Typography>
              )}
            </Card>
          )}

          {highlightArticles.length > 0 && (
            <Box component="section" sx={{ mb: 4 }}>
              <Typography variant="h5" sx={{ mb: 2 }}>
                Transfers &amp; Big News
              </Typography>
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

          {standings && standings.rows.length > 0 && (
            <Box component="section" sx={{ mb: 4 }}>
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  mb: 2
                }}>
                <Typography variant="h5">{standings.competitionName} Standings</Typography>
                <Link href="/standings/PL" style={{ color: "inherit" }}>
                  <Typography variant="body2" sx={{
                    color: "primary.main"
                  }}>
                    Full table →
                  </Typography>
                </Link>
              </Stack>
              <CompactStandingsTable rows={standings.rows.slice(0, 6)} />
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
                {STANDINGS_LEAGUES.filter((l) => l.code !== "PL").map((league) => (
                  <Link key={league.code} href={`/standings/${league.code}`} style={{ textDecoration: "none" }}>
                    <Chip label={league.name} size="small" variant="outlined" clickable />
                  </Link>
                ))}
              </Box>
            </Box>
          )}

          {matchArticles.length > 0 && (
            <Box component="section">
              <Typography variant="h5" sx={{ mb: 2 }}>
                Match Results &amp; Previews
              </Typography>
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
                          sx={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 1, mb: 1.5 }}
                        />
                      ) : null}
                      <Chip
                        label={article.category}
                        size="small"
                        variant="outlined"
                        sx={{
                          color: "primary",
                          mb: 1
                        }} />
                      <Typography variant="h6" component="h2" gutterBottom>
                        <Link href={`/article/${article.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {article.title}
                        </Link>
                      </Typography>
                      <Typography variant="body2" sx={{
                        color: "text.secondary"
                      }}>
                        {article.summary}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}
        </Box>

        {briefArticles.length > 0 && (
          <Paper component="aside" variant="outlined" sx={{ p: 3, position: { md: "sticky" }, top: { md: 32 } }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              In Brief
            </Typography>
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
                    <Box sx={{ py: 0.5 }}>
                      <Typography variant="body2" gutterBottom sx={{
                        fontWeight: 500
                      }}>
                        {article.title}
                      </Typography>
                      <Chip
                        label={article.sourceName}
                        size="small"
                        variant="outlined"
                        sx={{ height: 16, fontSize: 9, "& .MuiChip-label": { px: 0.75 } }}
                      />
                    </Box>
                  </Link>
                </Box>
              ))}
            </Stack>
          </Paper>
        )}
      </Box>

      {moreArticles.length > 0 && (
        <Box component="section" sx={{ mt: 5 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
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
                      sx={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 1, mb: 1 }}
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
