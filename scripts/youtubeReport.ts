import { db } from "@/db";
import { socialPost, article } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";

// YouTube Shorts report over the last HOURS (default 24): what went out, what failed (and how many hit
// YouTube's daily upload limit), each Short's public view count and age (read from its public watch page:
// the number viewers see), then views per channel and per sport. A sport's median is only worth reading
// with at least 5 Shorts that are 6+ hours old (marked with *); with fewer it is noise.
//   npx tsx --env-file=.env scripts/youtubeReport.ts          (HOURS=96 for a longer window)
// The title as uploaded to YouTube (the report otherwise shows our article headline, which hides the emoji and
// hashtags of the title test, youtube.ts titleVariantFor).
const uploadedTitles = new Map<string, string>();
async function viewsOf(id: string): Promise<number | null> {
  try {
    const html = await (await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
    const t = html.match(/<meta name="title" content="([^"]*)"/)?.[1];
    if (t) uploadedTitles.set(id, t.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
    const v = html.match(/"viewCount":"(\d+)"/)?.[1];
    return v === undefined ? null : Number(v);
  } catch {
    return null;
  }
}

const median = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
const channelOf = (destination: string) => (destination === "es-reel" ? "ES" : "EN");

async function main() {
  const hours = Number(process.env.HOURS ?? 24);
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const rows = await db.select({ status: socialPost.status, at: socialPost.createdAt, postedAt: socialPost.postedAt, id: socialPost.externalPostId, err: socialPost.errorMessage, title: article.title, category: article.category, destination: socialPost.destination })
    .from(socialPost).innerJoin(article, eq(socialPost.articleId, article.id))
    .where(and(eq(socialPost.platform, "youtube"), gte(socialPost.createdAt, since)))
    .orderBy(desc(socialPost.createdAt));
  const posted = rows.filter((r) => r.status === "posted");
  const limitHits = rows.filter((r) => r.status === "failed" && /exceeded the number of videos/i.test(r.err ?? "")).length;
  console.log(`Last ${hours}h: ${posted.length} posted, ${rows.length - posted.length} failed/queued (${limitHits} hit YouTube's upload limit)\n`);

  const views = new Map<string, number | null>();
  for (const r of posted) if (r.id) views.set(r.id, await viewsOf(r.id));

  for (const r of rows) {
    const v = r.id ? views.get(r.id) ?? null : null;
    const age = r.postedAt ? `${Math.round((Date.now() - r.postedAt.getTime()) / 60000)}m ago` : "";
    console.log(`${r.status.padEnd(7)} ${channelOf(r.destination)} ${String(v ?? "").padStart(5)} views ${age.padStart(9)}  ${r.id ? `https://youtube.com/shorts/${r.id}` : ""} ${((r.id ? uploadedTitles.get(r.id) : undefined) ?? r.title).slice(0, 90)}${r.err ? ` — ${r.err.replace(/\s+/g, " ").slice(0, 100)}` : ""}`);
  }

  const old = posted.filter((r) => r.id && r.postedAt && Date.now() - r.postedAt.getTime() > 6 * 3600 * 1000 && views.get(r.id) != null);
  console.log("\nViews per channel (Shorts 6+ hours old):");
  for (const ch of ["EN", "ES"]) {
    const v = old.filter((r) => channelOf(r.destination) === ch).map((r) => views.get(r.id!)!);
    console.log(`  ${ch}: ${v.length} Shorts, median ${median(v) ?? "-"}, total ${v.reduce((s, n) => s + n, 0)}, best ${v.length ? Math.max(...v) : "-"}`);
  }
  console.log("\nMedian views per channel and sport (Shorts 6+ hours old; * = at least 5 Shorts):");
  const by = new Map<string, number[]>();
  for (const r of old) { const k = `${channelOf(r.destination)} ${r.category.split("/")[0]}`; by.set(k, [...(by.get(k) ?? []), views.get(r.id!)!]); }
  for (const [k, v] of [...by].sort((a, b) => (median(b[1]) ?? 0) - (median(a[1]) ?? 0))) console.log(`  ${k.padEnd(26)} ${v.length >= 5 ? "*" : " "} n=${String(v.length).padStart(2)} median ${String(median(v)).padStart(5)} best ${Math.max(...v)}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
