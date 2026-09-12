import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ArticleThumb } from "@/components/ArticleThumb";
import { categoryChipStyle } from "@/lib/categoryDisplay";
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
import SportsCricketIcon from "@mui/icons-material/SportsCricket";

export const revalidate = 300;

async function findSeries(seriesKey: string) {
  return db.article.findFirst({
    where: { seriesKey },
    select: { seriesLabel: true },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ seriesKey: string }> }) {
  const { seriesKey } = await params;
  const series = await findSeries(seriesKey);
  if (!series?.seriesLabel) return {};
  return {
    title: `${series.seriesLabel} News`,
    description: `Every story on Sports Wire Live about the ${series.seriesLabel} series.`,
    alternates: { canonical: `/series/${seriesKey}` },
  };
}

export default async function SeriesPage({ params }: { params: Promise<{ seriesKey: string }> }) {
  const { seriesKey } = await params;

  const [series, articles] = await Promise.all([
    findSeries(seriesKey),
    db.article.findMany({
      where: { seriesKey, status: "published" },
      orderBy: [{ trendingScore: "desc" }, { publishedAt: "desc" }],
      take: 60,
    }),
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
        <SportsCricketIcon sx={{ color: "primary.main" }} />
        <Typography variant="h4" component="h1">
          {series.seriesLabel}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        {articles.length} {articles.length === 1 ? "story" : "stories"} · every match, preview, and player story from this series
      </Typography>

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
                  <Stack direction="row" spacing={2}>
                    <ArticleThumb article={article} size={64} fallbackColor={categoryChipStyle(article.category).color} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}>
                        <Chip label={article.sourceName} size="small" variant="outlined" sx={{ color: "primary" }} />
                        {article.matchStatus === "finished" && <Chip label="Result" size="small" sx={{ color: "primary" }} />}
                        {article.publishedAt && (
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {article.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </Typography>
                        )}
                      </Stack>
                      <Typography variant="h6" component="h2" gutterBottom>
                        {article.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        {displaySummary(article)}
                      </Typography>
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
