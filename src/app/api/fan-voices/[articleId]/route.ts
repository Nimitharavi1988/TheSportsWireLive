import { NextRequest, NextResponse } from "next/server";
import { getOrCreateVoterId } from "@/lib/voterCookie";
import { isBotUserAgent } from "@/lib/fan";
import { checkVoice, MAX_VOICES_PER_DAY } from "@/lib/fanFeedback";
import { listApprovedVoices, myVoiceStatus, saveVoice, voicesOpenFor, voicesSentToday } from "@/lib/fanFeedbackStore";
import { bumpAppEventQuietly } from "@/lib/appEvents";

// Fan Voices: GET returns the approved takes (and whether this visitor can add
// one); POST adds a take, which stays hidden until a person approves it.
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const voterId = await getOrCreateVoterId();
  const [open, voices, mine] = await Promise.all([voicesOpenFor(articleId), listApprovedVoices(articleId), myVoiceStatus(articleId, voterId)]);
  return NextResponse.json({ open, voices, mine });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  if (isBotUserAgent(req.headers.get("user-agent"))) return NextResponse.json({ ok: true });
  const body = await req.json().catch(() => null);
  const checked = checkVoice(body);
  if (!checked.ok) return checked.error === "spam" ? NextResponse.json({ ok: true }) : NextResponse.json({ error: checked.error }, { status: 400 });
  if (!(await voicesOpenFor(articleId))) return NextResponse.json({ error: "Takes are not open for this match" }, { status: 403 });

  const voterId = await getOrCreateVoterId();
  if ((await voicesSentToday(voterId)) >= MAX_VOICES_PER_DAY) {
    return NextResponse.json({ error: "You have shared enough takes for today. Please come back tomorrow." }, { status: 429 });
  }
  if (!(await saveVoice(articleId, voterId, checked.value))) {
    return NextResponse.json({ error: "You have already shared a take on this match" }, { status: 409 });
  }
  await bumpAppEventQuietly("fan_voice_submitted");
  return NextResponse.json({ ok: true, status: "pending" });
}
