import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { and, desc, eq, notInArray, or } from "drizzle-orm";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import { db } from "@/db";
import { article } from "@/db/schema";
import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { ArticleThumb } from "@/components/ArticleThumb";
import { LeagueScoresCard } from "@/components/scores/ScoreCard";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { MATCH_DATA_SOURCE_NAMES } from "@/lib/matchDataSources";
import { fetchVenueMatches } from "@/lib/scores/scoreboard";
import { readSnapshot, SNAPSHOT_KEYS } from "@/lib/snapshots/read";
import { taggedWith } from "@/lib/tags";
import { titleMatchesAnyTerm } from "@/lib/titleMatch";
import { venueBySlug, type VenueDetails } from "@/lib/venues";

// A ground's page: about it (Wikipedia, attributed), its next fixtures and
// latest results, and the stories about it (tagged in the story editor, or
// naming it in the headline). Venues are config — lib/venues.ts.
export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const venue = venueBySlug((await params).slug);
  if (!venue) return {};
  return {
    title: `${venue.name}, ${venue.city}: Fixtures, Results & Ground Guide`,
    description: `${venue.name} in ${venue.city}: upcoming matches, recent results, ground details and the latest stories from the venue on Sports Wire Live.`,
    alternates: { canonical: `/venue/${venue.slug}` },
  };
}

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const venue = venueBySlug((await params).slug);
  if (!venue) notFound();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

  const [details, matches, stories] = await Promise.all([
    readSnapshot<VenueDetails>(SNAPSHOT_KEYS.venue(venue.slug)),
    fetchVenueMatches(venue.matchTerms),
    db
      .select({ slug: article.slug, title: article.title, category: article.category, publishedAt: article.publishedAt, heroImageUrl: article.heroImageUrl, homeCrestUrl: article.homeCrestUrl, awayCrestUrl: article.awayCrestUrl })
      .from(article)
      .where(and(
        eq(article.status, "published"),
        notInArray(article.sourceName, MATCH_DATA_SOURCE_NAMES),
        or(taggedWith("venue", venue.slug), titleMatchesAnyTerm(venue.matchTerms))
      ))
      .orderBy(desc(article.publishedAt))
      .limit(20),
  ]);

  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "StadiumOrArena",
    name: venue.name,
    address: { "@type": "PostalAddress", addressLocality: venue.city, addressCountry: venue.country },
    url: `${siteUrl}/venue/${venue.slug}`,
    ...(details?.image ? { image: details.image.url } : {}),
    ...(details?.wikipediaUrl ? { sameAs: [details.wikipediaUrl] } : {}),
  };
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([{ name: "Home", href: "/" }, { name: "Venues", href: "/venue" }], { name: venue.name, href: `/venue/${venue.slug}` }, siteUrl);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <SiteBreadcrumbs steps={[{ name: "Home", href: "/" }, { name: "Venues", href: "/venue" }]} current={venue.name} />

      <Typography variant="h4" component="h1" sx={{ mt: 2 }}>{venue.name}</Typography>
      <Typography sx={{ color: "text.secondary", mb: 3 }}>{venue.city}, {venue.country}</Typography>

      {details?.image && (
        <Box component="figure" sx={{ m: 0, mb: 3 }}>
          <Box sx={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 2, overflow: "hidden", bgcolor: "action.hover" }}>
            <Image src={details.image.url} alt={venue.name} fill sizes="(max-width: 900px) 100vw, 860px" style={{ objectFit: "cover" }} priority />
          </Box>
          <Typography component="figcaption" variant="caption" sx={{ color: "text.secondary" }}>
            <a href={details.image.creditUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{details.image.credit}</a>
          </Typography>
        </Box>
      )}

      {details && (
        <Box component="section" aria-label="About the ground" sx={{ mb: 4 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>About the ground</Typography>
          <Typography sx={{ lineHeight: 1.7 }}>{details.extract}</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
            From <a href={details.wikipediaUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>Wikipedia</a>, CC BY-SA 4.0
          </Typography>
        </Box>
      )}

      <Stack spacing={2} sx={{ mb: 4 }}>
        {matches.upcoming.length > 0 && <LeagueScoresCard league={`Upcoming at ${venue.name}`} matches={matches.upcoming} />}
        {matches.recent.length > 0 && <LeagueScoresCard league="Recent results" matches={matches.recent} />}
      </Stack>

      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>Stories</Typography>
      {stories.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>No stories about {venue.name} yet.</Typography>
      ) : (
        <Stack spacing={2}>
          {stories.map((s) => (
            <Link key={s.slug} href={`/article/${s.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <ArticleThumb article={s} size={64} fallbackColor={categoryChipStyle(s.category).color} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, lineHeight: 1.35 }}>{s.title}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {categoryChipStyle(s.category).label}
                    {s.publishedAt ? ` · ${s.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                  </Typography>
                </Box>
              </Stack>
            </Link>
          ))}
        </Stack>
      )}
    </Container>
  );
}
