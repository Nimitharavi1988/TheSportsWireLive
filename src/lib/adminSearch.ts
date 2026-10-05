import { and, ilike, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// Admin title search. It used to be one ILIKE on the whole typed phrase, which
// finds nothing if any character differs from the stored title: on 2026-10-04 a
// published BBC Sport story "Ronaldo still 'greatest symbol' of Portugal -  Fernandes"
// (two spaces, a straight apostrophe) could not be found by typing that title,
// because a single space between "-" and "Fernandes" matched nothing. Typographic
// quotes, dashes and doubled spaces vary between sources, so the search now
// matches on the WORDS only: every word typed must appear somewhere in the title.

const MAX_WORDS = 8;

// Letters and digits only, so punctuation, quote style and spacing don't matter.
export function searchWords(q: string): string[] {
  return [...new Set((q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []))].slice(0, MAX_WORDS);
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

// A condition for "title contains every word of q". A query with no words in it
// (only punctuation) falls back to the literal text; "%" and "_" never act as
// wildcards.
export function titleSearch(column: AnyPgColumn, q: string): SQL {
  const words = searchWords(q);
  if (words.length === 0) return ilike(column, `%${escapeLike(q.trim())}%`);
  return and(...words.map((w) => ilike(column, `%${escapeLike(w)}%`))) as SQL;
}
