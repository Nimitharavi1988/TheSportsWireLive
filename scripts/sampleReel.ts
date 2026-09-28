import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { generatePosterContent } from "@/lib/ingestion/commentary";
import { renderReel } from "@/lib/social/reel";
import { musicStyleFor, REEL_MUSIC_STYLE_NAMES, type ReelMusicStyle } from "@/lib/social/reelMusic";

// Local preview of a reel: renders one from a real story (ARTICLE_ID, or
// the latest published story with a photo) into OUT_DIR (default
// ./reel-sample) — the MP4 plus each layer PNG. MUSIC picks a track style
// (drive, anthem, trap, chill); default is the story's own pick. Posts
// nothing, stores nothing.
//   npx tsx --env-file=.env scripts/sampleReel.ts
async function main() {
  const outDir = resolve(process.env.OUT_DIR ?? "reel-sample");
  await mkdir(outDir, { recursive: true });

  const story = process.env.ARTICLE_ID
    ? await db.query.article.findFirst({ where: eq(article.id, process.env.ARTICLE_ID) })
    : await db.query.article.findFirst({
        where: and(eq(article.status, "published"), isNotNull(article.heroImageUrl), isNotNull(article.body)),
        orderBy: desc(article.publishedAt),
      });
  if (!story?.heroImageUrl || !story.body) throw new Error("No story with a photo and body found");
  console.log(`Story: ${story.title} (${story.id})`);

  const content = await generatePosterContent(story.title, story.body);
  if (!content) throw new Error("Poster content generation failed");
  console.log(JSON.stringify(content, null, 2));

  const mp4 = await renderReel({
    content,
    heroImageUrl: story.heroImageUrl,
    category: story.category,
    credit: story.heroImageCredit,
    musicStyle: (process.env.MUSIC as ReelMusicStyle | undefined) ?? musicStyleFor(story.id),
    keepScenesDir: outDir,
  });
  await writeFile(join(outDir, "reel.mp4"), mp4);
  console.log(`Wrote ${join(outDir, "reel.mp4")} (${(mp4.length / 1024 / 1024).toFixed(1)} MB)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
