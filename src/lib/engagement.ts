import { db } from "./db";
import type { ReactionType } from "../../generated/prisma/client";

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
  const [poll, reactionCounts, myReaction] = await Promise.all([
    db.poll.findUnique({
      where: { articleId },
      include: {
        options: { include: { _count: { select: { votes: true } } } },
        votes: { where: { cookieId: voterId }, select: { optionId: true } },
      },
    }),
    db.articleReaction.groupBy({ by: ["type"], where: { articleId }, _count: true }),
    db.articleReaction.findUnique({
      where: { articleId_cookieId: { articleId, cookieId: voterId } },
      select: { type: true },
    }),
  ]);

  const counts: Record<ReactionType, number> = { hype: 0, panic: 0, neutral: 0 };
  for (const row of reactionCounts) counts[row.type] = row._count;
  const total = counts.hype + counts.panic + counts.neutral;

  let pollState: PollState | null = null;
  if (poll) {
    const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0);
    pollState = {
      id: poll.id,
      question: poll.question,
      totalVotes,
      votedOptionId: poll.votes[0]?.optionId ?? null,
      options: poll.options.map((o) => ({
        id: o.id,
        text: o.text,
        votes: o._count.votes,
        percentage: totalVotes > 0 ? Math.round((o._count.votes / totalVotes) * 100) : 0,
      })),
    };
  }

  return { poll: pollState, reactions: { total, counts, myReaction: myReaction?.type ?? null } };
}

// Throws (unique-constraint violation) if this voter already voted on this
// poll — the route handler translates that into a 409, not a second vote.
export async function recordVote(pollId: string, optionId: string, voterId: string, ipAddress: string | null) {
  await db.pollVote.create({
    data: { pollId, optionId, cookieId: voterId, ipAddress: ipAddress ?? undefined },
  });
}

// A reaction can change (upsert), unlike a poll vote — "I was hyped, now
// I'm panicking" is a legitimate, expected state change as a story develops,
// whereas a poll answer is a one-time choice.
export async function recordReaction(articleId: string, type: ReactionType, voterId: string, ipAddress: string | null) {
  await db.articleReaction.upsert({
    where: { articleId_cookieId: { articleId, cookieId: voterId } },
    create: { articleId, type, cookieId: voterId, ipAddress: ipAddress ?? undefined },
    update: { type },
  });
}
