import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import { ShareButtons } from "@/components/ShareButtons";
import { StoryCard } from "@/components/StoryCard";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { displaySummary, splitIntoParagraphs } from "@/lib/articleSummary";
import { isMatchDataSource } from "@/lib/matchDataSources";
import { ES, categoryLabelEs, formatDateEs } from "@/lib/i18n/es";
import { LOCALES } from "@/lib/i18n/locales";
import { getSpanishStory, listSpanishStories } from "@/lib/i18n/spanishArticles";

export const revalidate = 60;

// Declaring this (even empty) is what makes Next cache the route — see the
// English article page.
export async function generateStaticParams() {
  return [];
}

const HOST = `https://${LOCALES.es.host}`;
const EN = process.env.SITE_URL ?? "https://sportswirelive.com";
const CONTACT = "contact@hyperianai.com";

const getStory = cache((slug: string) => getSpanishStory(slug));

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const story = await getStory((await props.params).slug);
  if (!story) return {};
  const description = displaySummary(story, 160);
  const image = story.heroImageUrl ?? story.homeCrestUrl ?? undefined;
  return {
    title: story.title,
    description,
    // hreflang pairs this page with its English original (both exist, since
    // the translation is made from the published English article).
    alternates: {
      canonical: `/article/${story.slug}`,
      languages: { es: `/article/${story.slug}`, en: `${EN}/article/${story.enSlug}` },
    },
    // Same rule as the English page: templated match score cards are kept for
    // readers but not offered to search engines.
    ...(isMatchDataSource(story.sourceName) ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: story.title,
      description,
      type: "article",
      locale: "es_US",
      url: `/article/${story.slug}`,
      publishedTime: story.publishedAt?.toISOString(),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { title: story.title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function SpanishArticlePage(props: { params: Promise<{ slug: string }> }) {
  const story = await getStory((await props.params).slug);
  if (!story) notFound();

  const chip = categoryChipStyle(story.category);
  const related = await listSpanishStories({ limit: 4, categories: [story.category], excludeId: story.id });
  const url = `${HOST}/article/${story.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    inLanguage: "es",
    headline: story.title,
    datePublished: story.publishedAt,
    dateModified: story.updatedAt,
    articleSection: categoryLabelEs(story.category),
    description: displaySummary(story, 160),
    ...(story.heroImageUrl ? { image: [story.heroImageUrl] } : {}),
    author: { "@type": "Organization", name: "Sports Wire Live" },
    publisher: { "@type": "Organization", name: "Sports Wire Live", logo: { "@type": "ImageObject", url: `${HOST}/icon-512`, width: 512, height: 512 } },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    // The English original this was translated from.
    translationOfWork: { "@type": "NewsArticle", url: `${EN}/article/${story.enSlug}`, inLanguage: "en" },
  };

  return (
    <Container maxWidth="md" component="main" sx={{ py: 4 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {story.heroImageUrl && (
        <Box component="figure" sx={{ m: 0, mb: 2.5 }}>
          <Box sx={{ position: "relative", width: "100%", aspectRatio: "16 / 9", bgcolor: "action.hover", borderRadius: 1.5, overflow: "hidden" }}>
            <Box component={Image} src={story.heroImageUrl} alt={story.title} fill priority sizes="(max-width: 900px) 100vw, 900px" sx={{ objectFit: "cover", objectPosition: "center 20%" }} />
          </Box>
          {story.heroImageCredit && (
            <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 12, mt: 0.75, display: "block" }}>
              {story.heroImageCreditUrl ? (
                <a href={story.heroImageCreditUrl} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                  {story.heroImageCredit}
                </a>
              ) : (
                story.heroImageCredit
              )}
            </Typography>
          )}
        </Box>
      )}

      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
        <Chip label={categoryLabelEs(story.category)} size="small" variant="outlined" sx={{ color: chip.color, borderColor: chip.color, fontWeight: 600 }} />
        {story.publishedAt && (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {ES.article.published} {formatDateEs(story.publishedAt, true)}
          </Typography>
        )}
      </Stack>

      <Typography variant="h1" sx={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: { xs: "1.7rem", sm: "2.2rem" }, lineHeight: 1.2, mb: 2 }}>
        {story.title}
      </Typography>

      {/* Machine translation is disclosed on every page, with the English
          original one click away and a way to report a mistake. */}
      <Alert severity="info" icon={false} sx={{ mb: 3, fontSize: 13.5 }}>
        {ES.article.machineTranslated}{" "}
        <a href={`${EN}/article/${story.enSlug}`} hrefLang="en" lang="en">{ES.article.readOriginal}</a>
        {" · "}
        <a href={`mailto:${CONTACT}?subject=${encodeURIComponent(`Traducción: ${story.slug}`)}`}>{ES.article.reportIssue}</a>
      </Alert>

      {splitIntoParagraphs(story.body ?? story.summary).map((p, i) => (
        <Typography key={i} variant="body1" sx={{ mb: 2.25, lineHeight: 1.7 }}>
          {p}
        </Typography>
      ))}

      <Box sx={{ mt: 3 }}>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
          {ES.article.share}
        </Typography>
        <ShareButtons url={url} title={story.title} />
      </Box>

      <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <a href={story.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
          <Typography variant="caption" sx={{ color: "text.disabled" }}>
            {ES.article.originalSource}: {story.sourceName} ↗
          </Typography>
        </a>
      </Box>

      {related.length > 0 && (
        <Box component="aside" sx={{ mt: 5 }}>
          <Typography variant="h2" sx={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "1.2rem", mb: 1.5 }}>
            {ES.article.related} {categoryLabelEs(story.category)}
          </Typography>
          <Stack spacing={1.5}>
            {related.map((r) => (
              <StoryCard key={r.id} article={{ ...r, highlighted: false }} locale="es" />
            ))}
          </Stack>
        </Box>
      )}
    </Container>
  );
}
