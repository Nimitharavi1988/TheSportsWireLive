import { db } from "@/db";
import { poll, pollOption, pollVote, articleReaction } from "@/db/schema";
import { and, eq, count } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { ReactionType } from "@/db/schema";

export interface PollState {
  id: string;
  question: string;
  totalVotes: number;
  votedOptionId: string | null;
  options: { id: string; text: string; votes: number; percentage: number }[];
}

export interface ReactionState {
  total: number;
  counts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
}

export interface EngagementState {
  poll: PollState | null;
  reactions: ReactionState;
}

export async function getEngagementState(articleId: string, voterId: string): Promise<EngagementState> {
  const [pollRows, reactionCounts, myReactionRows] = await Promise.all([
    db.select().from(poll).where(eq(poll.articleId, articleId)).limit(1),
    db.select({ type: articleReaction.type, count: count() }).from(articleReaction)
      .where(eq(articleReaction.articleId, articleId)).groupBy(articleReaction.type),
    db.select({ type: articleReaction.type }).from(articleReaction)
      .where(and(eq(articleReaction.articleId, articleId), eq(articleReaction.cookieId, voterId))).limit(1),
  ]);
  const pollRow = pollRows[0] ?? null;
  const myReaction = myReactionRows[0] ?? null;

  const counts: Record<ReactionType, number> = { hype: 0, panic: 0, neutral: 0 };
  for (const row of reactionCounts) counts[row.type] = row.count;
  const total = counts.hype + counts.panic + counts.neutral;

  let pollState: PollState | null = null;
  if (pollRow) {
    const [optionRows, myVoteRows] = await Promise.all([
      db.select({ id: pollOption.id, text: pollOption.text, votes: count(pollVote.id) })
        .from(pollOption)
        .leftJoin(pollVote, eq(pollVote.optionId, pollOption.id))
        .where(eq(pollOption.pollId, pollRow.id))
        .groupBy(pollOption.id, pollOption.text),
      db.select({ optionId: pollVote.optionId }).from(pollVote)
        .where(and(eq(pollVote.pollId, pollRow.id), eq(pollVote.cookieId, voterId))).limit(1),
    ]);
    const totalVotes = optionRows.reduce((sum, o) => sum + o.votes, 0);
    pollState = {
      id: pollRow.id,
      question: pollRow.question,
      totalVotes,
      votedOptionId: myVoteRows[0]?.optionId ?? null,
      options: optionRows.map((o) => ({
        id: o.id,
        text: o.text,
        votes: o.votes,
        percentage: totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0,
      })),
    };
  }

  return { poll: pollState, reactions: { total, counts, myReaction: myReaction?.type ?? null } };
}

// Throws (unique-constraint violation) if this voter already voted on this
// poll — the route handler translates that into a 409, not a second vote.
export async function recordVote(pollId: string, optionId: string, voterId: string, ipAddress: string | null) {
  await db.insert(pollVote).values({ id: createId(), pollId, optionId, cookieId: voterId, ipAddress: ipAddress ?? undefined });
}

// A reaction can change (upsert), unlike a poll vote — "I was hyped, now
// I'm panicking" is a legitimate, expected state change as a story develops,
// whereas a poll answer is a one-time choice.
export async function recordReaction(articleId: string, type: ReactionType, voterId: string, ipAddress: string | null) {
  await db.insert(articleReaction)
    .values({ id: createId(), articleId, type, cookieId: voterId, ipAddress: ipAddress ?? undefined })
    .onConflictDoUpdate({
      target: [articleReaction.articleId, articleReaction.cookieId],
      set: { type },
    });
}
