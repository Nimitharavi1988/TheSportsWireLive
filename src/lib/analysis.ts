import { db } from "@/db";
import { article, author } from "@/db/schema";
import { and, desc, eq, like } from "drizzle-orm";
import { ORIGINAL_SOURCE } from "./stories";

// The site's own published stories (written in admin — lib/stories.ts),
// newest first: the Analysis page and the home page's Analysis strip.
export async function fetchAnalysis(opts: { category?: string; limit: number }) {
  return db
    .select({
      slug: article.slug, title: article.title, summary: article.summary, category: article.category, storyKind: article.storyKind,
      publishedAt: article.publishedAt, heroImageUrl: article.heroImageUrl, homeCrestUrl: article.homeCrestUrl, awayCrestUrl: article.awayCrestUrl,
      authorName: author.name, authorSlug: author.slug,
    })
    .from(article)
    .leftJoin(author, eq(author.slug, article.authorSlug))
    .where(and(
      eq(article.status, "published"),
      eq(article.sourceName, ORIGINAL_SOURCE),
      ...(opts.category ? [like(article.category, `${opts.category.split("/")[0]}%`)] : [])
    ))
    .orderBy(desc(article.publishedAt))
    .limit(opts.limit);
}

export type AnalysisItem = Awaited<ReturnType<typeof fetchAnalysis>>[number];
