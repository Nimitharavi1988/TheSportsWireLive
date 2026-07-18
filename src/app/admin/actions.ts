"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { postArticleToFacebook } from "@/lib/social/facebook";
import { revalidatePath } from "next/cache";

export async function approveArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.article.update({
    where: { id: articleId },
    data: {
      status: "published",
      publishedAt: new Date(),
      reviewedBy: session.userId,
      reviewedAt: new Date(),
    },
  });

  // Queue social posting — errors here are logged but don't block
  // the article from being published on the site (per plan: isolated
  // social publisher, a platform issue shouldn't affect the core site).
  try {
    await postArticleToFacebook(articleId);
  } catch (err) {
    console.error("Facebook post failed for article", articleId, err);
  }

  revalidatePath("/admin");
}

export async function rejectArticle(articleId: string, reason?: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.article.update({
    where: { id: articleId },
    data: {
      status: "rejected",
      reviewedBy: session.userId,
      reviewedAt: new Date(),
      profanityDetail: reason ?? undefined,
    },
  });

  revalidatePath("/admin");
}
