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

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const article = await db.article.findUnique({ where: { slug: params.slug } });
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: `/article/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.summary,
      type: "article",
      url: `/article/${article.slug}`,
    },
    twitter: {
      title: article.title,
      description: article.summary,
    },
  };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
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
    description: article.summary,
    ...(article.heroImageUrl ? { image: [article.heroImageUrl] } : {}),
    publisher: { "@type": "Organization", name: "Sports News" },
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {article.homeCrestUrl && article.awayCrestUrl ? (
        <Stack direction="row" spacing={2.5} alignItems="center" sx={{ mb: 2.5 }}>
          <img src={article.homeCrestUrl} alt={crestAltText(article.summary).home} width={64} height={64} />
          <Typography variant="body1" color="text.secondary" fontWeight={600}>
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
            sx={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 1.5, display: "block" }}
          />
          {article.heroImageCredit && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block" }}>
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

      <Chip label={article.category} size="small" color="primary" variant="outlined" sx={{ mb: 1.5 }} />
      <Typography variant="h4" component="h1" gutterBottom>
        {article.title}
      </Typography>

      {(article.body ?? article.summary).split(/\n+/).filter(Boolean).map((paragraph, i) => (
        <Typography key={i} variant="body1" sx={{ mb: 2 }}>
          {paragraph}
        </Typography>
      ))}

      <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <a href={article.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
          <Typography variant="body2" color="text.secondary">
            Original source: {article.sourceName} ↗
          </Typography>
        </a>
      </Box>

      {related.length > 0 && (
        <Paper variant="outlined" sx={{ p: 3, mt: 5 }}>
          <Typography variant="overline" color="text.secondary">
            More in {article.category}
          </Typography>
          <Stack divider={<Divider />} sx={{ mt: 1 }}>
            {related.map((r) => (
              <Link key={r.id} href={`/article/${r.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                <Typography variant="body2" fontWeight={500} sx={{ py: 1.25, "&:hover": { color: "primary.main" } }}>
                  {r.title}
                </Typography>
              </Link>
            ))}
          </Stack>
        </Paper>
      )}
    </Container>
  );
}
