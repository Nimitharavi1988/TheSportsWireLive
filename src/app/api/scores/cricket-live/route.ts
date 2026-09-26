import { NextResponse } from "next/server";
import { liveCricketFromEspn } from "@/lib/scores/cricketRealtime";

// Live cricket scores straight from ESPN's scoreboard (updated ball by
// ball), for the real-time layer on score cards (lib/scores/cricketRealtime.ts).
// Cached and shared: at most one ESPN request per 15 seconds however many
// readers are watching; re-fetched in the background when stale.
export const revalidate = 15;

const ESPN_URL = "https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=us&lang=en";

export async function GET() {
  try {
    const res = await fetch(ESPN_URL, { next: { revalidate: 15 } });
    if (!res.ok) return NextResponse.json({ scores: [], fetchedAt: new Date().toISOString() });
    return NextResponse.json({ scores: liveCricketFromEspn(await res.json()), fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ scores: [], fetchedAt: new Date().toISOString() });
  }
}
