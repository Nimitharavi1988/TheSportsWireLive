import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, or, like, desc, inArray, type SQL } from "drizzle-orm";
import { titleMatchesAnyTerm } from "./titleMatch";
import { followMatchers } from "./entitySearch";
import { resolveCompetitionEntities } from "./competitions";
import { parseFollows, type FollowRef } from "./follows";
import { isSelectableSport } from "./preferences";

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
  // Names of the followed entities this story matched ("Arsenal", "Cricket")
  // — shown as the row's context line so it's clear why it's in the feed.
  matchedFollows: string[];
}

// Query-string input is client-writable. `follows` is the current format;
// `sports` is the older My Feed format, still accepted so a cached client
// bundle from before this change keeps working.
export function parseFollowsParams(follows: string | null, sports: string | null): FollowRef[] {
  if (follows) return parseFollows(follows);
  if (!sports) return [];
  return sports.split(",").map((s) => s.trim()).filter(isSelectableSport).map((slug) => ({ kind: "sport", slug }));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Newest first rather than trendingScore — a following feed is "what's new
// with my teams", the same ordering club/player pages already use.
export async function fetchFollowingArticles(refs: FollowRef[], limit = 30): Promise<MyFeedArticle[]> {
  const matchers = followMatchers(refs);
  const allTerms = matchers.titleTerms.flatMap((m) => m.terms);
  // Competitions match on the exact seriesKey the ingestion pipeline
  // assigned, not on headline words.
  const seriesKeys = refs.filter((r) => r.kind === "series").map((r) => r.slug);
  const competitions = await resolveCompetitionEntities(seriesKeys);
  const conditions: SQL[] = [
    ...(seriesKeys.length > 0 ? [inArray(article.seriesKey, seriesKeys)] : []),
    ...(allTerms.length > 0 ? [titleMatchesAnyTerm(allTerms)] : []),
    // Prefix match so "football" also catches "football/world-cup" rows,
    // same as the homepage's own category filter.
    ...matchers.categories.map((m) => like(article.category, `${m.category}%`)),
  ];
  if (conditions.length === 0) return [];

  const rows = await db
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
      seriesKey: article.seriesKey,
    })
    .from(article)
    .where(and(eq(article.status, "published"), or(...conditions)))
    .orderBy(desc(article.publishedAt))
    .limit(limit);

  // Same word-boundary rule titleMatchesAnyTerm applies in SQL, re-checked
  // per row here only to label which follow each story came from.
  const termPatterns = matchers.titleTerms.map((m) => ({
    name: m.name,
    pattern: new RegExp(`\\b(${m.terms.map(escapeRegex).join("|")})\\b`, "i"),
  }));
  return rows.map(({ seriesKey, ...row }) => ({
    ...row,
    matchedFollows: [
      ...(seriesKey && competitions.has(seriesKey) ? [competitions.get(seriesKey)!.name] : []),
      ...termPatterns.filter((t) => t.pattern.test(row.title)).map((t) => t.name),
      ...matchers.categories.filter((m) => row.category.startsWith(m.category)).map((m) => m.name),
    ],
  }));
}
