import { db } from "@/lib/db";
import { displaySummary } from "@/lib/articleSummary";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { TRACKED_PLAYERS } from "@/lib/players";
import { resolvePageAccessToken } from "./facebook";

// Unlike Facebook (facebook.ts), stacking hashtags on Instagram is normal
// and doesn't hurt reach — capped at 8 here purely to stay readable, not for
// a reach-penalty reason.
const CATEGORY_EMOJI: Record<string, string> = {
  cricket: "🏏",
  football: "⚽",
  "american-football": "🏈",
  basketball: "🏀",
  baseball: "⚾",
  rugby: "🏉",
  athletics: "🏃",
};

function hashtagsForInstagram(title: string, category: string): string {
  const categoryTag = categoryChipStyle(category).label.replace(/[^a-zA-Z0-9]/g, "");
  const tags = [`#${categoryTag}`, "#SportsWireLive", "#SportsNews"];

  const lower = title.toLowerCase();
  const player = TRACKED_PLAYERS.find((p) => p.searchTerms.some((term) => lower.includes(term.toLowerCase())));
  if (player) tags.push(`#${player.name.replace(/[^a-zA-Z0-9]/g, "")}`);

  return tags.join(" ");
}

// Isolated social publisher, same shape as facebook.ts's postArticleToFacebook
// (per-vertical config with an env-var fallback, best-effort with its own
// SocialPost row, "not configured" treated as a no-op rather than an error).
// Instagram's Graph API is a two-step publish (create a media container,
// then publish it) and — unlike Facebook — has no text-only post type at
// all, so an article without a real image simply can't go to Instagram.
export async function postArticleToInstagram(articleId: string) {
  const article = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    include: { vertical: true },
  });

  const igUserId = article.vertical.instagramBusinessAccountId ?? process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const pageId = article.vertical.facebookPageId ?? process.env.FACEBOOK_PAGE_ID;
  const rawToken = article.vertical.facebookPageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const imageUrl = article.heroImageUrl;

  if (!igUserId || !pageId || !rawToken || !imageUrl) {
    return;
  }

  // Same token-exchange requirement as Facebook posting (facebook.ts) — a
  // System User's own token isn't valid for the linked Page's assets
  // directly, IG included. Reuses the exact same exchange call.
  const accessToken = await resolvePageAccessToken(pageId, rawToken);

  const emoji = CATEGORY_EMOJI[article.category] ?? "🏆";
  const caption = `${emoji} ${article.title}\n\n${displaySummary(article, 300)}\n\n${hashtagsForInstagram(article.title, article.category)}`;

  const socialPost = await db.socialPost.create({
    data: { articleId, platform: "instagram", status: "queued" },
  });

  try {
    const createRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
    });
    const createData = await createRes.json();
    if (!createRes.ok || !createData.id) {
      throw new Error(createData?.error?.message ?? `Instagram media creation failed (${createRes.status})`);
    }

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
  } catch (err) {
    await db.socialPost.update({
      where: { id: socialPost.id },
      data: {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
