/**
 * Cron entry point for ingestion. On shared hosting, set up a cron job
 * that hits this URL on a schedule, e.g. every 15 minutes:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/ingest
 *
 * The CRON_SECRET check stops randoms from triggering your ingestion
 * (and racking up API calls) by hitting this URL directly.
 */
import { NextRequest, NextResponse } from "next/server";
import { runIngest } from "@/lib/ingestion/runIngest";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await runIngest();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Cron ingest failed:", err);
    // TEMPORARY — echo the real error back to the (already CRON_SECRET-
    // authenticated) caller so it can be diagnosed without needing
    // Cloudflare dashboard log access. Remove once root-caused.
    return NextResponse.json(
      {
        error: "Ingest failed",
        detail: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
      },
      { status: 500 }
    );
  }
}
