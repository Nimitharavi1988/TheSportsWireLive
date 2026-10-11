import { NextResponse } from "next/server";
import { bumpAppEvent, CLIENT_APP_EVENT_KINDS } from "@/lib/appEvents";

// Counts install-funnel and fan-card events (see trackAppEvent in components/appPrompts.ts).
// Anonymous: only a whitelisted kind is stored, incremented per UTC day.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { kind } = (await request.json()) as { kind?: unknown };
    if (typeof kind !== "string" || !CLIENT_APP_EVENT_KINDS.has(kind)) return new NextResponse(null, { status: 400 });
    await bumpAppEvent(kind);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("app-event endpoint failed:", err);
    return new NextResponse(null, { status: 500 });
  }
}
