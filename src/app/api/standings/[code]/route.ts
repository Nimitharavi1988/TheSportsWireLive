import { NextRequest, NextResponse } from "next/server";
import { fetchStandingsTable, STANDINGS_LEAGUES } from "@/lib/ingestion/standings";

// Backs the homepage standings carousel's left/right arrows — only called
// when a visitor actually clicks to a league that wasn't server-rendered
// already, so real API cost scales with genuine interaction, not with
// homepage traffic/ISR regeneration frequency.
export const revalidate = 300;

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  if (!STANDINGS_LEAGUES.some((l) => l.code === code)) {
    return NextResponse.json({ error: "Unknown league code" }, { status: 400 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Standings not configured" }, { status: 503 });
  }

  const table = await fetchStandingsTable(apiKey, code);
  if (!table) {
    return NextResponse.json({ error: "Standings unavailable" }, { status: 502 });
  }

  return NextResponse.json(table);
}
