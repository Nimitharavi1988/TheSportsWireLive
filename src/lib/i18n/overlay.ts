import { db } from "@/db";
import { articleTranslation } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

// Display-time swap of an English Article row for its translation in a language
// edition. Selection logic (rankings, tag matching, related stories) keeps
// reading the English rows; only the text shown — title, summary, body and the
// URL slug — is replaced, so every English rule works unchanged.

export type Translated = { title: string; summary: string; body: string | null; slug: string };

/** Translated text for a set of article ids (only 'translated' rows). */
export async function fetchTranslationMap(locale: string, ids: string[]): Promise<Map<string, Translated>> {
  const map = new Map<string, Translated>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return map;
  const rows = await db
    .select({ articleId: articleTranslation.articleId, title: articleTranslation.title, summary: articleTranslation.summary, body: articleTranslation.body, slug: articleTranslation.slug })
    .from(articleTranslation)
    .where(and(eq(articleTranslation.locale, locale), eq(articleTranslation.status, "translated"), inArray(articleTranslation.articleId, unique)));
  for (const r of rows) if (r.title && r.summary && r.slug) map.set(r.articleId, { title: r.title, summary: r.summary, body: r.body, slug: r.slug });
  return map;
}

/** The row with its translated text swapped in (unchanged when there is none). */
export function localizeRow<T extends { id: string; title: string; summary: string; body: string | null; slug: string }>(map: Map<string, Translated>, row: T): T {
  const t = map.get(row.id);
  return t ? { ...row, title: t.title, summary: t.summary, body: t.body, slug: t.slug } : row;
}
