/**
 * Competitions (series and events) as searchable, followable entities —
 * the same seriesKey/seriesLabel grouping the /series pages already use
 * (cricketSeries.ts for bilateral cricket series like "India vs West
 * Indies • ODI", eventTagging.ts for events like the Asian Games and IPL).
 *
 * Unlike clubs/players (static lists in code), competitions come from the
 * database, so this is server-only and async. Only "active" ones — a
 * published story within ACTIVE_WINDOW_DAYS — are offered in search and the
 * homepage "Happening now" row, so a finished one-story series from weeks
 * ago doesn't clutter results. A follow on a competition that has since
 * gone quiet still resolves (resolveCompetitionEntities falls back to any
 * published story with that key), so it doesn't silently vanish from the
 * visitor's For You chips.
 */
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, count, desc, eq, gt, inArray, isNotNull, max, min, sql } from "drizzle-orm";
import { normalizeForSearch, resolveFollows, type EntityResult, type ExtraSearchItem } from "./entitySearch";
import { competitionToEntity, isHappeningNow, type CompetitionFields } from "./competitionEntity";

export { competitionToEntity };
import { followKey, type FollowRef } from "./follows";

export const ACTIVE_WINDOW_DAYS = 14;
const CACHE_MS = 5 * 60 * 1000;

export interface Competition extends CompetitionFields {
  storyCount: number;
  // Stories in the last 7 days — feeds isHappeningNow for bilateral series.
  recentCount: number;
  lastPublishedAt: Date | null;
}

let cache: { at: number; data: Competition[] } | null = null;

// Newest activity first. Cached per server instance for a few minutes —
// the header search calls this on every keystroke.
export async function getActiveCompetitions(): Promise<Competition[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const rows = await db
    .select({
      key: article.seriesKey,
      label: article.seriesLabel,
      storyCount: count(),
      recentCount: sql<number>`count(*) filter (where ${article.publishedAt} > now() - interval '7 days')`,
      lastPublishedAt: max(article.publishedAt),
      categories: sql<number>`count(distinct ${article.category})`,
      category: min(article.category),
    })
    .from(article)
    .where(and(
      eq(article.status, "published"),
      isNotNull(article.seriesKey),
      gt(article.publishedAt, sql`now() - make_interval(days => ${ACTIVE_WINDOW_DAYS})`)
    ))
    .groupBy(article.seriesKey, article.seriesLabel)
    .orderBy(desc(max(article.publishedAt)));

  const data = rows.flatMap((r) =>
    r.key && r.label
      ? [{
          key: r.key,
          label: r.label,
          storyCount: Number(r.storyCount),
          recentCount: Number(r.recentCount),
          lastPublishedAt: r.lastPublishedAt,
          // Top-level sport only: "football/world-cup" counts as football.
          category: Number(r.categories) === 1 && r.category ? r.category.split("/")[0] : null,
        }]
      : []
  );
  cache = { at: Date.now(), data };
  return data;
}

export async function competitionSearchItems(): Promise<ExtraSearchItem[]> {
  return (await getActiveCompetitions()).map((c) => ({
    entity: competitionToEntity(c),
    // Label first (scored as the name), then the key with dashes as spaces
    // so "india vs west indies odi" typed without the "•" still matches.
    haystack: [normalizeForSearch(c.label.replace("•", " ")), normalizeForSearch(c.key.replace(/-/g, " "))],
  }));
}

// Competitions actually being played now (see isHappeningNow) — a subset of
// the active (searchable) ones. Optionally narrowed to one sport; multi-
// sport events have no single category, so they only show unfiltered.
export async function getHappeningNow(category?: string): Promise<Competition[]> {
  const now = new Date();
  return (await getActiveCompetitions()).filter(
    (c) => isHappeningNow(c, now) && (!category || c.category === category.split("/")[0])
  );
}

export async function happeningNowEntities(limit: number, category?: string): Promise<EntityResult[]> {
  return (await getHappeningNow(category)).slice(0, limit).map((c) => competitionToEntity(c));
}

// Labels for followed competitions, including ones no longer active.
export async function resolveCompetitionEntities(keys: string[]): Promise<Map<string, EntityResult>> {
  const result = new Map<string, EntityResult>();
  if (keys.length === 0) return result;
  for (const c of await getActiveCompetitions()) {
    if (keys.includes(c.key)) result.set(c.key, competitionToEntity(c));
  }
  const missing = keys.filter((k) => !result.has(k));
  if (missing.length > 0) {
    const rows = await db
      .select({
        key: article.seriesKey,
        label: article.seriesLabel,
        categories: sql<number>`count(distinct ${article.category})`,
        category: min(article.category),
      })
      .from(article)
      .where(and(eq(article.status, "published"), inArray(article.seriesKey, missing)))
      .groupBy(article.seriesKey, article.seriesLabel);
    for (const r of rows) {
      if (!r.key || !r.label) continue;
      const category = Number(r.categories) === 1 && r.category ? r.category.split("/")[0] : null;
      result.set(r.key, competitionToEntity({ key: r.key, label: r.label, category }));
    }
  }
  return result;
}

// resolveFollows (entitySearch.ts) for every follow kind, competitions
// included — keeps the visitor's own follow order.
export async function resolveAllFollows(refs: FollowRef[]): Promise<EntityResult[]> {
  const competitions = await resolveCompetitionEntities(refs.filter((r) => r.kind === "series").map((r) => r.slug));
  const others = new Map(resolveFollows(refs.filter((r) => r.kind !== "series")).map((e) => [followKey(e), e]));
  return refs.flatMap((r) => {
    const entity = r.kind === "series" ? competitions.get(r.slug) : others.get(followKey(r));
    return entity ? [entity] : [];
  });
}
