import { NextRequest, NextResponse } from "next/server";
import { getOrCreateVoterId } from "@/lib/voterCookie";
import { isBotUserAgent } from "@/lib/fan";
import { checkFeedback, MAX_FEEDBACK_PER_DAY } from "@/lib/fanFeedback";
import { feedbackSentToday, saveFeedback } from "@/lib/fanFeedbackStore";
import { bumpAppEventQuietly } from "@/lib/appEvents";

// Private site feedback (thumb + optional note). Stored for admin only.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (isBotUserAgent(req.headers.get("user-agent"))) return NextResponse.json({ ok: true });
  const body = await req.json().catch(() => null);
  const checked = checkFeedback(body);
  // A filled honeypot looks like success to the bot and stores nothing.
  if (!checked.ok) return checked.error === "spam" ? NextResponse.json({ ok: true }) : NextResponse.json({ error: checked.error }, { status: 400 });

  const voterId = await getOrCreateVoterId();
  if ((await feedbackSentToday(voterId)) >= MAX_FEEDBACK_PER_DAY) {
    return NextResponse.json({ error: "Thanks, we have your notes for today. Please try again tomorrow." }, { status: 429 });
  }
  await saveFeedback(voterId, checked.value);
  await bumpAppEventQuietly(checked.value.sentiment === "up" ? "feedback_up" : "feedback_down");
  return NextResponse.json({ ok: true });
}
