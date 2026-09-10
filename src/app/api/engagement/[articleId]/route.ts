import { NextRequest, NextResponse } from "next/server";
import { getEngagementState } from "@/lib/engagement";
import { getOrCreateVoterId } from "@/lib/voterCookie";

// Deliberately dynamic (no `revalidate`) — this reflects one specific
// visitor's own vote/reaction state via their httpOnly cookie, which an ISR
// cache would either leak across visitors or ignore entirely. The article
// page itself stays cached; only this small engagement fetch is per-request.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const voterId = await getOrCreateVoterId();
  const state = await getEngagementState(articleId, voterId);
  return NextResponse.json(state);
}
