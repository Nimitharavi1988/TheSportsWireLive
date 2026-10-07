import { categoryEmoji } from "@/lib/categoryDisplay";
import { socialArticleUrl } from "./trackedLink";
import { db } from "@/db";
import { article as articleTable, vertical as verticalTable, socialPost as socialPostTable } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { TOPIC_DESTINATIONS, type FacebookDestination } from "./facebookDestinations";
import { MAIN_REEL_DESTINATION, reelNeeds } from "./reelDuplicates";
import { createId } from "@paralleldrive/cuid2";
import { generatePosterContent, generateSocialCaptions, type SocialCaptions } from "@/lib/ingestion/commentary";
import { renderReel } from "./reel";
import { musicStyleFor, type ReelMusicStyle } from "./reelMusic";
import type { ReelTheme, ReelFont } from "./reelThemes";
import { resolvePageAccessToken } from "./facebook";
import { selectInstagramHashtags, selectFacebookHashtags, selectSpanishHashtags } from "./hashtagRepertoire";
import { reelTagsFor } from "./reelTags";

// Posts a story as a Reel to Instagram and the main Facebook Page. Runs in
// the post-reel GitHub Actions job only (renderReel needs plain Node).
//
// The MP4 is uploaded straight to Meta ("resumable" upload: the bytes go
// in the request to rupload.facebook.com), so, unlike the poster, it's
// never stored or served by us: no storage, nothing to clean up, and no
// waiting for a public URL to propagate (the poster's "Only photo or video
// can be accepted" failures).
//
// Recorded in SocialPost with destination "reel". The automated pipeline
// (autoApprove.ts) counts Instagram reel rows as Instagram posts (daily cap,
// one Instagram post per story); its Facebook checks filter on destination
// "main", so a Facebook reel doesn't stop the normal Facebook post. The
// manual admin buttons treat reels separately (ReelButton).

const GRAPH = "https://graph.facebook.com/v20.0";
const RUPLOAD = "https://rupload.facebook.com";
const DESTINATION = MAIN_REEL_DESTINATION;

type ArticleWithVertical = typeof articleTable.$inferSelect & { vertical: typeof verticalTable.$inferSelect };

async function graphJson(res: Response, what: string): Promise<any> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error?.message ?? `${what} failed (${res.status})`);
  return data;
}

// Sends the whole file in one request (offset 0) to a rupload URL.
async function uploadBytes(url: string, accessToken: string, mp4: Buffer, what: string): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${accessToken}`,
      offset: "0",
      file_size: String(mp4.length),
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(mp4),
  });
  await graphJson(res, what);
}

// A follow prompt as the first comment on a published reel. Best-effort: the
// reel is already public, so a failed comment is logged, never thrown (and
// never retried as a second post). A just-published reel can still be
// processing, so a failed attempt is retried a few times.
async function commentOnReel(objectId: string, message: string, accessToken: string, what: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await graphJson(
        await fetch(`${GRAPH}/${objectId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, access_token: accessToken }),
        }),
        `${what} follow comment`
      );
      return;
    } catch (err) {
      if (attempt === 3) console.warn(`[${what}] follow comment failed on ${objectId}:`, err instanceof Error ? err.message : err);
      else await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

async function recordAttempt(article: ArticleWithVertical, platform: "instagram" | "facebook", run: () => Promise<string>, destination = DESTINATION): Promise<boolean> {
  const [row] = await db.insert(socialPostTable)
    .values({ id: createId(), articleId: article.id, platform, destination, status: "queued" })
    .returning();
  try {
    const externalId = await run();
    await db.update(socialPostTable)
      .set({ status: "posted", externalPostId: externalId, postedAt: new Date() })
      .where(eq(socialPostTable.id, row.id));
    console.log(`[${platform} reel] Posted! id:`, externalId);
    return true;
  } catch (err) {
    await db.update(socialPostTable)
      .set({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err) })
      .where(eq(socialPostTable.id, row.id));
    console.error(`[${platform} reel] Post failed:`, err);
    return false;
  }
}

