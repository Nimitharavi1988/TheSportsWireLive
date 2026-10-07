/**
 * Render story reels on this computer, keep a copy of each video, and (only
 * when asked) post them (2026-10-07).
 *
 *   npx tsx scripts/reelLocal.ts --title "Gracias, Leo"              render + save a copy, post NOTHING
 *   npx tsx scripts/reelLocal.ts --title "Gracias, Leo" --post       also post to the main Facebook Page and Instagram
 *   options: --id <articleId> (repeatable)  --title "start of a published story's headline" (repeatable)
 *            --es  make the SPANISH reel from the published Spanish version (render only, never posted)
 *            --post-es  with --es: POST the Spanish reel to the Spanish Facebook Page and its Instagram account
 *            --post-football  POST the English reel to the football Facebook Page and its Instagram account
 *            --topic india-cricket  post to that topic Page only (Greenfield); needs FACEBOOK_PAGE_2_ACCESS_TOKEN in .dev.vars
 *            --dir path (default ./reels-local)  --music style  --theme name  --font name
 *            --env path/to/.dev.vars (default: .dev.vars, then the main checkout's)
 *
 * Posting uses the main Page and Instagram tokens stored with the vertical in
 * the database; a topic Page (such as Greenfield) has its token only in GitHub
 * secrets, so for those the saved copy is uploaded by hand (or use the admin
 * "Post reel" button). The story must be published, with a photo and a body.
 * The reel copy is written by the free AI providers only.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const FREE_KEYS = ["DATABASE_URL", "GEMINI_FREE_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY", "FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN", "FACEBOOK_PAGE_2_ACCESS_TOKEN", "FACEBOOK_PAGE_ES_ACCESS_TOKEN", "FACEBOOK_PAGE_FOOTBALL_ACCESS_TOKEN", "FACEBOOK_PAGE_ES_ID", "INSTAGRAM_ES_ACCOUNT_ID", "INSTAGRAM_BUSINESS_ACCOUNT_ID"];
function values(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => { if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]); });
  return out;
}
function envFile(): string | null {
  const c = [values("env")[0] ?? "", ".dev.vars", resolve("..", "TheSportsWireLive", ".dev.vars")].filter(Boolean);
  return c.map((p) => resolve(p)).find((p) => existsSync(p)) ?? null;
}

async function main() {
  const file = envFile();
  if (!file) { console.error("No .dev.vars found. Pass --env <path>."); process.exit(1); }
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && FREE_KEYS.includes(m[1])) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  process.env.LLM_ROUTER = "1";
  process.env.LLM_PAID_DAILY_CALLS = "0";
  delete process.env.GEMINI_API_KEY;
  process.env.SITE_URL ??= "https://sportswirelive.com";

  const post = process.argv.includes("--post");
  const postEs = process.argv.includes("--post-es");
  const postFootball = process.argv.includes("--post-football");
  if (postFootball && !process.env.FACEBOOK_PAGE_FOOTBALL_ACCESS_TOKEN) process.env.FACEBOOK_PAGE_FOOTBALL_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (postEs && !process.env.FACEBOOK_PAGE_ES_ACCESS_TOKEN) process.env.FACEBOOK_PAGE_ES_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN; // one all-pages token
  const dir = resolve(values("dir")[0] ?? "reels-local");
  const { db } = await import("../src/db");
  const { article, articleTranslation } = await import("../src/db/schema");
  const { and, eq, like } = await import("drizzle-orm");
  const { postReel } = await import("../src/lib/social/postReel");

  const { TOPIC_DESTINATIONS } = await import("../src/lib/social/facebookDestinations");
  const topicKey = values("topic")[0];
  const topicPage = topicKey ? TOPIC_DESTINATIONS.find((d) => d.key === topicKey) : undefined;
  if (topicKey && !topicPage) { console.error(`Unknown topic Page "${topicKey}".`); process.exit(1); }
  if (post && topicPage && !process.env[topicPage.tokenEnv]) { console.error(`${topicPage.tokenEnv} is not set in .dev.vars.`); process.exit(1); }
  if (post && !topicPage && !process.env.FACEBOOK_PAGE_ACCESS_TOKEN) console.error("Note: FACEBOOK_PAGE_ACCESS_TOKEN is empty in .dev.vars; the main Page posts only if the database holds a token for it.");

  const ids = values("id");
  for (const t of values("title")) {
    const rows = await db.select({ id: article.id, title: article.title }).from(article).where(and(like(article.title, `${t}%`), eq(article.status, "published")));
    if (rows.length === 0) console.log(`No published story starts with "${t}" (publish it first).`);
    for (const r of rows) ids.push(r.id);
  }
  if (ids.length === 0) { console.error("Nothing to do: give --id or --title."); process.exit(1); }

  for (const id of ids) {
    const [row] = await db.select({ title: article.title, status: article.status }).from(article).where(eq(article.id, id)).limit(1);
    if (!row || row.status !== "published") { console.log(`Skipping ${id}: not a published story.`); continue; }
    let spanish: { title: string; body: string; slug?: string } | undefined;
    if (process.argv.includes("--es")) {
      const [tr] = await db.select({ title: articleTranslation.title, body: articleTranslation.body, slug: articleTranslation.slug }).from(articleTranslation).where(and(eq(articleTranslation.articleId, id), eq(articleTranslation.locale, "es"), eq(articleTranslation.status, "translated"))).limit(1);
      if (!tr?.title || !tr.body) { console.log(`Skipping ${id}: no Spanish version yet.`); continue; }
      spanish = { title: tr.title, body: tr.body, slug: tr.slug ?? undefined };
    }
    console.log(`\n=== ${row.title} (${postFootball && !spanish ? "POST to the football Page and Instagram" : spanish ? (postEs ? "Spanish, POST to the Spanish Page and Instagram" : "Spanish, render only") : post ? "render + POST to the main Page and Instagram" : "render only"})`);
    try {
      const r = await postReel(id, {
        instagram: post && !spanish && !topicPage, facebook: post && !spanish, topicPage, saveCopyTo: dir, renderOnly: spanish ? !postEs : !(post || postFootball), footballPost: !spanish && postFootball ? true : undefined, spanish, spanishPost: spanish && postEs ? { facebook: true, instagram: true } : undefined,
        music: values("music")[0] as never, theme: values("theme")[0] as never, font: values("font")[0] as never,
      });
      if (post) console.log(`Instagram: ${r.instagramPosted ? "posted" : "not posted"}. Facebook: ${r.facebookPosted ? "posted" : "not posted"}.`);
    } catch (err) {
      console.error(`Failed for ${id}:`, err instanceof Error ? err.message : err);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
