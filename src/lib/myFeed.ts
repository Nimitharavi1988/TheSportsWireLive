import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, or, like, desc } from "drizzle-orm";
import { isSelectableSport, type SelectableSport } from "./preferences";

export interface MyFeedArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  publishedAt: Date | null;
  heroImageUrl: string | null;
  heroImageCredit: string | null;
  heroImageCreditUrl: string | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
}

const MY_FEED_LIMIT = 12;

// Query-string input is client-writable, so this re-validates against the
// same known-category allowlist parseFavoriteSports uses for the cookie —
// never trusts the raw strings straight into a LIKE pattern.
export function parseSportsParam(raw: string | null): SelectableSport[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(isSelectableSport);
}

// Same prefix-match reasoning as the homepage's own category filter
// (page.tsx) — "football" should also catch "football/world-cup" rows,
// not just an exact "football" category value.
export async function fetchMyFeedArticles(sports: SelectableSport[]): Promise<MyFeedArticle[]> {
  if (sports.length === 0) return [];
  return db
    .select({
      id: article.id,
      slug: article.slug,
      title: article.title,
      category: article.category,
      publishedAt: article.publishedAt,
      heroImageUrl: article.heroImageUrl,
      heroImageCredit: article.heroImageCredit,
      heroImageCreditUrl: article.heroImageCreditUrl,
      homeCrestUrl: article.homeCrestUrl,
      awayCrestUrl: article.awayCrestUrl,
    })
    .from(article)
    .where(and(
      eq(article.status, "published"),
      or(...sports.map((sport) => like(article.category, `${sport}%`)))
    ))
    .orderBy(desc(article.trendingScore), desc(article.publishedAt))
    .limit(MY_FEED_LIMIT);
}
