/**
 * Re-pick the hero photo of original stories whose automatic photo looks wrong
 * (a uniform chart, an old card, a logo; 2026-10-06), using the same rules as
 * the clean drafts (autoDraftRules.ts isUsablePhoto / candidatePeople).
 *
 *   npx tsx scripts/fixDraftPhotos.ts                 list: current photo and the proposed one, change nothing
 *   npx tsx scripts/fixDraftPhotos.ts --apply         save the proposed photos
 *   options: --hours N (24)  look at original stories updated in the last N hours
 *            --all   re-pick every story in the window, not only those with an obviously wrong photo
 *            --drafts-only   leave published stories alone
 *            --broken   only stories whose current photo no longer loads (checks every address)
 *            --only "text"   touch only stories whose title contains this text
 *            --skip "text"   leave stories whose title contains this text alone
 *            --env path/to/.dev.vars
 *
 * Only stories whose current photo fails the rules are touched. A story with
 * no suitable photo found is left as it is and reported.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function envFile(): string | null {
  const i = process.argv.indexOf("--env");
  const candidates = [i >= 0 ? process.argv[i + 1] : "", ".dev.vars", resolve("..", "TheSportsWireLive", ".dev.vars")].filter(Boolean);
  return candidates.map((p) => resolve(p)).find((p) => existsSync(p)) ?? null;
}

async function main() {
  const file = envFile();
  if (!file) { console.error("No .dev.vars found. Pass --env <path>."); process.exit(1); }
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^DATABASE_URL=(.*)$/.exec(line);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^"|"$/g, "");
  }
  const apply = process.argv.includes("--apply");
  const all = process.argv.includes("--all");
  const brokenOnly = process.argv.includes("--broken");
  const draftsOnly = process.argv.includes("--drafts-only");
  const oi = process.argv.indexOf("--only");
  const only = oi >= 0 ? (process.argv[oi + 1] ?? "").toLowerCase() : "";
  const si = process.argv.indexOf("--skip");
  const skip = si >= 0 ? (process.argv[si + 1] ?? "").toLowerCase() : "";
  const hi = process.argv.indexOf("--hours");
  const hours = hi >= 0 && Number(process.argv[hi + 1]) >= 1 ? Number(process.argv[hi + 1]) : 24;

  const { db } = await import("../src/db");
  const { article, articleTag } = await import("../src/db/schema");
  const { and, eq, gte, inArray } = await import("drizzle-orm");
  const { suggestCleanPhoto } = await import("../src/lib/stories/autoDraft");
  const { isUsablePhoto } = await import("../src/lib/stories/autoDraftRules");
  const { photoReachable } = await import("../src/lib/photoSearch");

  const rows = await db.select().from(article).where(and(
    eq(article.sourceName, "Sports Wire Live"),
    inArray(article.status, draftsOnly ? ["draft"] : ["published", "draft"]),
    gte(article.updatedAt, new Date(Date.now() - hours * 3600e3)),
  ));
  for (const row of rows) {
    const current = row.heroImageUrl ?? "";
    // The stored URL ends in the file name; judge it the way a search result is judged.
    const fileName = decodeURIComponent(current.split("?")[0].split("/").pop() ?? "").replace(/^\d+px-/, "");
    if (skip && row.title.toLowerCase().includes(skip)) continue;
    if (only && !row.title.toLowerCase().includes(only)) continue;
    if (brokenOnly) {
      // Only a photo that no longer loads is replaced.
      if (current && (await photoReachable(current))) continue;
    } else if (!all && current && isUsablePhoto({ title: fileName, width: 1600, height: 1000, importUrl: current })) continue;
    const tags = await db.select({ kind: articleTag.kind, slug: articleTag.slug }).from(articleTag).where(eq(articleTag.articleId, row.id));
    const found = await suggestCleanPhoto(row.body ?? "", tags);
    console.log(`\n${row.status.toUpperCase()}: ${row.title}\n  now:      ${fileName || "(none)"}`);
    if (!found) { console.log("  proposed: none found, left as it is"); continue; }
    console.log(`  proposed: ${found.photo.title} (${found.subject}) ${found.photo.creator} ${found.photo.license}`);
    if (apply) {
      await db.update(article).set({
        heroImageUrl: found.photo.importUrl,
        heroImageCredit: `Photo by ${found.photo.creator} (${found.photo.license}), via ${found.photo.sourceName}`,
        heroImageCreditUrl: found.photo.landingUrl,
        updatedAt: new Date(),
      }).where(eq(article.id, row.id));
      console.log("  saved");
    }
  }
  console.log(apply ? "\nDone." : "\nNothing changed (listing only). Run with --apply to save.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
