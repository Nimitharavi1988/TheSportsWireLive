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
import Breadcrumbs from "@mui/material/Breadcrumbs";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { crestAltText } from "@/lib/teamNames";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { ArticleThumb } from "@/components/ArticleThumb";
import { fetchStandingsTable, STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import { StandingsCarousel } from "@/components/StandingsCarousel";
import { PLAYER_QUOTES } from "@/lib/quotes";
import { QuotesStrip } from "@/components/QuotesStrip";
import { TRACKED_PLAYERS } from "@/lib/players";
import { TRACKED_CLUBS } from "@/lib/clubs";
import { createEntityLinker } from "@/lib/entityLinks";
import { FanEngagementHub } from "@/components/FanEngagementHub";
import { ShareButtons } from "@/components/ShareButtons";
import { displaySummary, splitIntoParagraphs } from "@/lib/articleSummary";
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
  // Every article had a real photo (or crest pair) available but no
  // openGraph/twitter `images` field ever set — every share (Twitter/X,
  // Slack, WhatsApp, Facebook, iMessage) showed a bare text card instead of
  // the actual article image, a real hit to click-through on shared links.
  const shareImage = article.heroImageUrl ?? article.homeCrestUrl ?? undefined;
  return {
    title: article.title,
    description,
    alternates: { canonical: `/article/${article.slug}` },
    openGraph: {
      title: article.title,
      description,
      type: "article",
      url: `/article/${article.slug}`,
      publishedTime: article.publishedAt?.toISOString(),
      ...(shareImage ? { images: [{ url: shareImage }] } : {}),
    },
    twitter: {
      title: article.title,
      description,
      ...(shareImage ? { images: [shareImage] } : {}),
    },
  };
}

export default async function ArticlePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = await db.article.findUnique({ where: { slug: params.slug } });
  if (!article || article.status !== "published") notFound();

  // author/dateModified/mainEntityOfPage were all missing — Google's Rich
  // Results Test flags a NewsArticle with no author as a warning, and
  // dateModified is what lets a genuinely-updated story (this one was
  // backfilled with a real body well after its original publishedAt, for
  // instance) show a correct "updated" time instead of a stale one.
  // Organization, not Person: nothing here is republished verbatim under an
  // original byline — every body is either the source's own structured
  // match data or an original Gemini rewrite (see commentary.ts), so
  // attributing "author" to the original source publisher would be
  // inaccurate; it belongs to whoever's prose is actually on this page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    articleSection: article.category,
    description: displaySummary(article, 160),
    ...(article.heroImageUrl ? { image: [article.heroImageUrl] } : {}),
    author: { "@type": "Organization", name: "Sports Wire Live" },
    publisher: { "@type": "Organization", name: "Sports Wire Live" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${process.env.SITE_URL ?? "http://localhost:3000"}/article/${article.slug}` },
  };

  // Lets Google show a breadcrumb trail (Home > Football > headline) in
  // search results instead of a raw URL — real CTR impact for a search
  // listing, and reinforces the site's actual category hierarchy to
  // crawlers the same way the visible nav already does for users.
  //
  // This used to be the ONLY breadcrumb — structured data Google can render
  // in a search snippet, but nothing an actual visitor on the page could
  // click. A reader landing on an article (especially from a series page)
  // had no way back except the browser's back button. Real gap, and Google
  // explicitly discounts a BreadcrumbList that doesn't match something
  // visible on the page — so the trail below is built from the same steps
  // as this JSON-LD, series level included when the article has one.
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const breadcrumbSteps: { name: string; href: string }[] = [
    { name: "Home", href: "/" },
    { name: categoryChipStyle(article.category).label, href: `/?category=${article.category}` },
    ...(article.seriesKey && article.seriesLabel ? [{ name: article.seriesLabel, href: `/series/${article.seriesKey}` }] : []),
  ];
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      ...breadcrumbSteps.map((step, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: step.name,
        item: `${siteUrl}${step.href}`,
      })),
      { "@type": "ListItem", position: breadcrumbSteps.length + 1, name: article.title, item: `${siteUrl}/article/${article.slug}` },
    ],
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
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

      <Breadcrumbs
        separator={<NavigateNextIcon sx={{ fontSize: 14 }} />}
        sx={{ mb: 2, "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" } }}
      >
        {breadcrumbSteps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            style={{ color: "inherit", textDecoration: "none" }}
          >
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", whiteSpace: "nowrap", "&:hover": { color: "primary.main" } }}
            >
              {step.name}
            </Typography>
          </Link>
        ))}
        <Typography
          variant="caption"
          sx={{
            color: "text.disabled",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 220,
          }}
        >
          {article.title}
        </Typography>
      </Breadcrumbs>

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
            // Same minimal treatment as the image-overlay credit badges
            // elsewhere — still a real, clickable attribution link, just
            // not competing visually with the headline right below it.
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
                fontSize: 10,
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
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          rowGap: 0.5,
          mb: (taggedPlayers.length > 0 || taggedClubs.length > 0) ? 1.5 : 2.5,
        }}
      >
        {article.publishedAt && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {article.publishedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {" · "}
            {article.sourceName}
          </Typography>
        )}
        {/* No way to share an article previously existed except copying
            the URL bar by hand — a real gap on a site whose model depends
            on distribution. WhatsApp listed first (see ShareButtons.tsx). */}
        <ShareButtons url={`${siteUrl}/article/${article.slug}`} title={article.title} />
      </Stack>

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

      {(() => {
        // One linker per render — its `linked` set is shared across every
        // paragraph below, so a player/club name only gets turned into a
        // link on its first mention in the article, not every repeat.
        const linkifyEntities = createEntityLinker();
        // splitIntoParagraphs (not a plain \n split) guarantees readable-
        // sized chunks even when the source text comes back as one long
        // unbroken block — confirmed live: a dense 4-6 sentence wall of
        // text with no paragraph breaks at all was the actual complaint.
        return splitIntoParagraphs(article.body ?? article.summary).map((paragraph, i) => (
          <Typography key={i} variant="body1" sx={{ mb: 2.25, lineHeight: 1.7 }}>
            {linkifyEntities(paragraph)}
          </Typography>
        ));
      })()}

      {/* Engagement sits before the outbound source link, not after — a
          reader who clicks through to the source immediately after reading
          would otherwise never see it. */}
      <FanEngagementHub articleId={article.id} />

      <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <a href={article.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            Original source: {article.sourceName} ↗
          </Typography>
        </a>
      </Box>

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
