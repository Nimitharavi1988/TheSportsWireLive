import { db } from "@/db";
import { articleTranslation } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ES_SPORTS } from "./es";
import { LOCALES } from "./locales";

// English-side switches for the Spanish site. Everything the English pages show
// about Spanish (hreflang, switcher, article link, suggestion banner) is gated
// on ES_SITE_ENABLED=1 (a wrangler var), so the code can ship before the
// subdomain exists and be turned on in one place at launch.
export function esSiteEnabled(): boolean {
  return process.env.ES_SITE_ENABLED === "1";
}

export const ES_ORIGIN = `https://${LOCALES.es.host}`;

const ES_CATEGORIES = new Set(ES_SPORTS.map((s) => s.category));

/** Spanish URL for an English /sport/<category> page, or null if not covered. */
export function esSportUrl(category: string): string | null {
  return ES_CATEGORIES.has(category) ? `${ES_ORIGIN}/sport/${category}` : null;
}

/** Slug of the translated Spanish version of an article, if one is live. */
export async function spanishSlugFor(articleId: string): Promise<string | null> {
  if (!esSiteEnabled()) return null;
  try {
    const rows = await db
      .select({ slug: articleTranslation.slug })
      .from(articleTranslation)
      .where(and(eq(articleTranslation.articleId, articleId), eq(articleTranslation.locale, "es"), eq(articleTranslation.status, "translated")))
      .limit(1);
    return rows[0]?.slug ?? null;
  } catch {
    return null; // table missing / DB hiccup: simply no Spanish link
  }
}
