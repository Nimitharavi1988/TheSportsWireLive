import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { TRACKED_COUNTRIES } from "@/lib/countries";
import { titleMatchesAnyTerm } from "@/lib/titleMatch";
import { findClubCrest } from "@/lib/teamNames";
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

// Modeled directly on club/[slug]/page.tsx -- same breadcrumbs/article-feed/
// crest pattern -- but deliberately no standings widget: no real
// "country standings" data source exists anywhere in this pipeline (ICC
// team rankings aren't ingested from anywhere), so it's omitted entirely
// rather than estimated, matching the project's structured-data policy
// (CLAUDE.md: never fabricate a field).
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
  const country = TRACKED_COUNTRIES.find((c) => c.slug === slug);
  if (!country) return {};
  // Was `"${country.name} News"` / `"Latest news and results involving
  // ${country.name}."` — same Bing "too short" warning as player/club
  // pages. Kept sport-agnostic in the copy (unlike player/club, this page
  // has no single `sport` field — see this file's own header comment: it
  // deliberately spans whichever sports real coverage exists for) rather
  // than naming a sport this page doesn't consistently have.
  return {
    title: `${country.name} News, Results & National Team Updates`,
    description: `Follow the latest ${country.name} sports news, match results, and national team updates — automatically updated on Sports Wire Live.`,
    alternates: { canonical: `/country/${country.slug}` },
  };
}

export default async function CountryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const country = TRACKED_COUNTRIES.find((c) => c.slug === slug);
  if (!country) notFound();

  const articles = await db.select().from(article)
    .where(and(
      eq(article.status, "published"),
      titleMatchesAnyTerm(country.searchTerms)
    ))
    .orderBy(desc(article.publishedAt))
    .limit(30);

  const crestUrl = findClubCrest(country, articles);

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const breadcrumbSteps = [
    { name: "Home", href: "/" },
    { name: "Countries", href: "/country" },
  ];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    breadcrumbSteps,
    { name: country.name, href: `/country/${country.slug}` },
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
          <SiteBreadcrumbs steps={breadcrumbSteps} current={country.name} />
          <Stack direction="row" spacing={3} sx={{ alignItems: "center", mb: 4 }}>
            {crestUrl ? (
              <Box component={Image} src={crestUrl} alt={`${country.name} crest`} width={96} height={96} sx={{ objectFit: "contain", flexShrink: 0 }} />
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
                {country.name}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {articles.length} {articles.length === 1 ? "story" : "stories"} on Sports Wire Live
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                <FollowButton kind="country" slug={country.slug} name={country.name} size="medium" />
              </Box>
            </Box>
          </Stack>

          {articles.length === 0 ? (
            <Typography sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
              No stories about {country.name} yet — check back soon.
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
          {PLAYER_QUOTES.length > 0 && <QuotesStrip quotes={PLAYER_QUOTES} />}
        </Box>
      </Box>
    </Container>
  );
}