// es: post to the Spanish Page's Instagram account instead, with this Spanish caption (scripts/reelLocal.ts --post-es).
interface SpanishTarget { pageId: string; igUserId: string; tokenEnv: string; caption: string; destination: string; follow: string }

async function postReelToInstagram(article: ArticleWithVertical, mp4: Buffer, captions: SocialCaptions | null, es?: SpanishTarget): Promise<boolean> {
  const igUserId = es ? es.igUserId : article.vertical.instagramBusinessAccountId ?? process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const pageId = es ? es.pageId : article.vertical.facebookPageId ?? process.env.FACEBOOK_PAGE_ID;
  const rawToken = es ? process.env[es.tokenEnv] : article.vertical.facebookPageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!igUserId || !pageId || !rawToken) return false;
  const accessToken = await resolvePageAccessToken(pageId, rawToken);

  // Same caption shape as the Instagram poster (socialPoster.ts), plus a
  // comment prompt matching the reel's end card.
  const emoji = categoryEmoji(article.category);
  const creditLine = article.heroImageCredit ? `\n\n📷 ${article.heroImageCredit}` : "";
  // 4 specific tags + brand: more than that reads as spam and adds no reach.
  const hashtags = selectInstagramHashtags(article.title, article.category, 4).join(" ");
  const caption = es ? es.caption : `${emoji} ${captions?.instagram ?? article.title}\n\n💬 What's your take? Tell us in the comments\n👉 Full breakdown — link in bio\n🔔 Follow @sportswirelivenews for daily sports news${creditLine}\n\n${hashtags}`;
  const tags = es ? { collaborators: [] as string[], userTags: [] as never[] } : reelTagsFor(article.title, article.category);

  const createContainer = (withTags: boolean) =>
    fetch(`${GRAPH}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Cover: the headline frame, 1s in (before the first fact appears).
      body: JSON.stringify({
        media_type: "REELS", upload_type: "resumable", caption, share_to_feed: true, thumb_offset: 1000, access_token: accessToken,
        ...(withTags && tags.collaborators.length > 0 ? { collaborators: tags.collaborators } : {}),
        ...(withTags && tags.userTags.length > 0 ? { user_tags: tags.userTags } : {}),
      }),
    });

  return recordAttempt(article, "instagram", async () => {
    console.log("[instagram reel] Creating container...");
    const hasTags = tags.collaborators.length > 0 || tags.userTags.length > 0;
    let container;
    try {
      container = await graphJson(await createContainer(hasTags), "Instagram reel container");
    } catch (err) {
      if (!hasTags) throw err;
      console.warn("[instagram reel] Container with tags failed, retrying without:", err instanceof Error ? err.message : err);
      container = await graphJson(await createContainer(false), "Instagram reel container");
    }
    if (!container.id) throw new Error("Instagram returned no container id");

    console.log("[instagram reel] Uploading video...");
    await uploadBytes(`${RUPLOAD}/ig-api-upload/v20.0/${container.id}`, accessToken, mp4, "Instagram reel upload");

    // Instagram processes the video before it can be published.
    console.log("[instagram reel] Waiting for processing...");
    for (let i = 0; ; i++) {
      const status = await graphJson(
        await fetch(`${GRAPH}/${container.id}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`),
        "Instagram reel status"
      );
      if (status.status_code === "FINISHED") break;
      if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new Error(`Instagram processing ${status.status_code}: ${status.status ?? ""}`);
      if (i >= 40) throw new Error("Instagram reel still processing after 10 minutes");
      await new Promise((r) => setTimeout(r, 15000));
    }

    console.log("[instagram reel] Publishing...");
    const published = await graphJson(
      await fetch(`${GRAPH}/${igUserId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
      }),
      "Instagram reel publish"
    );
    if (!published.id) throw new Error("Instagram returned no media id");
    return published.id as string;
  }, es ? es.destination : undefined);
}

