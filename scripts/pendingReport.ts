import { db } from "../src/db";
import { article } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { hasRealImage, isAutoApprovable } from "../src/lib/ingestion/autoApprove";

async function main() {
  const rows = await db.select({
    id: article.id, title: article.title, body: article.body,
    heroImageUrl: article.heroImageUrl, homeCrestUrl: article.homeCrestUrl,
    playerNewsSourced: article.playerNewsSourced, sourceName: article.sourceName,
    category: article.category, createdAt: article.createdAt,
  }).from(article).where(eq(article.status, "pending_review"));

  console.log(`Total pending_review: ${rows.length}`);

  let noImage = 0, thinBody = 0, passesButStuck = 0;
  const bySource: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const r of rows) {
    const img = hasRealImage(r);
    const passes = isAutoApprovable(r);
    if (!img) noImage++;
    if (img && !passes) thinBody++;
    if (passes) passesButStuck++;
    bySource[r.sourceName] = (bySource[r.sourceName] ?? 0) + 1;
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  }

  console.log(`No real image (blocked on image): ${noImage}`);
  console.log(`Has image but body too short/missing: ${thinBody}`);
  console.log(`Passes isAutoApprovable but still pending (unexpected!): ${passesButStuck}`);
  console.log("\nBy source:");
  console.log(Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 15));
  console.log("\nBy category:");
  console.log(Object.entries(byCategory).sort((a, b) => b[1] - a[1]));

  const now = Date.now();
  const ages = rows.map((r) => (now - r.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const oldest = Math.max(...ages, 0);
  console.log(`\nOldest pending item: ${oldest.toFixed(1)} days`);
  console.log(`Items older than 3 days: ${ages.filter((a) => a > 3).length}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
