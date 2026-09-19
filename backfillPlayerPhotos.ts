import { db } from "./src/db";
import { article } from "./src/db/schema";
import { and, eq, like, asc } from "drizzle-orm";
import { fetchPersonPhoto, sportSearchHint } from "./src/lib/ingestion/wikimediaImages";
import { TRACKED_PLAYERS } from "./src/lib/players";

function findPlayer(title: string) {
  const lower = title.toLowerCase();
  return TRACKED_PLAYERS.find((p) => p.searchTerms.some((term) => lower.includes(term.toLowerCase())));
}

async function main() {
  const articles = await db.select({
    id: article.id, slug: article.slug, title: article.title, category: article.category,
    heroImageUrl: article.heroImageUrl, createdAt: article.createdAt,
  }).from(article)
    .where(and(eq(article.status, "published"), like(article.heroImageCredit, "%Wikimedia Commons%")))
    .orderBy(asc(article.createdAt));

  const groups = new Map<string, typeof articles>();
  for (const a of articles) {
    if (!a.heroImageUrl) continue;
    const group = groups.get(a.heroImageUrl) ?? [];
    group.push(a);
    groups.set(a.heroImageUrl, group);
  }

  let updated = 0;
  let skipped = 0;

  // Only groups with real, visible repetition (a 2-article overlap is easy
  // to miss on the site; 4+ of the same photo in "More headlines" is what
  // was actually reported) — narrows this one-off run to a scale that
  // finishes in a reasonable time given Wikimedia's throttling.
  for (const [imageUrl, group] of groups) {
    if (group.length < 4) continue;
    console.log(`\n${group.length} articles sharing one photo (${imageUrl}):`);
    // Keep the oldest article's photo as-is; give each newer duplicate a
    // shot at a different real photo of the same person.
    for (const a of group.slice(1)) {
      const player = findPlayer(a.title);
      if (!player) {
        console.log(`  skip "${a.title}" — no tracked player match`);
        skipped++;
        continue;
      }
      // Confirmed directly: a burst of requests early in the run succeeds,
      // then every request fails for the rest of the process — looks like
      // Wikimedia soft-throttling this IP/User-Agent once enough requests
      // land in a short window. A real pause between articles (not just
      // wikiFetch's own short internal retry) is what actually recovers.
      let photo = null;
      for (let i = 0; i < 3 && !photo; i++) {
        photo = await fetchPersonPhoto(player.name, sportSearchHint(player.sport), a.slug);
        if (!photo) await new Promise((r) => setTimeout(r, 3000));
      }
      if (!photo || photo.url === a.heroImageUrl) {
        console.log(`  no variant available for "${a.title}"`);
        skipped++;
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      await db.update(article)
        .set({ heroImageUrl: photo.url, heroImageCredit: photo.credit, heroImageCreditUrl: photo.creditUrl, updatedAt: new Date() })
        .where(eq(article.id, a.id));
      console.log(`  updated "${a.title}" -> ${photo.url}`);
      updated++;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log(`\nDone. ${updated} articles given a different photo, ${skipped} left unchanged (no tracked player match or no alternate photo found).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