// topicPage: post to a topic Page (facebookDestinations.ts) instead of the
// main Page — its own token and posting history, and a caption that points
// viewers at the Page (Follow) as well as the article.
async function postReelToFacebook(article: ArticleWithVertical, mp4: Buffer, captions: SocialCaptions | null, articleUrl: string, topicPage?: FacebookDestination, es?: SpanishTarget): Promise<boolean> {
  const pageId = es ? es.pageId : topicPage ? topicPage.pageId : article.vertical.facebookPageId ?? process.env.FACEBOOK_PAGE_ID;
  const rawToken = es ? process.env[es.tokenEnv] : topicPage ? process.env[topicPage.tokenEnv] : article.vertical.facebookPageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !rawToken) return false;
  const accessToken = await resolvePageAccessToken(pageId, rawToken);

  const emoji = categoryEmoji(article.category);
  const creditLine = article.heroImageCredit ? `\n\n📷 ${article.heroImageCredit}` : "";
  const hashtags = (topicPage?.hashtags ? topicPage.hashtags(article.title, article.category) : selectFacebookHashtags(article.title, article.category)).join(" ");
  const description = es ? es.caption : `${emoji} ${captions?.facebook ?? article.title}\n\nFull breakdown: ${articleUrl}${creditLine}\n\n${hashtags}`;

  return recordAttempt(article, "facebook", async () => {
    console.log("[facebook reel] Starting upload...");
    const start = await graphJson(
      await fetch(`${GRAPH}/${pageId}/video_reels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_phase: "start", access_token: accessToken }),
      }),
      "Facebook reel start"
    );
    if (!start.video_id) throw new Error("Facebook returned no video id");

    console.log("[facebook reel] Uploading video...");
    await uploadBytes(start.upload_url ?? `${RUPLOAD}/video-upload/v20.0/${start.video_id}`, accessToken, mp4, "Facebook reel upload");

    console.log("[facebook reel] Publishing...");
    await graphJson(
      await fetch(`${GRAPH}/${pageId}/video_reels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_phase: "finish", video_id: start.video_id, video_state: "PUBLISHED", description, access_token: accessToken }),
      }),
      "Facebook reel publish"
    );
    // Topic Pages only: the main Page's reels are unchanged (no comment).
    if (topicPage || es) await commentOnReel(start.video_id, es ? `${es.follow} https://www.facebook.com/${pageId}` : `👍 Follow for more sports news: https://www.facebook.com/${pageId}`, accessToken, "facebook reel");
    return start.video_id as string;
  }, es ? es.destination : topicPage ? `${topicPage.key}-reel` : DESTINATION);
}

