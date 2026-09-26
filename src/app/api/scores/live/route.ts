import { NextResponse } from "next/server";
import { fetchLiveNow, fetchScoreMatchesByIds } from "@/lib/scores/scoreboard";
import { MAX_LIVE_IDS } from "@/lib/scores/liveUpdates";

// Small JSON feed for in-place live score updates (see
// src/lib/scores/liveUpdates.ts):
//   ?ids=a,b,c           fresh cards for those matches
//   ?take=14[&sport=x]   the "live now" list (ticker, phone score row)
export const dynamic = "force-dynamic";

const MAX_TAKE = 30;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const idsParam = params.get("ids");
    let matches;
    if (idsParam !== null) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter((s) => /^[\w-]{1,40}$/.test(s)).slice(0, MAX_LIVE_IDS);
      matches = await fetchScoreMatchesByIds(ids);
    } else {
      const take = Math.min(MAX_TAKE, Math.max(1, Number(params.get("take")) || 14));
      const sport = params.get("sport");
      matches = await fetchLiveNow({ take, sport: sport && /^[a-z-]{1,30}$/.test(sport) ? sport : undefined });
    }
    // Short browser cache: several widgets/tabs polling at once share it.
    return NextResponse.json({ matches }, { headers: { "Cache-Control": "public, max-age=20" } });
  } catch (err) {
    console.error("live scores endpoint failed:", err);
    return NextResponse.json({ matches: [] }, { status: 500 });
  }
}
