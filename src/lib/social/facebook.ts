import { db } from "@/lib/db";
import { displaySummary } from "@/lib/articleSummary";

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
  const message = `${article.title}\n\n${displaySummary(article, 400)}`;

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
