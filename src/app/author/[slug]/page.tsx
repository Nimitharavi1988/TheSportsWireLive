import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import { db } from "@/db";
import { article, author } from "@/db/schema";
import { ArticleThumb } from "@/components/ArticleThumb";
import { SiteBreadcrumbs } from "@/components/SiteBreadcrumbs";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { playerAvatarColor, playerInitials } from "@/lib/playerAvatar";

// A writer's page: who they are and everything published under their
// byline (original stories and rewrites — see lib/stories.ts). Named
// authors with a real page are part of how search engines judge a news
// site's credibility.
export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

const getAuthor = cache(async (slug: string) => {
  const [row] = await db.select().from(author).where(eq(author.slug, slug)).limit(1);
  return row ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const writer = await getAuthor((await params).slug);
  if (!writer) return {};
  return {
    title: `${writer.name} — Sports Writer at Sports Wire Live`,
    description: writer.bio?.slice(0, 160) || `Stories, previews and analysis by ${writer.name} for Sports Wire Live.`,
    alternates: { canonical: `/author/${writer.slug}` },
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const writer = await getAuthor((await params).slug);
  if (!writer) notFound();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const stories = await db
    .select({ slug: article.slug, title: article.title, category: article.category, publishedAt: article.publishedAt, heroImageUrl: article.heroImageUrl, homeCrestUrl: article.homeCrestUrl, awayCrestUrl: article.awayCrestUrl })
    .from(article)
    .where(and(eq(article.authorSlug, writer.slug), eq(article.status, "published")))
    .orderBy(desc(article.publishedAt))
    .limit(100);

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: writer.name,
    url: `${siteUrl}/author/${writer.slug}`,
    ...(writer.bio ? { description: writer.bio } : {}),
    worksFor: { "@type": "Organization", name: "Sports Wire Live", url: siteUrl },
  };
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([{ name: "Home", href: "/" }], { name: writer.name, href: `/author/${writer.slug}` }, siteUrl);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <SiteBreadcrumbs steps={[{ name: "Home", href: "/" }]} current={writer.name} />

      <Stack direction="row" spacing={2} sx={{ alignItems: "center", mt: 2, mb: 3 }}>
        <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: playerAvatarColor(writer.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22, flexShrink: 0 }}>
          {playerInitials(writer.name)}
        </Box>
        <Box>
          <Typography variant="h4" component="h1">{writer.name}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>Sports writer, Sports Wire Live</Typography>
        </Box>
      </Stack>
      {writer.bio && <Typography variant="body1" sx={{ mb: 4, lineHeight: 1.7 }}>{writer.bio}</Typography>}

      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>Stories by {writer.name}</Typography>
      {stories.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>No stories yet.</Typography>
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
