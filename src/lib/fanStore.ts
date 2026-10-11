/**
 * Database side of the fan card (rules in fan.ts): record a visit day for the
 * anonymous voter id and build the fan summary shown on /fan-card.
 */
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { fanVisit, poll, pollVote } from "@/db/schema";
import { bumpAppEventQuietly } from "./appEvents";
import { computeStreaks, earnedBadges, nextTier, tierFor, type Badge, type Tier } from "./fan";

export interface PredictionRecord {
  made: number;
  resolved: number;
  correct: number;
}

export interface FanSummary {
  daysVisited: number;
  currentStreak: number;
  bestStreak: number;
  tier: Tier | null;
  next: { tier: Tier; daysToGo: number } | null;
  predictions: PredictionRecord;
  badges: Badge[];
}

// How many recent visit days to read: enough for the 100-day tier and any streak we show.
const MAX_DAYS_READ = 400;

export async function getPredictionRecord(voterId: string): Promise<PredictionRecord> {
  const [row] = await db
    .select({
      made: count(),
      resolved: sql<number>`count(*) filter (where ${poll.resolvedOptionId} is not null)`,
      correct: sql<number>`count(*) filter (where ${poll.resolvedOptionId} = ${pollVote.optionId})`,
    })
    .from(pollVote)
    .innerJoin(poll, eq(poll.id, pollVote.pollId))
    .where(and(eq(pollVote.cookieId, voterId), eq(poll.kind, "prediction")));
  return { made: Number(row?.made ?? 0), resolved: Number(row?.resolved ?? 0), correct: Number(row?.correct ?? 0) };
}

export async function getFanSummary(voterId: string, today: string): Promise<FanSummary> {
  const [dayRows, predictions] = await Promise.all([
    db.select({ day: fanVisit.day }).from(fanVisit).where(eq(fanVisit.voterId, voterId)).orderBy(desc(fanVisit.day)).limit(MAX_DAYS_READ),
    getPredictionRecord(voterId),
  ]);
  const days = dayRows.map((r) => r.day);
  const streaks = computeStreaks(days, today);
  return {
    daysVisited: days.length,
    currentStreak: streaks.current,
    bestStreak: streaks.best,
    tier: tierFor(days.length),
    next: nextTier(days.length),
    predictions,
    badges: earnedBadges({
      daysVisited: days.length,
      bestStreak: streaks.best,
      predictionsMade: predictions.made,
      predictionsCorrect: predictions.correct,
    }),
  };
}

// Records one visit day (idempotent: one row per voter per day). When it is a
// new day, also counts it anonymously (new vs returning visitor) and counts
// every badge this visit earned for the first time.
export async function recordVisit(voterId: string, day: string): Promise<FanSummary> {
  const before = await getFanSummary(voterId, day);
  const inserted = await db.insert(fanVisit).values({ voterId, day }).onConflictDoNothing().returning({ day: fanVisit.day });
  if (inserted.length === 0) return before;

  const after = await getFanSummary(voterId, day);
  await bumpAppEventQuietly(before.daysVisited === 0 ? "fan_new_visitor" : "fan_return_visit");
  const had = new Set(before.badges.map((b) => b.id));
  for (const badge of after.badges) if (!had.has(badge.id)) await bumpAppEventQuietly(`badge_${badge.id}`);
  return after;
}
