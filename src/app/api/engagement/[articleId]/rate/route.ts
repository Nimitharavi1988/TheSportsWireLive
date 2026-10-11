import { NextRequest, NextResponse } from "next/server";
import { getEngagementState } from "@/lib/engagement";
import { getOrCreateVoterId } from "@/lib/voterCookie";
import { checkRating } from "@/lib/fanFeedback";
import { isFinishedMatch, saveRating } from "@/lib/fanFeedbackStore";
import { bumpAppEventQuietly } from "@/lib/appEvents";

// Rate a finished match 1-5. Changing your mind updates the rating.
export async function POST(req: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const body = await req.json().catch(() => null);
  const checked = checkRating(body?.rating);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  if (!(await isFinishedMatch(articleId))) return NextResponse.json({ error: "Ratings open at full time" }, { status: 403 });

  const voterId = await getOrCreateVoterId();
  const isNew = await saveRating(articleId, voterId, checked.value);
  if (isNew) await bumpAppEventQuietly("match_rating");
  return NextResponse.json(await getEngagementState(articleId, voterId));
}
