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
import { FanEngagementHub } from "@/components/FanEngagementHub";
import { displaySummary } from "@/lib/articleSummary";
import { relativeTime } from "@/lib/relativeTime";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WhatshotIcon from "@mui/icons-material/Whatshot";

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

  // Related stories for the sidebar — prioritizes the same tagged player/
  // club over a generic "same category" match (a Messi story is more
  // usefully followed by another Messi/Inter Miami story than an unrelated
  // football headline), falling back to same-category-recent to fill any
  // remaining slots. Was previously a "More in {Category}" block at the
  // bottom of the main column, purely category-based — moved into the
  // sidebar (where readers actually look for "what's next") and sharpened
  // to use the tagging already computed above for the player/club chips.
  const relatedSearchTerms = [...taggedPlayers, ...taggedClubs].flatMap((t) => t.searchTerms);
  const taggedRelated =
    relatedSearchTerms.length > 0
      ? await db.article.findMany({
          where: {
            status: "published",
            id: { not: article.id },
            OR: relatedSearchTerms.map((term) => ({ title: { contains: term, mode: "insensitive" as const } })),
          },
          orderBy: { publishedAt: "desc" },
          take: 3,
        })
      : [];
  const related =
    taggedRelated.length < 3
      ? [
          ...taggedRelated,
          ...(await db.article.findMany({
            where: {
              status: "published",
              category: article.category,
              id: { notIn: [article.id, ...taggedRelated.map((r) => r.id)] },
            },
            orderBy: { publishedAt: "desc" },
            take: 3 - taggedRelated.length,
          })),
        ]
      : taggedRelated;

  // "Trending Now" (right) and "Just In" (left) — an article page was
  // otherwise a dead end beyond its own Related Stories: no way to
  // discover what's hot sitewide right now, or what just came in, without
  // going back to the homepage. Same trendingScore/publishedAt ordering
  // the homepage itself uses, just sitewide rather than same-topic.
  const excludeIds = [article.id, ...related.map((r) => r.id)];
  const trendingNow = await db.article.findMany({
    where: { status: "published", id: { notIn: excludeIds } },
    orderBy: [{ trendingScore: "desc" }, { publishedAt: "desc" }],
    take: 5,
  });
  const justIn = await db.article.findMany({
    where: { status: "published", id: { notIn: [...excludeIds, ...trendingNow.map((t) => t.id)] } },
    orderBy: { publishedAt: "desc" },
    take: 5,
  });

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
          gridTemplateColumns: { xs: "1fr", md: "1fr 300px", lg: "220px 1fr 300px" },
          gap: 4,
        }}
      >
      {justIn.length > 0 && (
        <Box
          component="aside"
          sx={{
            display: { xs: "none", lg: "block" },
            position: "sticky",
            top: 84,
          }}
        >
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
              <AccessTimeIcon sx={{ fontSize: 15, color: "primary.main" }} />
              <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, lineHeight: 1 }}>
                Just In
              </Typography>
            </Stack>
            <Stack spacing={1.25}>
              {justIn.map((a, i) => (
                <Box key={a.id}>
                  {i > 0 && <Divider sx={{ mb: 1.25 }} />}
                  <Link href={`/article/${a.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        lineHeight: 1.35,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      {a.title}
                    </Typography>
                    {a.publishedAt && (
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {relativeTime(a.publishedAt)}
                      </Typography>
                    )}
                  </Link>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Box>
      )}

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

      <FanEngagementHub articleId={article.id} />

      </Box>

      <Box component="aside">
        {related.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="overline" sx={{ color: "text.secondary" }}>
              {taggedRelated.length > 0 ? "Related Stories" : `More in ${categoryChipStyle(article.category).label}`}
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
                          fontSize: 13,
                          lineHeight: 1.35,
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
        {trendingNow.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1 }}>
              <WhatshotIcon sx={{ fontSize: 16, color: "warning.main" }} />
              <Typography variant="overline" sx={{ color: "text.secondary" }}>
                Trending Now
              </Typography>
            </Stack>
            <Stack sx={{ mt: 0.5 }}>
              {trendingNow.map((t, index) => (
                <Box key={t.id}>
                  {index > 0 && <Divider />}
                  <Link href={`/article/${t.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", py: 1.25 }}>
                      <ArticleThumb article={t} size={44} fallbackColor={categoryChipStyle(t.category).color} />
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: 13,
                          lineHeight: 1.35,
                          fontWeight: 500,
                          "&:hover": { color: "primary.main" }
                        }}>
                        {t.title}
                      </Typography>
                    </Stack>
                  </Link>
                </Box>
              ))}
            </Stack>
          </Paper>
        )}
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
