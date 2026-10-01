import { NextResponse } from "next/server";
import { readMatchDetail } from "@/lib/scores/matchDetailRead";

// The stored cricket scorecard for a live match page, which polls this every
// 30 seconds so the scorecard moves with the score above it. It reads the copy
// the scheduled job keeps (matchDetailSync.ts), never ESPN itself.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const detail = await readMatchDetail(id);
  const card = detail?.kind === "cricket" ? detail.card : { innings: [], yetToBat: [] };
  return NextResponse.json(card, { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } });
}