// Renders one reel for a story and posts it to whichever of Instagram /
// Facebook are requested and don't already have a reel of this story.
// `music` is a style name, or undefined for the story's own pick;
// `theme` / `font` a colour theme and headline font, or undefined for
// brand green / Poppins.
export async function postReel(
  articleId: string,
  // saveCopyTo: a folder to keep the rendered MP4 in (scripts/reelLocal.ts). renderOnly:
  // render (and save) without posting anywhere, and without the one-reel-per-story check.
  opts: { instagram: boolean; facebook: boolean; topicPage?: FacebookDestination; music?: ReelMusicStyle; theme?: ReelTheme; font?: ReelFont; saveCopyTo?: string; renderOnly?: boolean; spanish?: { title: string; body: string; slug?: string }; spanishPost?: { facebook: boolean; instagram: boolean }; footballPost?: boolean }
): Promise<{ instagramPosted: boolean; facebookPosted: boolean }> {
  const none = { instagramPosted: false, facebookPosted: false };
  const [row] = await db.select({ article: articleTable, vertical: verticalTable })
    .from(articleTable)
    .innerJoin(verticalTable, eq(articleTable.verticalId, verticalTable.id))
    .where(eq(articleTable.id, articleId))
    .limit(1);
  if (!row) throw new Error(`Article not found: ${articleId}`);
  const article: ArticleWithVertical = { ...row.article, vertical: row.vertical };
  if (!article.heroImageUrl || !article.body) {
    console.log(`[reel] skipped ${articleId}: no photo or no body`);
    return none;
  }

  // One Facebook reel per story across our Pages: repeated videos get less
  // reach. A topic Page skips a story the main Page (or itself) already has; the
  // main Page skips a story any topic Page already has. (Instagram: its own row.)
  const topicReelKeys = TOPIC_DESTINATIONS.map((d) => `${d.key}-reel`);
  const existing = await db.select({ platform: socialPostTable.platform, destination: socialPostTable.destination }).from(socialPostTable)
    .where(and(eq(socialPostTable.articleId, articleId), inArray(socialPostTable.destination, [DESTINATION, ...topicReelKeys]), eq(socialPostTable.status, "posted")));
  const { needInstagram, needFacebook } = opts.renderOnly || opts.spanishPost || opts.footballPost
    ? { needInstagram: false, needFacebook: false }
    : reelNeeds(existing, { instagram: opts.instagram, facebook: opts.facebook, topicKey: opts.topicPage?.key });
  if (!opts.renderOnly && !opts.spanishPost && !opts.footballPost && !needInstagram && !needFacebook) {
    console.log(`[reel] skipped ${articleId}: already has a reel on the requested platform(s)`);
    return none;
  }

  console.log("Generating reel copy...");
  // The free models sometimes slip a year or number the story never states
  // (a 2026 retirement became "2024"): retry up to 3 times, accepting only copy
  // whose years and figures all appear in the story text.
  const sourceText = `${opts.spanish?.title ?? article.title}\n${opts.spanish?.body ?? article.body}`;
  const numbersOk = (c: { eyebrow: string; hook: string; rows: { label: string; value: string }[] }) =>
    [c.eyebrow, c.hook, ...c.rows.map((r) => r.value)].join(" ").match(/\d[\d.,]*/g)?.every((n) => sourceText.includes(n.replace(/[.,]+$/, ""))) ?? true;
  let content = null;
  for (let attempt = 0; attempt < 3 && !content; attempt++) {
    const c = await generatePosterContent(opts.spanish?.title ?? article.title, opts.spanish?.body ?? article.body, opts.spanish ? "es" : undefined);
    if (c && numbersOk(c)) content = c;
    else if (c) console.log(`[reel] copy had a number not in the story, retrying: ${JSON.stringify(c)}`);
  }
  if (!content) {
    console.log(`[reel] skipped ${articleId}: no reel copy (too few real facts, or the copy call failed)`);
    return none;
  }
  console.log("Reel content:", JSON.stringify(content));
  const captions = await generateSocialCaptions(article.title, article.body);

  // Topic Pages pick music by the story's mood and sport; the main Page and Instagram keep the original rotation.
  const music = opts.music ?? musicStyleFor(article.id, opts.topicPage ? { title: article.title, category: article.category } : undefined);
  console.log(`Rendering reel (music: ${music}, theme: ${opts.theme ?? "default"}, font: ${opts.font ?? "default"})...`);
  const mp4 = await renderReel({ content, heroImageUrl: article.heroImageUrl, category: article.category, credit: article.heroImageCredit, musicStyle: music, theme: opts.theme, font: opts.font, locale: opts.spanish ? "es" : undefined });
  console.log(`Rendered ${(mp4.length / 1024 / 1024).toFixed(1)} MB`);
  if (opts.saveCopyTo) {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    mkdirSync(opts.saveCopyTo, { recursive: true });
    const file = join(opts.saveCopyTo, `${opts.spanish ? "es-" : ""}${article.slug.slice(0, 80)}.mp4`);
    writeFileSync(file, mp4);
    console.log(`Saved a copy: ${file}`);
  }
  if (opts.renderOnly) return none;

  // The football Page and its Instagram account (English): same video, English captions, the main-site link.
  if (opts.footballPost) {
    const pageId = process.env.FACEBOOK_PAGE_FOOTBALL_ID ?? "1344971308703586";
    const igUserId = process.env.INSTAGRAM_FOOTBALL_ACCOUNT_ID ?? "17841462310314966";
    const prior = await db.select({ platform: socialPostTable.platform }).from(socialPostTable)
      .where(and(eq(socialPostTable.articleId, articleId), eq(socialPostTable.destination, "football-reel"), eq(socialPostTable.status, "posted")));
    const done = new Set(prior.map((p) => p.platform));
    const link = socialArticleUrl(process.env.SITE_URL ?? "https://sportswirelive.com", article.slug, "facebook");
    const credit = article.heroImageCredit ? `

📷 ${article.heroImageCredit}` : "";
    const emoji = categoryEmoji(article.category);
    const fbTags = selectFacebookHashtags(article.title, article.category).join(" ");
    const igTags = selectInstagramHashtags(article.title, article.category, 4).join(" ");
    const target = (caption: string): SpanishTarget => ({ pageId, igUserId, tokenEnv: "FACEBOOK_PAGE_FOOTBALL_ACCESS_TOKEN", caption, destination: "football-reel", follow: "👍 Follow for more football news:" });
    const fbCaption = `${emoji} ${captions?.facebook ?? article.title}

Full breakdown: ${link}${credit}

${fbTags}`;
    const igCaption = `${emoji} ${captions?.instagram ?? article.title}

💬 What's your take? Tell us in the comments
👉 Full breakdown — link in bio${credit}

${igTags}`;
    const facebookPosted = !done.has("facebook") ? await postReelToFacebook(article, mp4, null, link, undefined, target(fbCaption)) : false;
    const instagramPosted = !done.has("instagram") ? await postReelToInstagram(article, mp4, null, target(igCaption)) : false;
    return { instagramPosted, facebookPosted };
  }

  // The Spanish Page and its Instagram account: Spanish captions, the es. article link, the same
  // video. Never doubles up: an earlier "es-reel" post of this story on a platform is skipped.
  if (opts.spanish && opts.spanishPost) {
    const pageId = process.env.FACEBOOK_PAGE_ES_ID ?? "1343775455488735";
    const igUserId = process.env.INSTAGRAM_ES_ACCOUNT_ID ?? "17841471180978125";
    const prior = await db.select({ platform: socialPostTable.platform }).from(socialPostTable)
      .where(and(eq(socialPostTable.articleId, articleId), eq(socialPostTable.destination, "es-reel"), eq(socialPostTable.status, "posted")));
    const done = new Set(prior.map((p) => p.platform));
    const es = opts.spanish;
    const link = `https://es.sportswirelive.com/article/${es.slug ?? article.slug}`;
    const esCaps = await generateSocialCaptions(es.title, es.body, "es");
    const tags = selectSpanishHashtags(es.title, article.category).join(" ");
    const credit = article.heroImageCredit ? `

📷 ${article.heroImageCredit}` : "";
    const target = (caption: string): SpanishTarget => ({ pageId, igUserId, tokenEnv: "FACEBOOK_PAGE_ES_ACCESS_TOKEN", caption, destination: "es-reel", follow: "👍 Síguenos para más noticias deportivas:" });
    const fbCaption = `${esCaps?.facebook ?? es.title}

Nota completa: ${link}${credit}

${tags}`;
    const igCaption = `${esCaps?.instagram ?? es.title}

💬 ¿Qué opinas? Cuéntanoslo en los comentarios
👉 Nota completa: enlace en la bio${credit}

${tags}`;
    const facebookPosted = opts.spanishPost.facebook && !done.has("facebook") ? await postReelToFacebook(article, mp4, null, link, undefined, target(fbCaption)) : false;
    const instagramPosted = opts.spanishPost.instagram && !done.has("instagram") ? await postReelToInstagram(article, mp4, null, target(igCaption)) : false;
    return { instagramPosted, facebookPosted };
  }

  const siteUrl = process.env.SITE_URL ?? "https://sportswirelive.com";
  const articleUrl = socialArticleUrl(siteUrl, article.slug, "facebook");
  const instagramPosted = needInstagram ? await postReelToInstagram(article, mp4, captions) : false;
  const facebookPosted = needFacebook ? await postReelToFacebook(article, mp4, captions, articleUrl, opts.topicPage) : false;
  return { instagramPosted, facebookPosted };
}
