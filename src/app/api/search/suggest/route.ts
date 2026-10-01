import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import { MIN_QUERY_LENGTH, buildPrefixTsQuery, popularEntities, searchEntities } from "@/lib/entitySearch";
import { happeningNowEntities, competitionSearchItems } from "@/lib/competitions";
import { fetchLiveNow, searchMatches } from "@/lib/scores/scoreboard";
import { parseMatchQuery } from "@/lib/scores/matchQuery";
import type { ScoreMatch } from "@/lib/scores/scoreboardModel";

// Search never fails because scores did.
const safely = (p: Promise<ScoreMatch[]>) => p.catch(() => [] as ScoreMatch[]);

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);

  // Empty box: competitions running now, then the fixed "Popular" list,
  // instead of a blank dropdown.
  if (q.length < MIN_QUERY_LENGTH) {
    // Games in play right now, so an empty box is useful on its own.
    const [live, liveGames] = await Promise.all([happeningNowEntities(4), safely(fetchLiveNow({ take: 12 }))]);
    const matches = liveGames.filter((m) => m.state === "live").slice(0, 3);
    return NextResponse.json(
      { entities: [], stories: [], matches, live, popular: popularEntities() },
      { headers: CACHE_HEADERS }
    );
  }

  const entities = searchEntities(q, 5, await competitionSearchItems());
  const parts = buildPrefixTsQuery(q);
  // See buildPrefixTsQuery for why the last word uses the simple config.
  const lastWord = parts && sql`(to_tsquery('simple', ${parts.partial + ":*"}) || to_tsquery('english', ${parts.partial}))`;
  const tsQuery = parts && (parts.complete ? sql`(to_tsquery('english', ${parts.complete}) && ${lastWord})` : lastWord);
  const matchQuery = parseMatchQuery(q);
  const [matches, stories] = await Promise.all([
    matchQuery ? safely(searchMatches(matchQuery, 3)) : Promise.resolve([] as ScoreMatch[]),
    tsQuery
    ? db
        .select({ id: article.id, slug: article.slug, title: article.title, category: article.category, publishedAt: article.publishedAt })
        .from(article)
        .where(and(eq(article.status, "published"), sql`"searchVector" @@ ${tsQuery}`))
        .orderBy(sql`ts_rank("searchVector", ${tsQuery}) DESC`, desc(article.publishedAt))
        .limit(5)
    : Promise.resolve([]),
  ]);

  return NextResponse.json({ entities, stories, matches, live: [], popular: [] }, { headers: CACHE_HEADERS });
}
