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
  // Idempotency guard — same reasoning as postArticleToFacebook's (see
  // facebook.ts): a repeated call for an already-posted article must be a
  // safe no-op, not a second real post.
  const alreadyPosted = await db.socialPost.findFirst({
    where: { articleId, platform: "instagram", status: "posted" },
  });
  if (alreadyPosted) return;

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

    // Instagram processes the container asynchronously (fetching/validating
    // the image at image_url) — publishing immediately after creation is a
    // race: confirmed live, a real container failed to publish with "Media
    // ID is not available" because it wasn't done processing yet. Poll
    // status_code (IN_PROGRESS -> FINISHED/ERROR) instead of guessing a
    // fixed delay; 10 tries * 2s covers Instagram's typical processing time
    // with margin, and a container that's still stuck after 20s almost
    // certainly won't finish on its own.
    let ready = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(
        `https://graph.facebook.com/v20.0/${createData.id}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
      );
      const statusData = await statusRes.json();
      if (statusData.status_code === "FINISHED") {
        ready = true;
        break;
      }
      if (statusData.status_code === "ERROR" || statusData.status_code === "EXPIRED") {
        throw new Error(`Instagram media processing failed: ${statusData.status_code}`);
      }
      // IN_PROGRESS (or PUBLISHED, if somehow already done) — keep polling.
    }
    if (!ready) {
      throw new Error("Instagram media container never finished processing in time");
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
