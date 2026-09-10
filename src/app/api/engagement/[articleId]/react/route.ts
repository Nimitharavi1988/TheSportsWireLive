import { NextRequest, NextResponse } from "next/server";
import { getEngagementState, recordReaction } from "@/lib/engagement";
import { getOrCreateVoterId } from "@/lib/voterCookie";

const VALID_TYPES = ["hype", "panic", "neutral"] as const;

function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const voterId = await getOrCreateVoterId();
  const body = await req.json().catch(() => null);
  const type = body?.type;

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }

  await recordReaction(articleId, type, voterId, clientIp(req));

  const state = await getEngagementState(articleId, voterId);
  return NextResponse.json(state);
}
