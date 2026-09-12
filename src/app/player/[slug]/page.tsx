import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { TRACKED_PLAYERS } from "@/lib/players";
import { fetchPersonPhoto, sportSearchHint } from "@/lib/ingestion/wikimediaImages";
import { fetchStandingsTable, STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import { StandingsCarousel } from "@/components/StandingsCarousel";
import { PLAYER_QUOTES } from "@/lib/quotes";
import { QuotesStrip } from "@/components/QuotesStrip";
import { ArticleThumb } from "@/components/ArticleThumb";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { playerInitials, playerAvatarColor } from "@/lib/playerAvatar";
import { displaySummary } from "@/lib/articleSummary";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";

// The player's photo rarely changes day to day — an hour of staleness is a
// fine trade for not hitting the Wikimedia API on every single page view.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = TRACKED_PLAYERS.find((p) => p.slug === slug);
  if (!player) return {};
  return {
    title: `${player.name} News`,
    description: `Latest news and coverage of ${player.name}.`,
    alternates: { canonical: `/player/${player.slug}` },
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = TRACKED_PLAYERS.find((p) => p.slug === slug);
  if (!player) notFound();

  const [photo, articles] = await Promise.all([
    fetchPersonPhoto(player.name, sportSearchHint(player.sport)),
    db.article.findMany({
      where: {
        status: "published",
        OR: player.searchTerms.map((term) => ({ title: { contains: term, mode: "insensitive" as const } })),
      },
      orderBy: { publishedAt: "desc" },
      take: 30,
    }),
  ]);

  // Same sidebar content as article pages (Standings, Quotes) — a player
  // page shouldn't be a dead end either, same reasoning as the article-page
  // fix earlier today. Football-only, matching every other Standings widget
  // on the site (no standings data exists for cricket on this API tier).
  const standingsApiKey = process.env.FOOTBALL_DATA_API_KEY;
  const standings =
    player.sport === "football" && standingsApiKey ? await fetchStandingsTable(standingsApiKey, "PL") : null;

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
          <Link href="/player" style={{ color: "inherit", textDecoration: "none" }}>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", display: "block", mb: 1.5, "&:hover": { color: "primary.main" } }}
            >
              ← All Players
            </Typography>
          </Link>
          <Stack direction="row" spacing={3} sx={{ alignItems: "center", mb: 4 }}>
            {photo ? (
              <Box
                component="img"
                src={photo.url}
                alt={player.name}
                sx={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover", objectPosition: "top", flexShrink: 0 }}
              />
            ) : (
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: playerAvatarColor(player.name),
                  color: "#fff",
                  fontSize: 36,
                  fontWeight: 700,
                }}
              >
                {playerInitials(player.name)}
              </Box>
            )}
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                {player.name}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {articles.length} {articles.length === 1 ? "story" : "stories"} on Sports Wire Live
              </Typography>
            </Box>
          </Stack>

          {photo?.credit && (
            // Same minimal treatment as the image-overlay credit badges —
            // still a real, clickable attribution link, just not visually
            // competing with the player's name/stats above it.
            <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 10, display: "block", mb: 3 }}>
              <a href={photo.creditUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                {photo.credit}
              </a>
            </Typography>
          )}

          {articles.length === 0 ? (
            <Typography sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
              No stories about {player.name} yet — check back soon.
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
                          <Typography variant="h6" component="h2" gutterBottom>
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
