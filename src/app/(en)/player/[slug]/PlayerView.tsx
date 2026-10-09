import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, desc, or } from "drizzle-orm";
import { TRACKED_PLAYERS } from "@/lib/players";
import { titleMatchesAnyTerm } from "@/lib/titleMatch";
import { taggedWith } from "@/lib/tags";
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
import { getDict } from "@/lib/i18n/dictionary";
import { categoryLabel } from "@/lib/i18n/helpers";
import { LOCALES } from "@/lib/i18n/locales";
import { editionConditions, fetchTranslationMap, inEdition, localizeRow } from "@/lib/i18n/overlay";
import { FollowButton } from "@/components/FollowButton";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { fetchPlayerProfile } from "@/lib/profiles";
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
export async function playerMetadata(slug: string, locale?: string) {
  const player = TRACKED_PLAYERS.find((p) => p.slug === slug);
  if (!player || !inEdition(player.sport, locale)) return {};
  const t = getDict(locale);
  const sportLabel = locale ? categoryLabel(player.sport, t) : categoryChipStyle(player.sport).label;
  const role = player.role === "coach" ? (locale ? ` (${t.entity.coach})` : " (Coach)") : "";
  // With an approved profile, the search snippet is its opening sentence(s) instead of the generic line.
  const profile = locale ? null : await fetchPlayerProfile(slug);
  const lead = profile?.text.split(/(?<=[.!?])\s+/).reduce((acc, s) => (acc.length + s.length < 158 ? `${acc} ${s}`.trim() : acc), "");
  return {
    title: t.entity.playerTitle(player.name, role, sportLabel),
    description: lead || t.entity.playerDescription(player.name, sportLabel),
    alternates: { canonical: `/player/${player.slug}` },
  };
}

// A player's page for English or a language edition (its sports only; translated stories only).
export async function PlayerView({ slug, locale }: { slug: string; locale?: string }) {
  const player = TRACKED_PLAYERS.find((p) => p.slug === slug);
  if (!player || !inEdition(player.sport, locale)) notFound();
  const t = getDict(locale);
  const loc = Boolean(locale);
  const catLabel = (c: string) => (loc ? categoryLabel(c, t) : categoryChipStyle(c).label);

  // An approved written profile (English pages only; see lib/profiles.ts).
  const [photo, profile, rawArticles] = await Promise.all([
    fetchPersonPhoto(player.name, sportSearchHint(player.sport)),
    loc ? Promise.resolve(null) : fetchPlayerProfile(player.slug),
    db.select().from(article)
      .where(and(
        eq(article.status, "published"),
        ...editionConditions(locale),
        or(titleMatchesAnyTerm(player.searchTerms), taggedWith("player", player.slug))
      ))
      .orderBy(desc(article.publishedAt))
      .limit(30),
  ]);

  // Same sidebar content as article pages (Standings, Quotes) — a player
  // page shouldn't be a dead end either, same reasoning as the article-page
  // fix earlier today. Football-only, matching every other Standings widget
  // on the site (no standings data exists for cricket on this API tier).
  const trMap = locale ? await fetchTranslationMap(locale, rawArticles.map((a) => a.id)) : new Map();
  const articles = rawArticles.map((a) => localizeRow(trMap, a));
  const standingsApiKey = process.env.FOOTBALL_DATA_API_KEY;
  const standings =
    player.sport === "football" && standingsApiKey ? await fetchStandingsTable(standingsApiKey, "PL") : null;

  const siteUrl = loc ? `https://${LOCALES[locale!].host}` : (process.env.SITE_URL ?? "http://localhost:3000");
  const breadcrumbSteps = [
    { name: loc ? t.nav.home : "Home", href: "/" },
    { name: t.entity.players, href: "/player" },
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
      {profile && (
        // Only what the approved profile itself says: name and description, no invented fields.
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Person", name: player.name, description: profile.text.split(/\n\s*\n/)[0], url: `${siteUrl}/player/${player.slug}` }) }}
        />
      )}
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
              {player.role && (
                <Typography variant="body2" sx={{ color: "primary.main", fontWeight: 600 }}>
                  {catLabel(player.sport)} {player.role === "coach" ? t.entity.coach : t.entity.official}
                </Typography>
              )}
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {t.entity.stories(articles.length)}
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                <FollowButton kind="player" slug={player.slug} name={player.name} size="medium" />
              </Box>
            </Box>
          </Stack>

          {photo?.credit && (
            // Same minimal treatment as the image-overlay credit badges —
            // still a real, clickable attribution link, just not visually
            // competing with the player's name/stats above it.
            <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 12, display: "block", mb: 3 }}>
              <a href={photo.creditUrl} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                {photo.credit}
              </a>
            </Typography>
          )}

          {profile && (
            <Box component="section" sx={{ mb: 4 }}>
              <Typography variant="h6" component="h2" gutterBottom>About {player.name}</Typography>
              {profile.text.split(/\n\s*\n/).map((para, i) => (
                <Typography key={i} sx={{ mb: 1.5 }}>{para}</Typography>
              ))}
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                Compiled from published reports{profile.sources.length > 0 ? ` (${profile.sources.slice(0, 4).join(", ")})` : ""}, as of {profile.asOf}. Reviewed by {profile.reviewedBy}.
              </Typography>
            </Box>
          )}

          {articles.length === 0 ? (
            <Typography sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
              {t.entity.noStories(player.name)}
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
                            label={catLabel(article.category)}
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
                              {article.publishedAt.toLocaleDateString(loc ? t.dateLocale : "en-US", { month: "short", day: "numeric" })}
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
          {!loc && PLAYER_QUOTES.length > 0 && <QuotesStrip quotes={PLAYER_QUOTES} />}
        </Box>
      </Box>
    </Container>
  );
}
