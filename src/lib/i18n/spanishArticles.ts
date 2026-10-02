import { db } from "@/db";
import { article, articleTranslation } from "@/db/schema";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

// Read side of the Spanish site: a published English article joined to its
// 'translated' Spanish row. Spanish pages show ONLY translated articles —
// never an English fallback. title/summary/body/slug here are the Spanish
// text; enSlug points back at the English original.

export type SpanishStory = {
  id: string;
  slug: string;
  enSlug: string;
  title: string;
  summary: string;
  body: string | null;
  category: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  heroImageUrl: string | null;
  heroImageCredit: string | null;
  heroImageCreditUrl: string | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  sourceName: string;
  sourceUrl: string;
};

const columns = {
  id: article.id,
  slug: articleTranslation.slug,
  enSlug: article.slug,
  title: articleTranslation.title,
  summary: articleTranslation.summary,
  body: articleTranslation.body,
  category: article.category,
  publishedAt: article.publishedAt,
  createdAt: article.createdAt,
  updatedAt: article.updatedAt,
  heroImageUrl: article.heroImageUrl,
  heroImageCredit: article.heroImageCredit,
  heroImageCreditUrl: article.heroImageCreditUrl,
  homeCrestUrl: article.homeCrestUrl,
  awayCrestUrl: article.awayCrestUrl,
  homeTeam: article.homeTeam,
  awayTeam: article.awayTeam,
  sourceName: article.sourceName,
  sourceUrl: article.sourceUrl,
};

const visible = and(
  eq(article.status, "published"),
  eq(articleTranslation.locale, "es"),
  eq(articleTranslation.status, "translated"),
);

export async function listSpanishStories(opts: { limit: number; categories?: string[]; excludeId?: string }): Promise<SpanishStory[]> {
  const rows = await db
    .select(columns)
    .from(articleTranslation)
    .innerJoin(article, eq(article.id, articleTranslation.articleId))
    .where(and(
      visible,
      opts.categories ? inArray(article.category, opts.categories) : undefined,
      opts.excludeId ? ne(article.id, opts.excludeId) : undefined,
    ))
    .orderBy(desc(article.createdAt))
    .limit(opts.limit);
  return rows as SpanishStory[];
}

export async function getSpanishStory(slug: string): Promise<SpanishStory | null> {
  const rows = await db
    .select(columns)
    .from(articleTranslation)
    .innerJoin(article, eq(article.id, articleTranslation.articleId))
    .where(and(visible, eq(articleTranslation.slug, slug)))
    .limit(1);
  return (rows[0] as SpanishStory | undefined) ?? null;
}

export async function searchSpanishStories(query: string, limit = 30): Promise<SpanishStory[]> {
  const rows = await db
    .select(columns)
    .from(articleTranslation)
    .innerJoin(article, eq(article.id, articleTranslation.articleId))
    .where(and(visible, sql`"ArticleTranslation"."searchVector" @@ websearch_to_tsquery('spanish', ${query})`))
    .orderBy(sql`ts_rank("ArticleTranslation"."searchVector", websearch_to_tsquery('spanish', ${query})) desc`, desc(article.createdAt))
    .limit(limit);
  return rows as SpanishStory[];
}
