import { TeamCrest } from "@/components/TeamCrest";
import { db } from "@/db";
import { article as articleTable, author as authorTable } from "@/db/schema";
import { and, eq, gte, ne, or, ilike, isNull, desc } from "drizzle-orm";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { crestAltText } from "@/lib/teamNames";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { ArticleThumb } from "@/components/ArticleThumb";
import { fetchStandingsTable, STANDINGS_LEAGUES } from "@/lib/ingestion/standings";
import { StandingsCarousel } from "@/components/StandingsCarousel";
import { PLAYER_QUOTES } from "@/lib/quotes";
import { QuotesStrip } from "@/components/QuotesStrip";
import { InFeedAd } from "@/components/InFeedAd";
import { TRACKED_PLAYERS } from "@/lib/players";
import { TRACKED_CLUBS } from "@/lib/clubs";
import { createEntityLinker } from "@/lib/entityLinks";
import { isMatchDataSource } from "@/lib/matchDataSources";
import { currentScoreMatch } from "@/lib/scores/scoreboard";
import { MatchHeader } from "@/components/scores/MatchHeader";
import { ArticleVideos, MatchHighlightsForArticle, VideoStripSkeleton } from "@/components/videos/VideoStrip";
import { Suspense } from "react";
import { UpNext } from "@/components/UpNext";
import { pickOnward, RELATED_COUNT, trendingSince } from "@/lib/articleOnward";
import { FanEngagementHub } from "@/components/FanEngagementHub";
import { FollowUs } from "@/components/FollowUs";
import { ShareButtons } from "@/components/ShareButtons";
import { displaySummary, splitIntoParagraphs } from "@/lib/articleSummary";
import { isOriginalStory, subheading } from "@/lib/stories";
import { relativeTime } from "@/lib/relativeTime";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WhatshotIcon from "@mui/icons-material/Whatshot";

export const revalidate = 60;

// Declaring this (even empty) is what makes Next cache this route: each
// page renders on its first visit, then is served from cache and
// re-rendered in the background every `revalidate` seconds. Without it,
// every visit rendered from scratch (measured 2026-09-26: up to 2.2s).
export async function generateStaticParams() {
  return [];
}

// generateMetadata and the page both need the article row — cache() makes
// that one database round trip per request instead of two.
const getArticle = cache(async (slug: string) => {
  const rows = await db.select().from(articleTable).where(eq(articleTable.slug, slug)).limit(1);
  return rows[0] ?? null;
});

// The byline (original stories, editor rewrites) — see lib/stories.ts.
const getAuthor = cache(async (slug: string | null) => {
  if (!slug) return null;
  const rows = await db.select().from(authorTable).where(eq(authorTable.slug, slug)).limit(1);
  return rows[0] ?? null;
});

// Streamed separately (see standingsApiKey in the page).
async function ArticleStandings({ apiKey }: { apiKey: string }) {
  const standings = await fetchStandingsTable(apiKey, "PL").catch(() => null);
  if (!standings || standings.rows.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <StandingsCarousel leagues={STANDINGS_LEAGUES} initialCode="PL" initialTable={standings} />
    </Box>
  );
}

