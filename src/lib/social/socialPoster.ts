import { execFileSync } from "node:child_process";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";
import { generatePosterContent, type PosterContent } from "@/lib/ingestion/commentary";
import { renderInstagramPoster } from "./instagramPoster";
import { resolvePageAccessToken } from "./facebook";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { displaySummary } from "@/lib/articleSummary";

// Shared poster-generation core for both Facebook and Instagram, so an
// article going to both platforms in the same run gets ONE Gemini call and
// ONE render, not two. Only ever runs in a plain-Node GitHub Actions job —
// never the deployed Cloudflare Worker, where next/og can't render
// (confirmed Satori/WASM incompatibility). Callers:
//  - postInstagramPosterJob.ts: admin "Post Instagram poster" button, IG only.
//  - autoApprove.ts: the ingestion cron, both platforms.
//
// The poster PNG is committed to the repo as a real static asset just long
// enough to get a public URL for each platform's media API to fetch from,
// then deleted in a follow-up commit once both are done — the repo doesn't
// grow over time from this.

const CATEGORY_EMOJI: Record<string, string> = {
  cricket: "🏏", football: "⚽", "american-football": "🏈",
  basketball: "🏀", baseball: "⚾", rugby: "🏉", athletics: "🏃",
};

function git(...args: string[]) {
  execFileSync("git", args, { stdio: "inherit" });
}

async function waitUntilLive(url: string, maxAttempts = 20): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  throw new Error(`Poster never went live at ${url} after ${maxAttempts} attempts`);
}

type ArticleWithVertical = Prisma.ArticleGetPayload<{ include: { vertical: true } }>;

async function postToInstagram(article: ArticleWithVertical, publicUrl: string, content: PosterContent): Promise<boolean> {
  const igUserId = article.vertical.instagramBusinessAccountId ?? process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const pageId = article.vertical.facebookPageId ?? process.env.FACEBOOK_PAGE_ID;
  const rawToken = article.vertical.facebookPageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!igUserId || !pageId || !rawToken) return false;
  const accessToken = await resolvePageAccessToken(pageId, rawToken);

  const emoji = CATEGORY_EMOJI[article.category] ?? "🏆";
  const categoryTag = categoryChipStyle(article.category).label.replace(/[^a-zA-Z0-9]/g, "");
  const creditLine = article.heroImageCredit ? `\n\n📷 ${article.heroImageCredit}` : "";
  // article.summary is always a generic "Full coverage from X. Read the
  // original report..." placeholder for RSS-sourced content, never the
  // real text — confirmed live, it leaked straight into a poster caption
  // this way. displaySummary correctly prefers the real generated body.
  const caption = `${emoji} ${content.hook}\n\n${displaySummary(article, 300)}\n\nWhere do you land? 👇\n\n👉 Full breakdown — link in bio${creditLine}\n\n#${categoryTag} #sportsWireLiveNews #SportsNews`;
  const altText = article.heroImageCredit ? `${article.title}. ${article.heroImageCredit}.` : article.title;

  const socialPost = await db.socialPost.create({ data: { articleId: article.id, platform: "instagram", status: "queued" } });

  try {
    console.log("[instagram] Creating media container...");
    const createRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: publicUrl, caption, alt_text: altText, access_token: accessToken }),
    });
    const createData = await createRes.json();
    if (!createRes.ok || !createData.id) {
      throw new Error(createData?.error?.message ?? `Instagram media creation failed (${createRes.status})`);
    }

    await new Promise((r) => setTimeout(r, 8000));

    console.log("[instagram] Publishing...");
    const publishRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: createData.id, access_token: accessToken }),
    });
    const publishData = await publishRes.json();
    if (!publishRes.ok || !publishData.id) {
      throw new Error(publishData?.error?.message ?? `Instagram publish failed (${publishRes.status})`);
    }

    await db.socialPost.update({
      where: { id: socialPost.id },
      data: { status: "posted", externalPostId: publishData.id, postedAt: new Date() },
    });
    console.log("[instagram] Posted! media id:", publishData.id);
    return true;
  } catch (err) {
    await db.socialPost.update({
      where: { id: socialPost.id },
      data: { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) },
    });
    console.error("[instagram] Post failed:", err);
    return false;
  }
}

