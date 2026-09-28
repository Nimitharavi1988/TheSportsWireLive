import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { TRACKED_PLAYERS } from "@/lib/players";
import { TRACKED_CLUBS } from "@/lib/clubs";
import { getActiveCompetitions } from "@/lib/competitions";
import { personHashtag } from "@/lib/social/hashtagRepertoire";
import { ENTITY_HANDLES } from "@/lib/social/entityHandles";
import { db } from "@/db";
import { article } from "@/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";

// Exports the site's own entity lists as CSVs for review (players, teams,
// competitions), each with a suggested hashtag and a blank instagram_handle
// column to fill in once a handle is verified (see reelTags.ts). Read-only:
// posts nothing and changes nothing. Competitions come from the database
// (published in the last 14 days), so run with the env file:
//   npx tsx --env-file=.env scripts/exportSportsLists.ts
// Output: ./sports-lists (override with OUT_DIR).

function csv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n") + "\n";
}

const MENTION_DAYS = 30;

// Approximate: a headline counts once if any search term appears at a word
// start (case-insensitive), the same loose substring idea the site uses to
// match players/clubs, so short surnames can over-count slightly.
function countMentions(titles: string[], terms: string[]): number {
  const re = new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "i");
  return titles.reduce((n, t) => n + (re.test(t) ? 1 : 0), 0);
}

async function main() {
  const outDir = resolve(process.env.OUT_DIR ?? "sports-lists");
  await mkdir(outDir, { recursive: true });

  const titles = (
    await db.select({ title: article.title }).from(article)
      .where(and(eq(article.status, "published"), gt(article.publishedAt, sql`now() - make_interval(days => ${MENTION_DAYS})`)))
  ).map((r) => r.title);

  const header = ["sport", "name", "slug", `mentions_${MENTION_DAYS}d`, "suggested_hashtag", "instagram_handle"];
  const players = TRACKED_PLAYERS
    .map((p) => [p.sport, p.name, p.slug, String(countMentions(titles, p.searchTerms)), personHashtag(p.name), ENTITY_HANDLES[p.slug] ?? ""])
    .sort((a, b) => Number(b[3]) - Number(a[3]) || a[1].localeCompare(b[1]));
  await writeFile(join(outDir, "players.csv"), csv([header, ...players]));

  const teams = TRACKED_CLUBS
    .map((c) => [c.sport ?? "football", c.name, c.slug, String(countMentions(titles, c.searchTerms)), personHashtag(c.name), ENTITY_HANDLES[c.slug] ?? ""])
    .sort((a, b) => Number(b[3]) - Number(a[3]) || a[1].localeCompare(b[1]));
  await writeFile(join(outDir, "teams.csv"), csv([header, ...teams]));

  // Who to verify handles for first: the most-mentioned players and teams.
  const top = [...players.map((r) => ["player", ...r]), ...teams.map((r) => ["team", ...r])]
    .sort((a, b) => Number(b[4]) - Number(a[4]))
    .slice(0, 60);
  await writeFile(join(outDir, "top-entities.csv"), csv([["type", ...header], ...top]));

  const competitions = (await getActiveCompetitions()).map((c) => [
    c.category ?? "",
    c.label,
    c.key,
    String(c.storyCount),
    personHashtag(c.label.split("•")[0]),
    "",
  ]);
  await writeFile(join(outDir, "competitions.csv"), csv([["sport", "label", "key", "stories_last_14d", "suggested_hashtag", "instagram_handle"], ...competitions]));

  console.log(`Wrote ${players.length} players, ${teams.length} teams, ${competitions.length} competitions to ${outDir}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
