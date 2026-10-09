import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { appEvent } from "@/db/schema";

// Counts install-funnel events (see trackAppEvent in components/appPrompts.ts).
// Anonymous: only a whitelisted kind is stored, incremented per UTC day.
export const dynamic = "force-dynamic";

const KINDS = new Set([
  "session", "standalone_launch", "install_banner_shown", "ios_banner_shown",
  "install_clicked", "install_accepted", "install_declined", "app_installed",
]);

export async function POST(request: Request) {
  try {
    const { kind } = (await request.json()) as { kind?: unknown };
    if (typeof kind !== "string" || !KINDS.has(kind)) return new NextResponse(null, { status: 400 });
    const day = new Date().toISOString().slice(0, 10);
    await db.insert(appEvent).values({ day, kind, count: 1 })
      .onConflictDoUpdate({ target: [appEvent.day, appEvent.kind], set: { count: sql`${appEvent.count} + 1` } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("app-event endpoint failed:", err);
    return new NextResponse(null, { status: 500 });
  }
}
