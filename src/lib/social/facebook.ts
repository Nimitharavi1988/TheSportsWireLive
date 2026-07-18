/**
 * Facebook Page auto-posting via the Meta Graph API.
 *
 * Setup required before this works (see plan section 4):
 *   1. Dedicated business Facebook account creates the Page + Meta Developer app
 *   2. Generate a long-lived Page Access Token, store as FACEBOOK_PAGE_ACCESS_TOKEN
 *   3. Store the Page ID as FACEBOOK_PAGE_ID
 *
 * This module is called after an article is approved (see admin actions.ts).
 * It's kept as its own isolated module — per the plan, the social publisher
 * should be swappable/isolated so a Meta API change doesn't touch the CMS.
 *
 * Posting strategy (see docs/social-growth-plan.md):
 *   - Posts as a photo (the auto-generated card from /api/og/[slug]) with a
 *     rich caption, not a bare text link — link posts get throttled by
 *     Meta's feed ranking, photo posts don't.
 *   - The article link is added as the first comment rather than in the
 *     post body, so the post itself stays link-free for reach purposes
 *     while the link is still one tap away.
 *   - The image is uploaded to Facebook as raw bytes (fetched from our own
 *     OG_IMAGE_BASE_URL, e.g. localhost during development) rather than
 *     passed as a `url` for Facebook's servers to fetch — Facebook can't
 *     reach a URL on your machine while the site isn't publicly deployed.
 */
import { db } from "../db";

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

const CATEGORY_HASHTAGS: Record<string, string[]> = {
  cricket: ["#Cricket"],
  "football/world-cup": ["#WorldCup", "#Football"],
  "football/euros": ["#Euros", "#Football"],
  football: ["#Football"],
};

function hashtagsFor(category: string): string[] {
  const specific =
    CATEGORY_HASHTAGS[category] ??
    (category.startsWith("cricket")
      ? CATEGORY_HASHTAGS.cricket
      : category.startsWith("football")
      ? CATEGORY_HASHTAGS.football
      : []);
  return [...specific, "#SportsNews"];
}

function composeCaption(article: { title: string; summary: string; category: string }): string {
  const tags = hashtagsFor(article.category).join(" ");
  return `${article.title}\n\n${article.summary}\n\nFull story — link in the comments 👇\n\n${tags}`;
}

export async function postArticleToFacebook(articleId: string) {
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) throw new Error(`Article ${articleId} not found`);

  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const siteUrl = process.env.SITE_URL;
  if (!pageId || !accessToken) {
    throw new Error("FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN not set");
  }
  if (!siteUrl) {
    throw new Error("SITE_URL not set");
  }

  const ogImageBase = process.env.OG_IMAGE_BASE_URL || "http://localhost:3000";
  const articleUrl = `${siteUrl}/article/${article.slug}`;
  const caption = composeCaption(article);

  const imageRes = await fetch(`${ogImageBase}/api/og/${article.slug}`);
  if (!imageRes.ok) {
    throw new Error(`Failed to render post image (${imageRes.status}) from ${ogImageBase}/api/og/${article.slug}`);
  }
  const imageBlob = await imageRes.blob();

  const form = new FormData();
  form.append("source", imageBlob, "card.png");
  form.append("caption", caption);
  form.append("access_token", accessToken);

  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
    method: "POST",
    body: form,
  });

  const data = await res.json();

  if (!res.ok) {
    await db.socialPost.create({
      data: {
        articleId,
        platform: "facebook",
        status: "failed",
        errorMessage: JSON.stringify(data),
      },
    });
    throw new Error(`Facebook post failed: ${JSON.stringify(data)}`);
  }

  // The /photos endpoint returns both a photo id and the resulting feed
  // post id — the comment needs to go on the feed post, not the photo.
  const feedPostId: string = data.post_id ?? data.id;

  try {
    await fetch(`${GRAPH_API_BASE}/${feedPostId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Read the full story: ${articleUrl}`, access_token: accessToken }),
    });
  } catch (err) {
    // Non-fatal — the post itself succeeded, only the follow-up comment failed.
    console.error("Failed to add link comment to Facebook post", feedPostId, err);
  }

  await db.socialPost.create({
    data: {
      articleId,
      platform: "facebook",
      status: "posted",
      externalPostId: feedPostId,
      postedAt: new Date(),
    },
  });

  return data;
}
