// Meta limits the whole app's Graph API calls per hour ("Application request limit reached").
// While it's reached, every Instagram attempt fails the same way and each failed attempt makes
// extra calls, so retrying only prolongs it. After one such failure, Instagram attempts pause
// for COOLDOWN_MINUTES, then one attempt probes: if it fails, the pause restarts; if it works,
// posting resumes. A skipped attempt records no failed row, so it doesn't use up a Page's
// daily failure allowance either.
export const RATE_LIMIT_MESSAGE = "Application request limit reached";
export const COOLDOWN_MINUTES = 30;

export function cooldownActive(lastLimitFailure: Date | null, now: Date, minutes = COOLDOWN_MINUTES): boolean {
  return lastLimitFailure !== null && now.getTime() - lastLimitFailure.getTime() < minutes * 60_000;
}

// True when an Instagram post failed with the app limit error in the last COOLDOWN_MINUTES.
export async function instagramCoolingDown(now: Date = new Date()): Promise<boolean> {
  // Loaded here so the pure rule above can be unit-tested without a database connection.
  const [{ db }, { socialPost }, { and, eq, gte, like }] = await Promise.all([import("@/db"), import("@/db/schema"), import("drizzle-orm")]);
  const [row] = await db.select({ at: socialPost.createdAt }).from(socialPost)
    .where(and(
      eq(socialPost.platform, "instagram"),
      eq(socialPost.status, "failed"),
      like(socialPost.errorMessage, `%${RATE_LIMIT_MESSAGE}%`),
      gte(socialPost.createdAt, new Date(now.getTime() - COOLDOWN_MINUTES * 60_000)),
    ))
    .limit(1);
  return cooldownActive(row?.at ?? null, now);
}
