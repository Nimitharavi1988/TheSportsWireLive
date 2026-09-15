import { execFileSync } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { generatePosterContent } from "@/lib/ingestion/commentary";
import { renderInstagramPoster } from "./instagramPoster";
import { resolvePageAccessToken } from "./facebook";
import { categoryChipStyle } from "@/lib/categoryDisplay";

// Shared by two callers, both plain-Node GitHub Actions runs (never the
// deployed Cloudflare Worker — next/og can't render there, a confirmed
// Satori/WASM incompatibility):
//  - postInstagramPosterJob.ts: the admin "Post Instagram poster" button,
//    via workflow_dispatch, one article at a time.
//  - autoApprove.ts: the regular ingestion cron, already running in this
//    same plain-Node environment, so it calls this directly with no
//    separate dispatch needed.
//
// The poster PNG is committed to the repo as a real static asset just long
// enough to get a public URL for Instagram's media API to fetch from, then
// deleted in a follow-up commit once Instagram has its own copy — the repo
// doesn't grow over time from this.

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

// Returns whether a real post actually happened — same convention as
// postArticleToInstagram, so a caller trying to guarantee "at least one
// post this run" can tell a skip (already posted, not eligible) apart from
// a real success.
export async function postInstagramPoster(articleId: string): Promise<boolean> {
  const article = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    include: { vertical: true },
  });

  const alreadyPosted = await db.socialPost.findFirst({
    where: { articleId, platform: "instagram", status: "posted" },
  });
  if (alreadyPosted) return false;

  if (!article.heroImageUrl || !article.body) return false;

  console.log("Generating poster copy...");
  const content = await generatePosterContent(article.title, article.body);
  if (!content) return false;
  console.log("Poster content:", JSON.stringify(content));

  console.log("Rendering poster image...");
  const png = await renderInstagramPoster({ content, heroImageUrl: article.heroImageUrl });

  const relativePath = `public/social-posters/${article.slug}.png`;
  const absolutePath = join(process.cwd(), relativePath);
  await writeFile(absolutePath, png);

  const siteUrl = process.env.SITE_URL ?? "https://sportswirelive.com";
  const publicUrl = `${siteUrl}/social-posters/${article.slug}.png`;

  console.log("Committing poster to the repo...");
  git("config", "user.name", "sports-wire-live-bot");
  git("config", "user.email", "actions@users.noreply.github.com");
  git("add", relativePath);
  git("commit", "-m", `Add Instagram poster for ${article.slug}`);
  git("push");

  console.log(`Waiting for ${publicUrl} to go live...`);
  await waitUntilLive(publicUrl);

  const igUserId = article.vertical.instagramBusinessAccountId ?? process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const pageId = article.vertical.facebookPageId ?? process.env.FACEBOOK_PAGE_ID;
  const rawToken = article.vertical.facebookPageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!igUserId || !pageId || !rawToken) {
    await unlink(absolutePath).catch(() => {});
    return false;
  }
  const accessToken = await resolvePageAccessToken(pageId, rawToken);

  const emoji = CATEGORY_EMOJI[article.category] ?? "🏆";
  const categoryTag = categoryChipStyle(article.category).label.replace(/[^a-zA-Z0-9]/g, "");
  const creditLine = article.heroImageCredit ? `\n\n📷 ${article.heroImageCredit}` : "";
  const caption = `${emoji} ${content.hook}\n\n${article.summary}\n\nWhere do you land? 👇\n\n👉 Full breakdown — link in bio${creditLine}\n\n#${categoryTag} #SportsWireLive #SportsNews`;
  const altText = article.heroImageCredit ? `${article.title}. ${article.heroImageCredit}.` : article.title;

  const socialPost = await db.socialPost.create({ data: { articleId, platform: "instagram", status: "queued" } });

  try {
    console.log("Creating media container...");
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

    console.log("Publishing...");
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
    console.log("Posted! media id:", publishData.id);
    return true;
  } catch (err) {
    await db.socialPost.update({
      where: { id: socialPost.id },
      data: { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  } finally {
    console.log("Cleaning up poster file from the repo...");
    try {
      await unlink(absolutePath);
      git("add", relativePath);
      git("commit", "-m", `Remove Instagram poster for ${article.slug} (already posted)`);
      git("push");
    } catch (cleanupErr) {
      console.error("Cleanup commit failed (non-fatal):", cleanupErr);
    }
  }
}
