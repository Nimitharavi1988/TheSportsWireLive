import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import { crestAltText } from "@/lib/teamNames";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { ArticleThumb } from "@/components/ArticleThumb";
import { fetchStandingsTable, STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import { StandingsCarousel } from "@/components/StandingsCarousel";
import { PLAYER_QUOTES } from "@/lib/quotes";
import { QuotesStrip } from "@/components/QuotesStrip";
import { TRACKED_PLAYERS } from "@/lib/players";
import { TRACKED_CLUBS } from "@/lib/clubs";
import { displaySummary } from "@/lib/articleSummary";

export const revalidate = 60;

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = await db.article.findUnique({ where: { slug: params.slug } });
  if (!article) return {};
  // 160 chars — the length search engines actually display before truncating.
  const description = displaySummary(article, 160);
  return {
    title: article.title,
    description,
    alternates: { canonical: `/article/${article.slug}` },
    openGraph: {
      title: article.title,
      description,
      type: "article",
      url: `/article/${article.slug}`,
    },
    twitter: {
      title: article.title,
      description,
    },
  };
}

export default async function ArticlePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = await db.article.findUnique({ where: { slug: params.slug } });
  if (!article || article.status !== "published") notFound();

  const related = await db.article.findMany({
    where: {
      status: "published",
      category: article.category,
      id: { not: article.id },
    },
    orderBy: { publishedAt: "desc" },
    take: 3,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    datePublished: article.publishedAt,
    articleSection: article.category,
    description: displaySummary(article, 160),
    ...(article.heroImageUrl ? { image: [article.heroImageUrl] } : {}),
    publisher: { "@type": "Organization", name: "Sports Wire Live" },
  };

  // Tracked players mentioned in this article's title — the only real entry
  // point into a player's dedicated page used to be the homepage's Player
  // News carousel, which only ever shows 3 players at a time (whoever
  // currently has matching news). An article about Messi that isn't one of
  // those 3 right now had no link to his page anywhere. Same searchTerms
  // matching already used for the homepage's Player News/highlight logic.
  const taggedPlayers = TRACKED_PLAYERS.filter((player) =>
    player.searchTerms.some((term) => article.title.toLowerCase().includes(term.toLowerCase()))
  );
  const taggedClubs = TRACKED_CLUBS.filter((club) =>
    club.searchTerms.some((term) => article.title.toLowerCase().includes(term.toLowerCase()))
  );

  // Same sidebar content as the homepage rail (Standings, Quotes) — article
  // pages are where most real traffic actually lands (search, social
  // shares), so they shouldn't be a dead end with zero discovery content
  // just because they're not the homepage. Football-only, matching how the
  // homepage's Standings widget is already scoped (no standings data exists
  // for cricket on this API tier).
  const standingsApiKey = process.env.FOOTBALL_DATA_API_KEY;
  const standings =
    article.category.startsWith("football") && standingsApiKey
      ? await fetchStandingsTable(standingsApiKey, "PL")
      : null;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 300px" },
          gap: 4,
        }}
      >
      <Box sx={{ minWidth: 0 }}>

      {article.homeCrestUrl && article.awayCrestUrl ? (
        <Stack
          direction="row"
          spacing={2.5}
          sx={{
            alignItems: "center",
            mb: 2.5
          }}>
          <img src={article.homeCrestUrl} alt={crestAltText(article.summary).home} width={64} height={64} />
          <Typography
            variant="body1"
            sx={{
              color: "text.secondary",
              fontWeight: 600
            }}>
            vs
          </Typography>
          <img src={article.awayCrestUrl} alt={crestAltText(article.summary).away} width={64} height={64} />
        </Stack>
      ) : article.heroImageUrl ? (
        <Box component="figure" sx={{ m: 0, mb: 2.5 }}>
          <Box
            component="img"
            src={article.heroImageUrl}
            alt={article.title}
            sx={{ width: "100%", maxHeight: 460, objectFit: "cover", objectPosition: "top", borderRadius: 1.5, display: "block" }}
          />
          {article.heroImageCredit && (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                mt: 0.75,
                display: "block"
              }}>
              {article.heroImageCreditUrl ? (
                <a href={article.heroImageCreditUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                  {article.heroImageCredit}
                </a>
              ) : (
                article.heroImageCredit
              )}
            </Typography>
          )}
        </Box>
      ) : null}

      <Chip
        label={categoryChipStyle(article.category).label}
        size="small"
        variant="outlined"
        sx={{
          color: categoryChipStyle(article.category).color,
          borderColor: categoryChipStyle(article.category).color,
          fontWeight: 600,
          mb: 1.5
        }} />
      <Typography variant="h4" component="h1" gutterBottom>
        {article.title}
      </Typography>
      {article.publishedAt && (
        <Typography variant="body2" sx={{ color: "text.secondary", mb: (taggedPlayers.length > 0 || taggedClubs.length > 0) ? 1.5 : 2.5 }}>
          {article.publishedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          {" · "}
          {article.sourceName}
        </Typography>
      )}

      {(taggedPlayers.length > 0 || taggedClubs.length > 0) && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 2.5 }}>
          {taggedClubs.map((club) => (
            <Link key={club.slug} href={`/club/${club.slug}`} style={{ textDecoration: "none" }}>
              <Chip
                label={club.name}
                size="small"
                variant="outlined"
                clickable
                sx={{ borderColor: "primary.main", color: "primary.main" }}
              />
            </Link>
          ))}
          {taggedPlayers.map((player) => (
            <Link key={player.slug} href={`/player/${player.slug}`} style={{ textDecoration: "none" }}>
              <Chip label={player.name} size="small" variant="outlined" clickable />
            </Link>
          ))}
        </Stack>
      )}

      {(article.body ?? article.summary).split(/\n+/).filter(Boolean).map((paragraph, i) => (
        <Typography key={i} variant="body1" sx={{ mb: 2 }}>
          {paragraph}
        </Typography>
      ))}

      <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <a href={article.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            Original source: {article.sourceName} ↗
          </Typography>
        </a>
      </Box>

      {related.length > 0 && (
        <Paper variant="outlined" sx={{ p: 3, mt: 5 }}>
          <Typography variant="overline" sx={{
            color: "text.secondary"
          }}>
            More in {categoryChipStyle(article.category).label}
          </Typography>
          <Stack sx={{ mt: 1 }}>
            {related.map((r, index) => (
              <Box key={r.id}>
                {index > 0 && <Divider />}
                <Link href={`/article/${r.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", py: 1.25 }}>
                    <ArticleThumb article={r} size={44} fallbackColor={categoryChipStyle(article.category).color} />
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        "&:hover": { color: "primary.main" }
                      }}>
                      {r.title}
                    </Typography>
                  </Stack>
                </Link>
              </Box>
            ))}
          </Stack>
        </Paper>
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
