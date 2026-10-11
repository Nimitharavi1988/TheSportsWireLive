/**
 * Database side of fan feedback (rules in fanFeedback.ts): match ratings,
 * private site feedback, and Fan Voices with their admin review.
 */
import { and, avg, count, desc, eq, gte } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/db";
import { article, fanVoice, matchRating, poll, siteFeedback } from "@/db/schema";
import type { FeedbackInput, VoiceInput } from "./fanFeedback";

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// --- Match rating ---

export interface RatingState {
  open: boolean; // the match is over, so it can be rated
  average: number | null; // one decimal
  count: number;
  mine: number | null;
}

export async function getRatingState(articleId: string, voterId: string, matchFinished: boolean): Promise<RatingState> {
  const [[agg], [mine]] = await Promise.all([
    db.select({ average: avg(matchRating.rating), n: count() }).from(matchRating).where(eq(matchRating.articleId, articleId)),
    db.select({ rating: matchRating.rating }).from(matchRating).where(and(eq(matchRating.articleId, articleId), eq(matchRating.voterId, voterId))).limit(1),
  ]);
  const n = Number(agg?.n ?? 0);
  return {
    open: matchFinished,
    average: n > 0 && agg?.average ? Math.round(Number(agg.average) * 10) / 10 : null,
    count: n,
    mine: mine?.rating ?? null,
  };
}

// Returns true when this is the visitor's first rating of the match (a change
// of mind updates the row and is not counted again).
export async function saveRating(articleId: string, voterId: string, rating: number): Promise<boolean> {
  const existing = await db.select({ id: matchRating.id }).from(matchRating)
    .where(and(eq(matchRating.articleId, articleId), eq(matchRating.voterId, voterId))).limit(1);
  await db.insert(matchRating)
    .values({ id: createId(), articleId, voterId, rating })
    .onConflictDoUpdate({ target: [matchRating.articleId, matchRating.voterId], set: { rating } });
  return existing.length === 0;
}

export async function isFinishedMatch(articleId: string): Promise<boolean> {
  const [row] = await db.select({ matchStatus: article.matchStatus }).from(article).where(eq(article.id, articleId)).limit(1);
  return row?.matchStatus === "finished";
}

// --- Site feedback (private) ---

export async function feedbackSentToday(voterId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(siteFeedback)
    .where(and(eq(siteFeedback.voterId, voterId), gte(siteFeedback.createdAt, startOfTodayUtc())));
  return Number(row?.n ?? 0);
}

export async function saveFeedback(voterId: string, input: FeedbackInput): Promise<void> {
  await db.insert(siteFeedback).values({ id: createId(), voterId, sentiment: input.sentiment, note: input.note, page: input.page });
}

export async function listFeedback(limit = 200) {
  return db.select().from(siteFeedback).orderBy(siteFeedback.handled, desc(siteFeedback.createdAt)).limit(limit);
}

export async function setFeedbackHandled(id: string, handled: boolean): Promise<void> {
  await db.update(siteFeedback).set({ handled }).where(eq(siteFeedback.id, id));
}

// --- Fan Voices ---

// Takes are offered on matches that have a prediction poll (the big ones).
export async function voicesOpenFor(articleId: string): Promise<boolean> {
  const [row] = await db.select({ id: poll.id }).from(poll).where(and(eq(poll.articleId, articleId), eq(poll.kind, "prediction"))).limit(1);
  return Boolean(row);
}

export async function listApprovedVoices(articleId: string, limit = 10) {
  return db.select({ id: fanVoice.id, name: fanVoice.name, country: fanVoice.country, body: fanVoice.body })
    .from(fanVoice)
    .where(and(eq(fanVoice.articleId, articleId), eq(fanVoice.status, "approved")))
    .orderBy(desc(fanVoice.reviewedAt))
    .limit(limit);
}

export async function voicesSentToday(voterId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(fanVoice)
    .where(and(eq(fanVoice.voterId, voterId), gte(fanVoice.createdAt, startOfTodayUtc())));
  return Number(row?.n ?? 0);
}

// Returns false when this visitor already shared a take on this match.
export async function saveVoice(articleId: string, voterId: string, input: VoiceInput): Promise<boolean> {
  const inserted = await db.insert(fanVoice)
    .values({ id: createId(), articleId, voterId, name: input.name, country: input.country, body: input.body })
    .onConflictDoNothing()
    .returning({ id: fanVoice.id });
  return inserted.length > 0;
}

export async function myVoiceStatus(articleId: string, voterId: string): Promise<string | null> {
  const [row] = await db.select({ status: fanVoice.status }).from(fanVoice)
    .where(and(eq(fanVoice.articleId, articleId), eq(fanVoice.voterId, voterId))).limit(1);
  return row?.status ?? null;
}

export async function listPendingVoices(limit = 100) {
  return db.select({
    id: fanVoice.id, name: fanVoice.name, country: fanVoice.country, body: fanVoice.body, createdAt: fanVoice.createdAt,
    articleId: fanVoice.articleId, slug: article.slug, title: article.title,
  })
    .from(fanVoice)
    .innerJoin(article, eq(article.id, fanVoice.articleId))
    .where(eq(fanVoice.status, "pending"))
    .orderBy(fanVoice.createdAt)
    .limit(limit);
}

export async function reviewVoice(id: string, status: "approved" | "rejected"): Promise<void> {
  await db.update(fanVoice).set({ status, reviewedAt: new Date() }).where(eq(fanVoice.id, id));
}
