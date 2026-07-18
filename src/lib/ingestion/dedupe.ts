import crypto from "crypto";

/**
 * Deduplication rule (from the plan's pre-development checklist):
 * hash on normalized headline + date window, so the same story pulled
 * from two different sources (e.g. football-data.org fixture + an RSS
 * recap of the same match) doesn't get stored/posted twice.
 *
 * This is intentionally simple for MVP — normalize the title, strip
 * punctuation/casing, and bucket by day. Tighten this later (e.g. add
 * team-name extraction) if near-duplicate headlines slip through.
 */
export function computeDedupeHash(title: string, publishedAt: Date): string {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const dayBucket = publishedAt.toISOString().slice(0, 10); // YYYY-MM-DD

  return crypto
    .createHash("sha256")
    .update(`${normalizedTitle}|${dayBucket}`)
    .digest("hex");
}
