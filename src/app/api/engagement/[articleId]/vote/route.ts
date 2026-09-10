import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "../../../../../../generated/prisma/client";
import { getEngagementState, recordVote } from "@/lib/engagement";
import { getOrCreateVoterId } from "@/lib/voterCookie";
import { db } from "@/lib/db";

function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const voterId = await getOrCreateVoterId();
  const body = await req.json().catch(() => null);
  const optionId = typeof body?.optionId === "string" ? body.optionId : null;
  if (!optionId) return NextResponse.json({ error: "optionId is required" }, { status: 400 });

  const option = await db.pollOption.findUnique({
    where: { id: optionId },
    select: { pollId: true, poll: { select: { articleId: true } } },
  });
  if (!option || option.poll.articleId !== articleId) {
    return NextResponse.json({ error: "Unknown poll option" }, { status: 404 });
  }

  try {
    await recordVote(option.pollId, optionId, voterId, clientIp(req));
  } catch (err) {
    // Unique constraint on (pollId, cookieId) — this voter already voted on
    // this poll. Not an error worth logging, just return current state.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }

  const state = await getEngagementState(articleId, voterId);
  return NextResponse.json(state);
}
