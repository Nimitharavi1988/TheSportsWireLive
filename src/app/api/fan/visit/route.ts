import { NextRequest, NextResponse } from "next/server";
import { getOrCreateVoterId } from "@/lib/voterCookie";
import { isBotUserAgent, resolveVisitDay } from "@/lib/fan";
import { recordVisit } from "@/lib/fanStore";

// Counts one active day for the anonymous visitor (see FanBeacon). Dynamic and
// per-visitor: the cookie decides whose card this is.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Crawlers and link-preview fetchers never fire the interaction that
  // triggers this, but refuse them anyway so they cannot create visitors.
  if (isBotUserAgent(req.headers.get("user-agent"))) return new NextResponse(null, { status: 204 });
  try {
    const body = await req.json().catch(() => null);
    const day = resolveVisitDay(body?.day);
    const voterId = await getOrCreateVoterId();
    const summary = await recordVisit(voterId, day);
    return NextResponse.json({
      streak: summary.currentStreak,
      days: summary.daysVisited,
      tier: summary.tier?.label ?? null,
    });
  } catch (err) {
    console.error("fan visit failed:", err);
    return new NextResponse(null, { status: 500 });
  }
}
