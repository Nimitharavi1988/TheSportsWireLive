import { EVENT_HUBS } from "@/lib/events/eventHubs";
import { eventLabel } from "@/lib/ingestion/eventTagging";
import { getMedalTable } from "@/lib/events/queries";
import { fetchCricketStandings } from "@/lib/events/cricketStandings";
import { MedalTableCard } from "@/components/events/MedalTableCard";
import { CricketGroupTables } from "@/components/events/CricketGroupTables";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { ArticleThumb } from "@/components/ArticleThumb";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { displaySummary } from "@/lib/articleSummary";
import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { FollowButton } from "@/components/FollowButton";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

export const revalidate = 300;

// Declaring this (even empty) is what makes Next cache this route: each
// page renders on its first visit, then is served from cache and
// re-rendered in the background every `revalidate` seconds. Without it,
// every visit rendered from scratch (measured 2026-09-26: up to 2.2s).
export async function generateStaticParams() {
  return [];
}

// A known event always uses its own name (eventTagging.ts); stories can
// carry a source's variant ("Asian Games Women") of the same event.
async function findSeries(seriesKey: string) {
  const rows = await db.select({ seriesLabel: article.seriesLabel }).from(article)
    .where(eq(article.seriesKey, seriesKey)).limit(1);
  if (!rows[0]) return null;
  return { seriesLabel: eventLabel(seriesKey) ?? rows[0].seriesLabel };
}

export async function generateMetadata({ params }: { params: Promise<{ seriesKey: string }> }) {
  const { seriesKey } = await params;
  const series = await findSeries(seriesKey);
  if (!series?.seriesLabel) return {};
  // Was `"${series.seriesLabel} News"` / `"Every story on Sports Wire Live
  // about the ${series.seriesLabel} series."` — same Bing "too short"
  // warning as the other entity pages.
  return {
    title: `${series.seriesLabel} News, Results & Full Coverage`,
    description: `Every article on Sports Wire Live covering the ${series.seriesLabel} — match reports, results, and player news, updated automatically.`,
    alternates: { canonical: `/series/${seriesKey}` },
  };
}

export default async function SeriesPage({ params }: { params: Promise<{ seriesKey: string }> }) {
  const { seriesKey } = await params;
  // Games hub data (events/eventHubs.ts): medal table + standings.
  const hub = EVENT_HUBS[seriesKey];
  const [medals, cricketGroups] = await Promise.all([
    hub?.medalTable ? getMedalTable(seriesKey).catch(() => null) : Promise.resolve(null),
    Promise.all((hub?.cricketStandings ?? []).map(async (s) => ({ label: s.label, groups: await fetchCricketStandings(s.espnLeagueId) }))),
  ]);

  const [series, articles] = await Promise.all([
    findSeries(seriesKey),
    // Chronological, not trending — a series page is followed like a live
    // blog during an active match, so the newest update belongs at the top
    // even before it's accumulated any engagement. trendingScore-first
    // ordering was burying today's live-match articles (trendingScore still
    // low, minutes old) beneath 1-2 day old preview stories that had time to
    // build score — confirmed live: the actual newest 5 articles were absent
    // from the first 8 shown.
    db.select().from(article)
      .where(and(eq(article.seriesKey, seriesKey), eq(article.status, "published")))
      .orderBy(desc(article.publishedAt))
      .limit(60),
  ]);

  if (!series) notFound();

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const breadcrumbSteps = [
    { name: "Home", href: "/" },
    { name: "Series", href: "/series" },
  ];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    breadcrumbSteps,
    { name: series.seriesLabel ?? "Series", href: `/series/${seriesKey}` },
    siteUrl
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SiteBreadcrumbs steps={breadcrumbSteps} current={series.seriesLabel ?? "Series"} />
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 1 }}>
        <EmojiEventsIcon sx={{ color: "primary.main" }} />
        <Typography variant="h4" component="h1">
          {series.seriesLabel}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
        {articles.length} {articles.length === 1 ? "story" : "stories"} · every match, preview, and player story from this series
      </Typography>
      {(medals || cricketGroups.some((c) => c.groups.length > 0)) && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 2, alignItems: "start", mb: 3 }}>
          {medals && <MedalTableCard title="Medal table" medals={medals} />}
          <Box sx={{ display: "grid", gap: 2 }}>
            {cricketGroups.map((c) => <CricketGroupTables key={c.label} label={c.label} groups={c.groups} />)}
          </Box>
        </Box>
      )}
      <Box sx={{ mb: 3 }}>
        <FollowButton kind="series" slug={seriesKey} name={series.seriesLabel ?? "this series"} size="medium" />
      </Box>

      {articles.length === 0 ? (
        <Typography sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
          No stories from this series yet — check back soon.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {articles.map((article) => (
            <Link key={article.id} href={`/article/${article.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Card variant="outlined" sx={{ "&:hover": { borderColor: "primary.main" } }}>
                <CardContent>
                  {/* alignItems: "center" -- without it this fixed-height
                      thumbnail sits top-aligned against the taller
                      title+summary text beside it, a visible empty gap
                      whenever the text runs longer than the thumbnail
                      (confirmed live 2026-09-24, same root cause fixed in
                      8 places site-wide). */}
                  <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                    <ArticleThumb article={article} size={64} fallbackColor={categoryChipStyle(article.category).color} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      {/* Sport/category badge at the top, alongside "Result"
                          — our own taxonomy, not third-party attribution, so
                          it's fine to keep prominent, same as every other
                          section on the site. */}
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}>
                        <Chip
                          label={categoryChipStyle(article.category).label}
                          size="small"
                          variant="outlined"
                          sx={{
                            color: categoryChipStyle(article.category).color,
                            borderColor: categoryChipStyle(article.category).color,
                            fontWeight: 600,
                          }}
                        />
                        {article.matchStatus === "finished" && (
                          <Chip label="Result" size="small" sx={{ color: "primary" }} />
                        )}
                      </Stack>
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
    </Container>
  );
}
