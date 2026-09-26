import { db } from "@/db";
import { article } from "@/db/schema";
import { and, desc, eq, gte, isNotNull, max } from "drizzle-orm";
import { CATEGORY_META } from "@/lib/categoryMeta";
import { categoryChipStyle } from "@/lib/categoryDisplay";

// The sports a story can be filed under, as editor menu options.
export function storyCategories(): { value: string; label: string }[] {
  return Object.keys(CATEGORY_META).map((value) => ({
    value,
    label: value.includes("/") ? CATEGORY_META[value].title.split(",")[0] : categoryChipStyle(value).label,
  }));
}

// Series and events with stories in the last 120 days, newest first — the
// editor's "Series or event" menu. `current` keeps a story's own series
// listed even when it's older.
export async function storySeriesOptions(current?: string | null): Promise<{ key: string; label: string }[]> {
  const rows = await db
    .select({ key: article.seriesKey, label: max(article.seriesLabel) })
    .from(article)
    .where(and(isNotNull(article.seriesKey), isNotNull(article.seriesLabel), gte(article.createdAt, new Date(Date.now() - 120 * 24 * 60 * 60 * 1000))))
    .groupBy(article.seriesKey)
    .orderBy(desc(max(article.createdAt)));
  const options = rows.flatMap((r) => (r.key && r.label ? [{ key: r.key, label: r.label }] : []));
  if (current && !options.some((o) => o.key === current)) {
    const [own] = await db.select({ label: article.seriesLabel }).from(article).where(and(eq(article.seriesKey, current), isNotNull(article.seriesLabel))).limit(1);
    options.unshift({ key: current, label: own?.label ?? current });
  }
  return options;
}