// Native photo post (no `link` field, no URL in the caption) — a link
// attached to a Facebook post in ANY form (link field, caption text, or a
// clickable-photo link) gets the same reduced-reach treatment in 2026, per
// Meta's own increasingly aggressive link-post throttling. The article URL
// goes on as a first comment instead, which Facebook (unlike Instagram)
// does render as a clickable link — genuinely avoiding the penalty rather
// than just moving where the link visually sits.
async function postToFacebook(article: ArticleWithVertical, publicUrl: string, content: PosterContent, articleUrl: string): Promise<boolean> {
  const pageId = article.vertical.facebookPageId ?? process.env.FACEBOOK_PAGE_ID;
  const rawToken = article.vertical.facebookPageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !rawToken) return false;
  const accessToken = await resolvePageAccessToken(pageId, rawToken);

  const emoji = CATEGORY_EMOJI[article.category] ?? "🏆";
  const categoryTag = categoryChipStyle(article.category).label.replace(/[^a-zA-Z0-9]/g, "");
  const creditLine = article.heroImageCredit ? `\n\n📷 ${article.heroImageCredit}` : "";
  const caption = `${emoji} ${content.hook}\n\n${displaySummary(article, 300)}\n\nWhere do you land? 👇\n\nFull breakdown linked in the comments below!${creditLine}\n\n#${categoryTag} #SportsWireLive`;

  const socialPost = await db.socialPost.create({ data: { articleId: article.id, platform: "facebook", status: "queued" } });

  try {
    console.log("[facebook] Posting photo (no link attached)...");
    const photoRes = await fetch(`https://graph.facebook.com/v20.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: publicUrl, caption, access_token: accessToken }),
    });
    const photoData = await photoRes.json();
    if (!photoRes.ok || !photoData.post_id) {
      throw new Error(photoData?.error?.message ?? `Facebook photo post failed (${photoRes.status})`);
    }

    await db.socialPost.update({
      where: { id: socialPost.id },
      data: { status: "posted", externalPostId: photoData.post_id, postedAt: new Date() },
    });
    console.log("[facebook] Posted! post id:", photoData.post_id);

    // Best-effort — the post itself already succeeded and is recorded
    // "posted" above regardless of whether this comment goes through
    // (e.g. a missing pages_manage_engagement permission), so a comment
    // failure here never rolls back or fails the whole attempt.
    console.log("[facebook] Adding first comment with the article link...");
    const commentRes = await fetch(`https://graph.facebook.com/v20.0/${photoData.post_id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: articleUrl, access_token: accessToken }),
    });
    if (!commentRes.ok) {
      const commentData = await commentRes.json();
      console.error("[facebook] First-comment link failed (post itself still succeeded):", commentData?.error?.message);
    }

    return true;
  } catch (err) {
    await db.socialPost.update({
      where: { id: socialPost.id },
      data: { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) },
    });
    console.error("[facebook] Post failed:", err);
    return false;
  }
}

// Generates one poster for an article and posts it to whichever of
// Facebook/Instagram are requested and not already posted. Returns which
// platforms actually got a fresh post this call.
export async function postSocialPoster(
  articleId: string,
  platforms: { instagram: boolean; facebook: boolean }
): Promise<{ instagramPosted: boolean; facebookPosted: boolean }> {
  const none = { instagramPosted: false, facebookPosted: false };
  const article = await db.article.findUniqueOrThrow({ where: { id: articleId }, include: { vertical: true } });

  const [existingInstagram, existingFacebook] = await Promise.all([
    db.socialPost.findFirst({ where: { articleId, platform: "instagram", status: "posted" } }),
    db.socialPost.findFirst({ where: { articleId, platform: "facebook", status: "posted" } }),
  ]);
  const needInstagram = platforms.instagram && !existingInstagram;
  const needFacebook = platforms.facebook && !existingFacebook;
  if (!needInstagram && !needFacebook) return none;

  if (!article.heroImageUrl || !article.body) return none;

  console.log("Generating poster copy...");
  const content = await generatePosterContent(article.title, article.body);
  if (!content) return none;
  console.log("Poster content:", JSON.stringify(content));

  console.log("Rendering poster image...");
  const png = await renderInstagramPoster({ content, heroImageUrl: article.heroImageUrl });

  const relativePath = `public/social-posters/${article.slug}.png`;
  const absolutePath = join(process.cwd(), relativePath);
  // Git doesn't track empty directories, so public/social-posters/ doesn't
  // exist in a fresh checkout — confirmed live, this crashed the very
  // first real post attempt with ENOENT before it ever reached either
  // platform's API.
  await mkdir(join(process.cwd(), "public/social-posters"), { recursive: true });
  await writeFile(absolutePath, png);

  const siteUrl = process.env.SITE_URL ?? "https://sportswirelive.com";
  const publicUrl = `${siteUrl}/social-posters/${article.slug}.png`;
  const articleUrl = `${siteUrl}/article/${article.slug}`;

  console.log("Committing poster to the repo...");
  git("config", "user.name", "sports-wire-live-bot");
  git("config", "user.email", "actions@users.noreply.github.com");
  git("add", relativePath);
  git("commit", "-m", `Add social poster for ${article.slug}`);
  git("push");

  try {
    console.log(`Waiting for ${publicUrl} to go live...`);
    await waitUntilLive(publicUrl);

    const instagramPosted = needInstagram ? await postToInstagram(article, publicUrl, content) : false;
    const facebookPosted = needFacebook ? await postToFacebook(article, publicUrl, content, articleUrl) : false;
    return { instagramPosted, facebookPosted };
  } finally {
    // Runs even if waitUntilLive itself throws (confirmed live: it did,
    // during local testing against a non-production SITE_URL) — otherwise
    // the poster commit is left orphaned in the repo with nothing ever
    // cleaning it up.
    console.log("Cleaning up poster file from the repo...");
    try {
      await unlink(absolutePath);
      git("add", relativePath);
      git("commit", "-m", `Remove social poster for ${article.slug} (already posted)`);
      git("push");
    } catch (cleanupErr) {
      console.error("Cleanup commit failed (non-fatal):", cleanupErr);
    }
  }
}
