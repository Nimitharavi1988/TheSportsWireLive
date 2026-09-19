import { NextRequest, NextResponse } from "next/server";
import { getEngagementState, recordVote } from "@/lib/engagement";
import { getOrCreateVoterId } from "@/lib/voterCookie";
import { db } from "@/db";
import { pollOption, poll } from "@/db/schema";
import { eq } from "drizzle-orm";

function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const voterId = await getOrCreateVoterId();
  const body = await req.json().catch(() => null);
  const optionId = typeof body?.optionId === "string" ? body.optionId : null;
  if (!optionId) return NextResponse.json({ error: "optionId is required" }, { status: 400 });

  const optionRows = await db.select({ pollId: pollOption.pollId, articleId: poll.articleId })
    .from(pollOption)
    .innerJoin(poll, eq(poll.id, pollOption.pollId))
    .where(eq(pollOption.id, optionId))
    .limit(1);
  const option = optionRows[0] ?? null;
  if (!option || option.articleId !== articleId) {
    return NextResponse.json({ error: "Unknown poll option" }, { status: 404 });
  }

  try {
    await recordVote(option.pollId, optionId, voterId, clientIp(req));
  } catch (err) {
    // Unique constraint on (pollId, cookieId) — this voter already voted on
    // this poll. Not an error worth logging, just return current state.
    // Postgres SQLSTATE 23505 = unique_violation (Neon's driver surfaces the
    // raw Postgres error code directly, unlike Prisma's own P2002 wrapper).
    if (!(err && typeof err === "object" && "code" in err && err.code === "23505")) throw err;
  }

  const state = await getEngagementState(articleId, voterId);
  return NextResponse.json(state);
}
