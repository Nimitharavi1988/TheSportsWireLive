/**
 * Manual/legacy ingestion trigger:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/ingest
 *
 * NOT used by the automated cron anymore — .github/workflows/ingest-cron.yml
 * runs runIngest() directly on the GitHub Actions runner instead, since
 * Cloudflare Workers Free caps every request at 10ms of CPU time (not
 * wall-clock — fetch/sleep waiting doesn't count), which a real batch of
 * RSS/match items can't realistically fit into. This route will very likely
 * still fail with the same CPU-time error if called on the Free plan; it's
 * kept only as a manual trigger for whenever the Workers plan is upgraded.
 * The CRON_SECRET check stops randoms from triggering ingestion (and racking
 * up API calls) by hitting this URL directly.
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
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}
