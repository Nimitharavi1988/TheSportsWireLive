import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { TRACKED_CLUBS } from "@/lib/clubs";
import { titleMatchesAnyTerm } from "@/lib/titleMatch";
import { findClubCrest } from "@/lib/teamNames";
import { fetchStandingsTable, STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import { StandingsCarousel } from "@/components/StandingsCarousel";
import type { NflConferenceStandings } from "@/lib/ingestion/nflData";
import { SNAPSHOT_KEYS, readSnapshot } from "@/lib/snapshots/read";
import { NflStandingsCarousel } from "@/components/NflStandingsCarousel";
import type { NbaConferenceStandings } from "@/lib/ingestion/nbaData";
import { NbaStandingsCarousel } from "@/components/NbaStandingsCarousel";
import type { MlbConferenceStandings } from "@/lib/ingestion/mlbData";
import { MlbStandingsCarousel } from "@/components/MlbStandingsCarousel";
import type { NhlConferenceStandings } from "@/lib/ingestion/nhlData";
import { NhlStandingsCarousel } from "@/components/NhlStandingsCarousel";
import { PLAYER_QUOTES } from "@/lib/quotes";
import { QuotesStrip } from "@/components/QuotesStrip";
import { ArticleThumb } from "@/components/ArticleThumb";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { displaySummary } from "@/lib/articleSummary";
import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { FollowButton } from "@/components/FollowButton";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";

export const revalidate = 300;

// Declaring this (even empty) is what makes Next cache this route: each
// page renders on its first visit, then is served from cache and
// re-rendered in the background every `revalidate` seconds. Without it,
// every visit rendered from scratch (measured 2026-09-26: up to 2.2s).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = TRACKED_CLUBS.find((c) => c.slug === slug);
  if (!club) return {};
  // Was `"${club.name} News"` / `"Latest news and results for
  // ${club.name}."` — same Bing "too short" warning as player pages (this
  // template runs for every one of the ~150+ tracked clubs, a real
  // contributor to the "many pages" scope). `?? "football"` matches this
  // file's own club.sport fallback used elsewhere (clubs.ts: the original
  // ~22 soccer entries have no explicit sport field).
  const sportLabel = categoryChipStyle(club.sport ?? "football").label;
  return {
    title: `${club.name} News, Fixtures & Latest ${sportLabel} Results`,
    description: `Follow the latest ${club.name} news, match results, transfer updates, and fixtures — automatically updated on Sports Wire Live.`,
    alternates: { canonical: `/club/${club.slug}` },
  };
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = TRACKED_CLUBS.find((c) => c.slug === slug);
  if (!club) notFound();

  const articles = await db.select().from(article)
    .where(and(
      eq(article.status, "published"),
      titleMatchesAnyTerm(club.searchTerms)
    ))
    .orderBy(desc(article.publishedAt))
    .limit(30);

  const crestUrl = findClubCrest(club, articles);

  // Sport-aware standings widget — was hardcoded to Premier League
  // regardless of the club (confirmed live, a real bug: any non-PL club's
  // page showed PL standings). `sport` defaults to "football" for the
  // original hand-curated entries (added before this field existed), which
  // is genuinely correct for all of them (they're all football clubs, just
  // predating the sport tag). Reuses the exact standings fetchers/carousels
  // already built for the homepage's own per-category widgets.
  const clubSport = club.sport ?? "football";
  const standingsApiKey = process.env.FOOTBALL_DATA_API_KEY;
  const footballStandings = clubSport === "football" && standingsApiKey ? await fetchStandingsTable(standingsApiKey, "PL") : null;
  // Stored copies written by the ingestion job (snapshots/read.ts).
  const nflStandings = clubSport === "american-football" ? await readSnapshot<NflConferenceStandings[]>(SNAPSHOT_KEYS.nflStandings) : null;
  const nbaStandings = clubSport === "basketball" ? await readSnapshot<NbaConferenceStandings[]>(SNAPSHOT_KEYS.nbaStandings) : null;
  const mlbStandings = clubSport === "baseball" ? await readSnapshot<MlbConferenceStandings[]>(SNAPSHOT_KEYS.mlbStandings) : null;
  const nhlStandings = clubSport === "hockey" ? await readSnapshot<NhlConferenceStandings[]>(SNAPSHOT_KEYS.nhlStandings) : null;

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const breadcrumbSteps = [
    { name: "Home", href: "/" },
    { name: "Clubs", href: "/club" },
  ];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    breadcrumbSteps,
    { name: club.name, href: `/club/${club.slug}` },
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
          <SiteBreadcrumbs steps={breadcrumbSteps} current={club.name} />
          <Stack direction="row" spacing={3} sx={{ alignItems: "center", mb: 4 }}>
            {crestUrl ? (
              <Box component={Image} src={crestUrl} alt={`${club.name} crest`} width={96} height={96} sx={{ objectFit: "contain", flexShrink: 0 }} />
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
              <Box sx={{ mt: 1.5 }}>
                <FollowButton kind="club" slug={club.slug} name={club.name} size="medium" />
              </Box>
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
                      {/* alignItems: "center" -- without it this fixed-
                          height thumbnail sits top-aligned against the
                          taller title+summary text beside it, a visible
                          empty gap whenever the text runs longer than the
                          thumbnail (confirmed live 2026-09-24, same root
                          cause fixed in 8 places site-wide). */}
                      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
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
          {footballStandings && footballStandings.rows.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <StandingsCarousel leagues={STANDINGS_LEAGUES} initialCode="PL" initialTable={footballStandings} />
            </Box>
          )}
          {nflStandings && nflStandings.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <NflStandingsCarousel conferences={nflStandings} />
            </Box>
          )}
          {nbaStandings && nbaStandings.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <NbaStandingsCarousel conferences={nbaStandings} />
            </Box>
          )}
          {mlbStandings && mlbStandings.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <MlbStandingsCarousel conferences={mlbStandings} />
            </Box>
          )}
          {nhlStandings && nhlStandings.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <NhlStandingsCarousel conferences={nhlStandings} />
            </Box>
          )}
          {PLAYER_QUOTES.length > 0 && <QuotesStrip quotes={PLAYER_QUOTES} />}
        </Box>
      </Box>
    </Container>
  );
}
