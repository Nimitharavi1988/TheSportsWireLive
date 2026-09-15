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
  const tags = [`#${categoryTag}`, "#sportsWireLiveNews", "#SportsNews"];

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
// Returns whether a real post actually happened — false for a silent no-op
// (already posted, or no real image to post), so a caller trying to
// guarantee "at least one post this run" can tell that apart from a real
// success and correctly move on to the next candidate article instead of
// mistaking a skip for a completed post.
export async function postArticleToInstagram(articleId: string): Promise<boolean> {
  // Idempotency guard — same reasoning as postArticleToFacebook's (see
  // facebook.ts): a repeated call for an already-posted article must be a
  // safe no-op, not a second real post.
  const alreadyPosted = await db.socialPost.findFirst({
    where: { articleId, platform: "instagram", status: "posted" },
  });
  if (alreadyPosted) return false;

  const article = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    include: { vertical: true },
  });

  const igUserId = article.vertical.instagramBusinessAccountId ?? process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const pageId = article.vertical.facebookPageId ?? process.env.FACEBOOK_PAGE_ID;
  const rawToken = article.vertical.facebookPageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const imageUrl = article.heroImageUrl;

  if (!igUserId || !pageId || !rawToken || !imageUrl) {
    return false;
  }

  // Same token-exchange requirement as Facebook posting (facebook.ts) — a
  // System User's own token isn't valid for the linked Page's assets
  // directly, IG included. Reuses the exact same exchange call.
  const accessToken = await resolvePageAccessToken(pageId, rawToken);

  const emoji = CATEGORY_EMOJI[article.category] ?? "🏆";
  // Not a clickable link (Instagram captions don't render URLs as links —
  // see FollowUs.tsx's own comment on the same limitation), just plain text
  // pointing readers to the site as the source for more coverage.
  const caption = `${emoji} ${article.title}\n\n${displaySummary(article, 300)}\n\n📲 More sports news at sportswirelive.com\n\n${hashtagsForInstagram(article.title, article.category)}`;

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
    // ID is not available" because it wasn't done processing yet. A polling
    // loop (up to 10 extra status_code GET calls per post) fixed that race
    // but caused a far worse regression: confirmed live, it multiplied our
    // Graph API call volume enough to hit Meta's own app-level rate limit
    // ("Application request limit reached") for 6+ straight hours, failing
    // nearly every post. A single fixed wait covers Instagram's typical
    // processing time without the extra calls — the rare container still
    // not ready after 8s just fails that one post (same acceptable
    // occasional-failure rate as before the polling loop existed), instead
    // of burning the whole app's rate limit checking on every single post.
    await new Promise((r) => setTimeout(r, 8000));

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
    return true;
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
