import { db } from "@/lib/db";
import { displaySummary } from "@/lib/articleSummary";
import { categoryChipStyle } from "@/lib/categoryDisplay";
import { TRACKED_PLAYERS } from "@/lib/players";

// 2-3 hashtags reads as normal on Facebook; more than that measurably hurts
// reach on FB specifically (unlike Instagram/X, where stacking many is
// normal) — so this is deliberately capped, not "more tags = more reach."
// Category tag + brand tag always included; a third, more specific tag only
// when a tracked star player is actually named in the headline.
function hashtagsFor(title: string, category: string): string {
  const categoryTag = categoryChipStyle(category).label.replace(/[^a-zA-Z0-9]/g, "");
  const tags = [`#${categoryTag}`, "#SportsWireLive"];

  const lower = title.toLowerCase();
  const player = TRACKED_PLAYERS.find((p) => p.searchTerms.some((term) => lower.includes(term.toLowerCase())));
  if (player) tags.push(`#${player.name.replace(/[^a-zA-Z0-9]/g, "")}`);

  return tags.join(" ");
}

// Isolated social publisher: posts an approved article to the Facebook Page
// configured for its vertical (each product/vertical can post to its own
// Page). Falls back to the global env vars when a vertical has no Page of
// its own configured yet, so single-vertical setups keep working unchanged.
// A missing token/page id is treated as "not configured" rather than an
// error, since Facebook posting is optional (see README).
export async function postArticleToFacebook(articleId: string) {
  const article = await db.article.findUniqueOrThrow({
    where: { id: articleId },
    include: { vertical: true },
  });

  const pageId = article.vertical.facebookPageId ?? process.env.FACEBOOK_PAGE_ID;
  const accessToken =
    article.vertical.facebookPageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    return;
  }

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const link = `${siteUrl}/article/${article.slug}`;
  // The link itself is passed as its own `link` field, not pasted into the
  // message text — Facebook auto-generates a proper preview card (image,
  // title, domain) from it, which gets meaningfully more reach than a raw
  // URL sitting in the post body. That card's thumbnail comes from the
  // article page's own og:image (generateMetadata in article/[slug]/
  // page.tsx), so it only works correctly now that SITE_URL is set right
  // (see the earlier production fix — before that it pointed at localhost).
  const message = `${article.title}\n\n${displaySummary(article, 400)}\n\n${hashtagsFor(article.title, article.category)}`;

  const socialPost = await db.socialPost.create({
    data: { articleId, platform: "facebook", status: "queued" },
  });

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, link, access_token: accessToken }),
      }
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error?.message ?? `Facebook API error (${res.status})`);
    }

    await db.socialPost.update({
      where: { id: socialPost.id },
      data: { status: "posted", externalPostId: data.id, postedAt: new Date() },
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
