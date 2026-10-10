import { db } from "@/db";
import { socialPost, article } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";

// How many Shorts went to YouTube, per hour, over the last HOURS (default 24), with failures.
//   npx tsx --env-file=.dev.vars scripts/youtubeReport.ts
async function main() {
  const hours = Number(process.env.HOURS ?? 24);
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const rows = await db.select({ status: socialPost.status, at: socialPost.createdAt, postedAt: socialPost.postedAt, id: socialPost.externalPostId, err: socialPost.errorMessage, title: article.title })
    .from(socialPost).innerJoin(article, eq(socialPost.articleId, article.id))
    .where(and(eq(socialPost.platform, "youtube"), gte(socialPost.createdAt, since)))
    .orderBy(desc(socialPost.createdAt));
  const posted = rows.filter((r) => r.status === "posted");
  console.log(`Last ${hours}h: ${posted.length} posted, ${rows.length - posted.length} failed/queued\n`);
  const byHour = new Map<string, number>();
  for (const r of posted) { const k = (r.postedAt ?? r.at).toISOString().slice(0, 13) + ":00Z"; byHour.set(k, (byHour.get(k) ?? 0) + 1); }
  for (const [h, n] of [...byHour].sort()) console.log(`${h}  ${n}`);
  console.log("");
  for (const r of rows) console.log(`${r.status.padEnd(7)} ${r.id ? `https://youtube.com/shorts/${r.id}` : ""} ${r.title.slice(0, 60)}${r.err ? ` — ${r.err.slice(0, 120)}` : ""}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
