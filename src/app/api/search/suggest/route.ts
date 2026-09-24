import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import { MIN_QUERY_LENGTH, buildPrefixTsQuery, popularEntities, searchEntities } from "@/lib/entitySearch";
import { activeCompetitionEntities, competitionSearchItems } from "@/lib/competitions";

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);

  // Empty box: competitions running now, then the fixed "Popular" list,
  // instead of a blank dropdown.
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(
      { entities: [], stories: [], live: await activeCompetitionEntities(4), popular: popularEntities() },
      { headers: CACHE_HEADERS }
    );
  }

  const entities = searchEntities(q, 5, await competitionSearchItems());
  const parts = buildPrefixTsQuery(q);
  // See buildPrefixTsQuery for why the last word uses the simple config.
  const lastWord = parts && sql`(to_tsquery('simple', ${parts.partial + ":*"}) || to_tsquery('english', ${parts.partial}))`;
  const tsQuery = parts && (parts.complete ? sql`(to_tsquery('english', ${parts.complete}) && ${lastWord})` : lastWord);
  const stories = tsQuery
    ? await db
        .select({ id: article.id, slug: article.slug, title: article.title, category: article.category, publishedAt: article.publishedAt })
        .from(article)
        .where(and(eq(article.status, "published"), sql`"searchVector" @@ ${tsQuery}`))
        .orderBy(sql`ts_rank("searchVector", ${tsQuery}) DESC`, desc(article.publishedAt))
        .limit(5)
    : [];

  return NextResponse.json({ entities, stories, live: [], popular: [] }, { headers: CACHE_HEADERS });
}