// Just In list — the left rail on wide screens, and under Trending Now in
// the right column below lg (it used to be desktop-only, leaving phones,
// where most visitors are, without it).
function JustInList({ items }: { items: { id: string; slug: string; title: string; publishedAt: Date | null }[] }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
        <AccessTimeIcon sx={{ fontSize: 15, color: "primary.main" }} />
        <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, lineHeight: 1 }}>
          Just In
        </Typography>
      </Stack>
      <Stack spacing={1.25}>
        {items.map((a, i) => (
          <Box key={a.id}>
            {i > 0 && <Divider sx={{ mb: 1.25 }} />}
            <Link href={`/article/${a.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Typography
                variant="body2"
                sx={{
                  fontSize: { xs: 13.5, lg: 12.5 },
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
  );
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = await getArticle(params.slug);
  if (!article) return {};
  // 160 chars — the length search engines actually display before truncating.
  const description = displaySummary(article, 160);
  // Every article had a real photo (or crest pair) available but no
  // openGraph/twitter `images` field ever set — every share (Twitter/X,
  // Slack, WhatsApp, Facebook, iMessage) showed a bare text card instead of
  // the actual article image, a real hit to click-through on shared links.
  const shareImage = article.heroImageUrl ?? article.homeCrestUrl ?? undefined;
  const writer = await getAuthor(article.authorSlug);
  return {
    title: article.title,
    description,
    ...(writer ? { authors: [{ name: writer.name, url: `/author/${writer.slug}` }] } : {}),
    alternates: { canonical: `/article/${article.slug}` },
    // Match rows are templated score cards (a couple of hundred characters
    // each, ~2,100 of them) — kept for readers, but not offered to search
    // engines as articles: at that volume thin pages can weigh on how the
    // whole site is judged. /scores and the sport pages rank for scores.
    ...(isMatchDataSource(article.sourceName) ? { robots: { index: false, follow: true } } : {}),
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
  const article = await getArticle(params.slug);
  if (!article || article.status !== "published") notFound();
  const writer = await getAuthor(article.authorSlug);
  // Match stories get the standard scoreboard header (src/lib/scores/)
  // instead of the plain crest-vs-crest row.
  const scoreMatch = isMatchDataSource(article.sourceName) ? currentScoreMatch(article) : null;

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
    author: writer
      ? { "@type": "Person", name: writer.name, url: `${process.env.SITE_URL ?? "http://localhost:3000"}/author/${writer.slug}` }
      : { "@type": "Organization", name: "Sports Wire Live" },
    publisher: {
      "@type": "Organization",
      name: "Sports Wire Live",
      logo: { "@type": "ImageObject", url: `${process.env.SITE_URL ?? "http://localhost:3000"}/icon-512`, width: 512, height: 512 },
    },
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
    { name: categoryChipStyle(article.category).label, href: `/sport/${article.category}` },
    ...(article.seriesKey && article.seriesLabel ? [{ name: article.seriesLabel, href: `/series/${article.seriesKey}` }] : []),
  ];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    breadcrumbSteps,
    { name: article.title, href: `/article/${article.slug}` },
    siteUrl
  );

  // Only for genuine structured match-data articles (homeTeam/awayTeam
  // populated by footballData.ts/cricketData.ts/nflData.ts/mlbData.ts/
  // nbaData.ts — see runIngest.ts) — an editorial/player-news article has
  // no real two-competitor event to describe. No score property: there's no
  // standard schema.org field for a final score on SportsEvent (the real
  // content of a result article — "who won 3-1" — belongs in the
  // NewsArticle's own headline/body above, not invented non-standard JSON-LD
  // here). eventStatus/competitor/startDate are what's actually
  // well-supported and accurate to include.
  //
  // description/image: always real data we already have (the article's own
  // summary/hero image). organizer: the competition/series name when known
  // (seriesLabel — cricket, and now also the ESPN-sourced domestic football
  // leagues/NHL), else the sport category as a reasonable fallback — still
  // a real, accurate value, never invented. location: only set when
  // article.venue is populated — real for cricket (CricketData.org), NFL/
  // NHL/domestic football leagues (ESPN's scoreboard API), but still unset
  // for football-data.org's own Premier League coverage and for volleyball
  // (neither source provides it) — see CLAUDE.md's structured-data policy
  // for the current per-sport breakdown. Google Search Console flagged
  // "location" as a CRITICAL missing field (2026-09-15); fabricating one
  // isn't an option, so it just stays unset wherever no real source exists.
  // endDate/offers deliberately omitted — we don't know real match duration
  // in advance and don't sell tickets, so there's no real data to provide.
  const sportsEventJsonLd =
    article.homeTeam && article.awayTeam
      ? {
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: `${article.homeTeam} vs ${article.awayTeam}`,
          sport: categoryChipStyle(article.category).label,
          description: displaySummary(article, 300),
          // Falls back to the home team's crest when there's no hero photo
          // — match articles commonly have one but not the other (see
          // hasRealImage in autoApprove.ts: a crest pair alone already
          // counts as a real image). Confirmed live: the Elche CF vs Real
          // Madrid CF article had heroImageUrl null (crests only), so
          // "image" was still missing from Search Console's live test
          // without this fallback.
          ...(article.heroImageUrl || article.homeCrestUrl
            ? { image: article.heroImageUrl || article.homeCrestUrl }
            : {}),
          ...(article.kickoffAt ? { startDate: article.kickoffAt } : {}),
          eventStatus:
            article.matchStatus === "finished"
              ? "https://schema.org/EventCompleted"
              : "https://schema.org/EventScheduled",
          competitor: [
            { "@type": "SportsTeam", name: article.homeTeam },
            { "@type": "SportsTeam", name: article.awayTeam },
          ],
          organizer: {
            "@type": "Organization",
            name: article.seriesLabel || categoryChipStyle(article.category).label,
            // Real, accurate URL — our own category listing for this
            // sport — rather than inventing a link to an external
            // governing body we don't actually represent.
            url: `${siteUrl}/sport/${article.category}`,
          },
          ...(article.venue
            ? { location: { "@type": "Place", name: article.venue } }
            : {}),
          url: `${siteUrl}/article/${article.slug}`,
        }
      : null;

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

  // Where the reader goes next: Up next, Related (tagged player/club
  // stories first — a Messi story is more usefully followed by another
  // Messi/Inter Miami story than an unrelated football headline — then
  // same-category), Trending Now and Just In. Articles are where most
  // traffic lands (search, Facebook), so none of this may be a dead end.
  // All four candidate lists load in ONE parallel round trip — this used
  // to be five sequential queries plus the football-data.org standings
  // call before anything rendered, the slowest part of the page on a
  // phone network. Over-fetched so pickOnward (lib/articleOnward.ts) can
  // de-duplicate across the lists in memory.
  const relatedSearchTerms = [...taggedPlayers, ...taggedClubs].flatMap((t) => t.searchTerms);
  const published = eq(articleTable.status, "published");
  const notThis = ne(articleTable.id, article.id);
  // Scheduled previews are dated at their future kickoff, so any list
  // sorted by date or trend put not-yet-played games at the top (same
  // rule as the homepage's Just In). Tagged player/club stories keep them —
  // a player's next game is relevant there.
  const notScheduled = or(isNull(articleTable.matchStatus), ne(articleTable.matchStatus, "scheduled"));
  const [taggedCandidates, sameCategoryCandidates, trendingCandidates, justInCandidates] = await Promise.all([
    relatedSearchTerms.length > 0
      ? db.select().from(articleTable)
          .where(and(published, notThis, or(...relatedSearchTerms.map((term) => ilike(articleTable.title, `%${term}%`)))))
          .orderBy(desc(articleTable.publishedAt))
          .limit(RELATED_COUNT + 1)
      : Promise.resolve([]),
    db.select().from(articleTable)
      .where(and(published, notThis, notScheduled, eq(articleTable.category, article.category)))
      .orderBy(desc(articleTable.publishedAt))
      .limit(8),
    db.select().from(articleTable)
      .where(and(published, notThis, notScheduled, gte(articleTable.publishedAt, trendingSince())))
      .orderBy(desc(articleTable.trendingScore), desc(articleTable.publishedAt))
      .limit(14),
    db.select().from(articleTable)
      .where(and(published, notThis, notScheduled))
      .orderBy(desc(articleTable.publishedAt))
      .limit(16),
  ]);
  const { upNextCandidates, related, relatedIsTagged, trendingNow, justIn } = pickOnward({
    tagged: taggedCandidates,
    sameCategory: sameCategoryCandidates,
    trending: trendingCandidates,
    justIn: justInCandidates,
  });

  // Same sidebar content as the homepage rail (Standings, Quotes) —
  // football only, matching the homepage's Standings widget. Streamed in
  // its own Suspense boundary (ArticleStandings below): an external API
  // call must never hold up the story itself.
  const standingsApiKey = article.category.startsWith("football") ? process.env.FOOTBALL_DATA_API_KEY : undefined;

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
      {sportsEventJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventJsonLd) }}
        />
      )}

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
          <JustInList items={justIn} />
        </Box>
      )}

      <Box sx={{ minWidth: 0 }}>

      <SiteBreadcrumbs steps={breadcrumbSteps} current={article.title} />

      {scoreMatch ? (
        <>
          <MatchHeader match={scoreMatch} />
          <Suspense fallback={null}>
            <MatchHighlightsForArticle articleId={article.id} />
          </Suspense>
        </>
      ) : article.homeCrestUrl && article.awayCrestUrl ? (
        <Stack
          direction="row"
          spacing={2.5}
          sx={{
            alignItems: "center",
            mb: 2.5
          }}>
          <TeamCrest name={article.homeTeam} crestUrl={article.homeCrestUrl} alt={crestAltText(article.summary).home} size={64} />
          <Typography
            variant="body1"
            sx={{
              color: "text.secondary",
              fontWeight: 600
            }}>
            vs
          </Typography>
          <TeamCrest name={article.awayTeam} crestUrl={article.awayCrestUrl} alt={crestAltText(article.summary).away} size={64} />
        </Stack>
      ) : article.heroImageUrl ? (
        <Box component="figure" sx={{ m: 0, mb: 2.5 }}>
          <Box sx={{ position: "relative", width: "100%", height: 460 }}>
            <Box
              component={Image}
              src={article.heroImageUrl}
              alt={article.title}
              fill
              priority
              sizes="(max-width: 900px) 100vw, 700px"
              sx={{ objectFit: "cover", objectPosition: "top", borderRadius: 1.5 }}
            />
          </Box>
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
                <a href={article.heroImageCreditUrl} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
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
        {(writer || article.publishedAt) && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {writer && (
              <>
                By{" "}
                <Link href={`/author/${writer.slug}`} style={{ color: "inherit", fontWeight: 600 }}>{writer.name}</Link>
                {article.publishedAt ? " · " : ""}
              </>
            )}
            {article.publishedAt?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
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
        return splitIntoParagraphs(article.body ?? article.summary).map((paragraph, i) => {
          // "## Team news" — a subheading in a story written in admin.
          const heading = subheading(paragraph);
          return heading ? (
            <Typography key={i} variant="h5" component="h2" sx={{ fontWeight: 700, mt: 3.5, mb: 1.5 }}>
              {heading}
            </Typography>
          ) : (
            <Typography key={i} variant="body1" sx={{ mb: 2.25, lineHeight: 1.7 }}>
              {linkifyEntities(paragraph)}
            </Typography>
          );
        });
      })()}

      {/* The next story, straight after this one — see UpNext. */}
      {upNextCandidates.length > 0 && <UpNext currentSlug={article.slug} candidates={upNextCandidates} />}

      {/* In-feed native ad, styled in AdSense to match the site's own
          look (white background, light border, sans-serif) so it reads
          as part of the content flow. Two ad units sharing one visual
          style (same layout-key) — AdSense generated a separate unit per
          screen size when the style was created, so each renders only at
          its own breakpoint rather than trying to force one unit to be
          responsive across both. Sits after the body, before engagement —
          same placement logic as FanEngagementHub below: after the reader
          has actually read the story. Not on match rows: a templated score
          card isn't content an ad should sit beside (AdSense policy). */}
      {!isMatchDataSource(article.sourceName) && (
        <>
          <InFeedAd slot="6766570899" layoutKey="-i7+9-t-18+5h" sx={{ display: { xs: "block", md: "none" }, mb: 3 }} />
          <InFeedAd slot="6355507350" layoutKey="-i7+9-t-18+5h" sx={{ display: { xs: "none", md: "block" }, mb: 3 }} />
        </>
      )}

      {/* Official videos for the story's sport — most readers land here
          straight from Facebook, so this is where they find the videos.
          After the story and its ad, before engagement. */}
      <Suspense fallback={<VideoStripSkeleton title="Watch" headingSx={{ fontSize: "1.25rem", fontWeight: 700 }} />}>
        <ArticleVideos articleId={article.id} category={article.category} />
      </Suspense>

      {/* Engagement sits before the outbound source link, not after — a
          reader who clicks through to the source immediately after reading
          would otherwise never see it. */}
      <FanEngagementHub articleId={article.id} />

      <FollowUs />

      {/* No source line on the site's own stories — there's nothing to credit. */}
      {!isOriginalStory(article) && (
      <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
        {/* Attribution requirement, not a call to action — kept deliberately
            quiet (caption size, text.disabled, no underline) so it doesn't
            compete with FollowUs right above it. The plain <a> had no
            text-decoration reset, unlike every other link on the site, so
            it rendered with a default browser underline none of the site's
            other links have. */}
        <a href={article.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
          <Typography variant="caption" sx={{ color: "text.disabled" }}>
            Original source: {article.sourceName} ↗
          </Typography>
        </a>
      </Box>
      )}

      </Box>

      <Box component="aside">
        {related.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="overline" sx={{ color: "text.secondary" }}>
              {relatedIsTagged ? "Related Stories" : `More in ${categoryChipStyle(article.category).label}`}
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
        {justIn.length > 0 && (
          <Box sx={{ display: { xs: "block", lg: "none" }, mb: 3 }}>
            <JustInList items={justIn} />
          </Box>
        )}
        {standingsApiKey && (
          <Suspense fallback={null}>
            <ArticleStandings apiKey={standingsApiKey} />
          </Suspense>
        )}
        {PLAYER_QUOTES.length > 0 && <QuotesStrip quotes={PLAYER_QUOTES} />}
      </Box>
      </Box>
    </Container>
  );
}
