import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { TRACKED_CLUBS } from "@/lib/clubs";
import { crestAltText } from "@/lib/teamNames";
import { fetchStandingsTable, STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import { StandingsCarousel } from "@/components/StandingsCarousel";
import { PLAYER_QUOTES } from "@/lib/quotes";
import { QuotesStrip } from "@/components/QuotesStrip";
import { ArticleThumb } from "@/components/ArticleThumb";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { displaySummary } from "@/lib/articleSummary";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = TRACKED_CLUBS.find((c) => c.slug === slug);
  if (!club) return {};
  return {
    title: `${club.name} News`,
    description: `Latest news and results for ${club.name}.`,
  };
}

// Clubs don't have a Wikimedia-style dedicated portrait fetch like players —
// their crest already appears on every match article they're in
// (homeCrestUrl/awayCrestUrl). Picks the club's own crest out of whichever
// side of the most recent matching article it actually was, using the same
// summary-parsing `crestAltText` already relies on, rather than guessing.
function findClubCrest(club: { searchTerms: string[] }, articles: { summary: string; homeCrestUrl: string | null; awayCrestUrl: string | null }[]) {
  for (const article of articles) {
    if (!article.homeCrestUrl || !article.awayCrestUrl) continue;
    const { home, away } = crestAltText(article.summary);
    const isHome = club.searchTerms.some((term) => home.toLowerCase().includes(term.toLowerCase()));
    if (isHome) return article.homeCrestUrl;
    const isAway = club.searchTerms.some((term) => away.toLowerCase().includes(term.toLowerCase()));
    if (isAway) return article.awayCrestUrl;
  }
  return null;
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = TRACKED_CLUBS.find((c) => c.slug === slug);
  if (!club) notFound();

  const articles = await db.article.findMany({
    where: {
      status: "published",
      OR: club.searchTerms.map((term) => ({ title: { contains: term, mode: "insensitive" as const } })),
    },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });

  const crestUrl = findClubCrest(club, articles);

  const standingsApiKey = process.env.FOOTBALL_DATA_API_KEY;
  const standings = standingsApiKey ? await fetchStandingsTable(standingsApiKey, "PL") : null;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 300px" },
          gap: 4,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={3} sx={{ alignItems: "center", mb: 4 }}>
            {crestUrl ? (
              <Box component="img" src={crestUrl} alt={`${club.name} crest`} sx={{ width: 96, height: 96, objectFit: "contain", flexShrink: 0 }} />
            ) : (
              <Box
                sx={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  flexShrink: 0,
                  bgcolor: "rgba(29, 107, 63, 0.08)",
                }}
              />
            )}
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                {club.name}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {articles.length} {articles.length === 1 ? "story" : "stories"} on Sports Wire Live
              </Typography>
            </Box>
          </Stack>

          {articles.length === 0 ? (
            <Typography sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
              No stories about {club.name} yet — check back soon.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {articles.map((article) => (
                <Link key={article.id} href={`/article/${article.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <Card variant="outlined" sx={{ "&:hover": { borderColor: "primary.main" } }}>
                    <CardContent>
                      <Stack direction="row" spacing={2}>
                        <ArticleThumb article={article} size={64} fallbackColor={categoryChipStyle(article.category).color} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                            <Chip label={article.sourceName} size="small" variant="outlined" sx={{ color: "primary" }} />
                            {article.publishedAt && (
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {article.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </Typography>
                            )}
                          </Stack>
                          <Typography variant="h6" component="h2" gutterBottom sx={{ fontSize: 18 }}>
                            {article.title}
                          </Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {displaySummary(article)}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </Stack>
          )}
        </Box>

        <Box component="aside">
          {standings && standings.rows.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <StandingsCarousel leagues={STANDINGS_LEAGUES} initialCode="PL" initialTable={standings} />
            </Box>
          )}
          {PLAYER_QUOTES.length > 0 && <QuotesStrip quotes={PLAYER_QUOTES} />}
        </Box>
      </Box>
    </Container>
  );
}
