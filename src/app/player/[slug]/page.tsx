import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, or, ilike, desc } from "drizzle-orm";
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
import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";

// Was 3600 (an hour) -- reasonable for the player's own photo (rarely
// changes day to day), but this page also embeds the live standings
// widget for football players, and ISR's revalidate applies to the whole
// page: confirmed live that a stale standings table (showing a
// since-corrected points total) was visible here because of this. Lowered
// to 300 so the standings stay reasonably current -- accuracy on genuinely
// live sports data matters more than saving a Wikimedia lookup, which is
// cheap/unrated-limited anyway (unlike football-data.org's own free tier).
export const revalidate = 300;

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
    db.select().from(article)
      .where(and(
        eq(article.status, "published"),
        or(...player.searchTerms.map((term) => ilike(article.title, `%${term}%`)))
      ))
      .orderBy(desc(article.publishedAt))
      .limit(30),
  ]);

  // Same sidebar content as article pages (Standings, Quotes) — a player
  // page shouldn't be a dead end either, same reasoning as the article-page
  // fix earlier today. Football-only, matching every other Standings widget
  // on the site (no standings data exists for cricket on this API tier).
  const standingsApiKey = process.env.FOOTBALL_DATA_API_KEY;
  const standings =
    player.sport === "football" && standingsApiKey ? await fetchStandingsTable(standingsApiKey, "PL") : null;

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const breadcrumbSteps = [
    { name: "Home", href: "/" },
    { name: "Players", href: "/player" },
  ];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    breadcrumbSteps,
    { name: player.name, href: `/player/${player.slug}` },
    siteUrl
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 300px" },
          gap: 4,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <SiteBreadcrumbs steps={breadcrumbSteps} current={player.name} />
          <Stack direction="row" spacing={3} sx={{ alignItems: "center", mb: 4 }}>
            {photo ? (
              <Box
                component={Image}
                src={photo.url}
                alt={player.name}
                width={120}
                height={120}
                priority
                sx={{ borderRadius: "50%", objectFit: "cover", objectPosition: "top", flexShrink: 0 }}
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
              <a href={photo.creditUrl} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
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
                          {/* Sport/category badge at the top — our own
                              taxonomy, not third-party attribution, so it's
                              fine to keep prominent for scanning, same as
                              every other section on the site. */}
                          <Chip
                            label={categoryChipStyle(article.category).label}
                            size="small"
                            variant="outlined"
                            sx={{
                              mb: 1,
                              color: categoryChipStyle(article.category).color,
                              borderColor: categoryChipStyle(article.category).color,
                              fontWeight: 600,
                            }}
                          />
                          <Typography variant="h6" component="h2" gutterBottom>
                            {article.title}
                          </Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {displaySummary(article)}
                          </Typography>
                          {article.publishedAt && (
                            <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block" }}>
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
