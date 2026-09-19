/**
 * ONE-OFF diagnostic route (2026-09-18) — verifies whether Prisma's Neon
 * driver adapter (@prisma/adapter-neon, WebSocket-based Pool, no query
 * engine binary/WASM at all) actually works on Cloudflare Workers, as
 * opposed to Prisma's own native engines (confirmed blocked there — see
 * db.ts's header comment). This is genuinely untested: the adapter path is
 * already used for local dev, but never previously deployed to Workers.
 *
 * Completely isolated from the real app — separate PrismaClient instance,
 * separate env var (DATABASE_URL_DIRECT, the raw Neon connection string,
 * set independently in Cloudflare — NOT the existing DATABASE_URL every
 * other route/page depends on). A failure here can't affect the live site.
 *
 * Delete this route once the adapter-on-Workers question is answered
 * either way — it's not meant to be permanent.
 */
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../../../../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

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
    const adapter = new PrismaNeon({ connectionString: directUrl });
    const db = new PrismaClient({ adapter });
    const count = await db.article.count({ where: { status: "published" } });
    await db.$disconnect();
    return NextResponse.json({ ok: true, mode: "direct-neon-adapter", publishedArticleCount: count });
  } catch (err) {
    return NextResponse.json(
      { ok: false, mode: "direct-neon-adapter", error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
