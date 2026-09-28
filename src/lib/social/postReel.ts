import { categoryEmoji } from "@/lib/categoryDisplay";
import { socialArticleUrl } from "./trackedLink";
import { db } from "@/db";
import { article as articleTable, vertical as verticalTable, socialPost as socialPostTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generatePosterContent, generateSocialCaptions, type SocialCaptions } from "@/lib/ingestion/commentary";
import { renderReel } from "./reel";
import { musicStyleFor, type ReelMusicStyle } from "./reelMusic";
import { resolvePageAccessToken } from "./facebook";
import { selectInstagramHashtags, selectFacebookHashtags } from "./hashtagRepertoire";

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
const DESTINATION = "reel";

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

async function recordAttempt(article: ArticleWithVertical, platform: "instagram" | "facebook", run: () => Promise<string>): Promise<boolean> {
  const [row] = await db.insert(socialPostTable)
    .values({ id: createId(), articleId: article.id, platform, destination: DESTINATION, status: "queued" })
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

async function postReelToInstagram(article: ArticleWithVertical, mp4: Buffer, captions: SocialCaptions | null): Promise<boolean> {
  const igUserId = article.vertical.instagramBusinessAccountId ?? process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const pageId = article.vertical.facebookPageId ?? process.env.FACEBOOK_PAGE_ID;
  const rawToken = article.vertical.facebookPageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!igUserId || !pageId || !rawToken) return false;
  const accessToken = await resolvePageAccessToken(pageId, rawToken);

  // Same caption shape as the Instagram poster (socialPoster.ts).
  const emoji = categoryEmoji(article.category);
  const creditLine = article.heroImageCredit ? `\n\n📷 ${article.heroImageCredit}` : "";
  const hashtags = selectInstagramHashtags(article.title, article.category).join(" ");
  const caption = `${emoji} ${captions?.instagram ?? article.title}\n\n👉 Full breakdown — link in bio\n🔔 Follow @sportswirelivenews for daily sports news${creditLine}\n\n${hashtags}`;

  return recordAttempt(article, "instagram", async () => {
    console.log("[instagram reel] Creating container...");
    const container = await graphJson(
      await fetch(`${GRAPH}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_type: "REELS", upload_type: "resumable", caption, share_to_feed: true, access_token: accessToken }),
      }),
      "Instagram reel container"
    );
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
  });
}

async function postReelToFacebook(article: ArticleWithVertical, mp4: Buffer, captions: SocialCaptions | null, articleUrl: string): Promise<boolean> {
  const pageId = article.vertical.facebookPageId ?? process.env.FACEBOOK_PAGE_ID;
  const rawToken = article.vertical.facebookPageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !rawToken) return false;
  const accessToken = await resolvePageAccessToken(pageId, rawToken);

  const emoji = categoryEmoji(article.category);
  const creditLine = article.heroImageCredit ? `\n\n📷 ${article.heroImageCredit}` : "";
  const hashtags = selectFacebookHashtags(article.title, article.category).join(" ");
  const description = `${emoji} ${captions?.facebook ?? article.title}\n\nFull breakdown: ${articleUrl}${creditLine}\n\n${hashtags}`;

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
    return start.video_id as string;
  });
}

// Renders one reel for a story and posts it to whichever of Instagram /
// Facebook are requested and don't already have a reel of this story.
// `music` is a style name, or undefined for the story's own pick.
export async function postReel(
  articleId: string,
  opts: { instagram: boolean; facebook: boolean; music?: ReelMusicStyle }
): Promise<{ instagramPosted: boolean; facebookPosted: boolean }> {
  const none = { instagramPosted: false, facebookPosted: false };
  const [row] = await db.select({ article: articleTable, vertical: verticalTable })
    .from(articleTable)
    .innerJoin(verticalTable, eq(articleTable.verticalId, verticalTable.id))
    .where(eq(articleTable.id, articleId))
    .limit(1);
  if (!row) throw new Error(`Article not found: ${articleId}`);
  const article: ArticleWithVertical = { ...row.article, vertical: row.vertical };
  if (!article.heroImageUrl || !article.body) return none;

  const existing = await db.select({ platform: socialPostTable.platform }).from(socialPostTable)
    .where(and(eq(socialPostTable.articleId, articleId), eq(socialPostTable.destination, DESTINATION), eq(socialPostTable.status, "posted")));
  const needInstagram = opts.instagram && !existing.some((p) => p.platform === "instagram");
  const needFacebook = opts.facebook && !existing.some((p) => p.platform === "facebook");
  if (!needInstagram && !needFacebook) return none;

  console.log("Generating reel copy...");
  const content = await generatePosterContent(article.title, article.body);
  if (!content) return none;
  console.log("Reel content:", JSON.stringify(content));
  const captions = await generateSocialCaptions(article.title, article.body);

  const music = opts.music ?? musicStyleFor(article.id);
  console.log(`Rendering reel (music: ${music})...`);
  const mp4 = await renderReel({ content, heroImageUrl: article.heroImageUrl, category: article.category, credit: article.heroImageCredit, musicStyle: music });
  console.log(`Rendered ${(mp4.length / 1024 / 1024).toFixed(1)} MB`);

  const siteUrl = process.env.SITE_URL ?? "https://sportswirelive.com";
  const articleUrl = socialArticleUrl(siteUrl, article.slug, "facebook");
  const instagramPosted = needInstagram ? await postReelToInstagram(article, mp4, captions) : false;
  const facebookPosted = needFacebook ? await postReelToFacebook(article, mp4, captions, articleUrl) : false;
  return { instagramPosted, facebookPosted };
}
