/**
 * ONE-OFF diagnostic route (2026-09-19) — verifies whether Neon's raw HTTP
 * driver (@neondatabase/serverless's neon() function — plain fetch() calls,
 * no WebSocket, no Prisma, no query engine at all) works on Cloudflare
 * Workers. Different from the already-tested (and failed) Prisma
 * WebSocket-adapter path — this bypasses Prisma entirely.
 *
 * Completely isolated: separate connection, separate env var
 * (DATABASE_URL_DIRECT, same raw Neon string already used for the earlier
 * adapter test), raw SQL instead of Prisma Client. A failure here can't
 * affect the live site. Delete once the question is answered either way.
 */
import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const directUrl = process.env.DATABASE_URL_DIRECT;
  if (!directUrl) {
    return NextResponse.json({ error: "DATABASE_URL_DIRECT not set" }, { status: 500 });
  }

  try {
    const sql = neon(directUrl);
    const rows = await sql`SELECT count(*)::int AS count FROM "Article" WHERE status = 'published'`;
    return NextResponse.json({ ok: true, mode: "neon-http-raw-sql", publishedArticleCount: rows[0]?.count });
  } catch (err) {
    return NextResponse.json(
      { ok: false, mode: "neon-http-raw-sql", error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
