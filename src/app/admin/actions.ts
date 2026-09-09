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

// Bulk approve from the multi-select queue UI. Unlike the single-article
// approveArticle above, this deliberately skips the per-article Facebook
// post — auto-posting dozens of articles to the Page in one shot at once
// isn't something an admin selecting a batch is necessarily asking for.
export async function approveArticles(articleIds: string[]) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  if (articleIds.length === 0) return;

  const now = new Date();
  await db.article.updateMany({
    where: { id: { in: articleIds } },
    data: {
      status: "published",
      publishedAt: now,
      reviewedBy: session.userId,
      reviewedAt: now,
    },
  });

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

// Only one article is ever the manually-featured hero at a time — setting
// this one clears the flag from any other, so there's no ambiguity about
// which one the homepage should show.
export async function featureArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.article.updateMany({ where: { featured: true }, data: { featured: false } });
  await db.article.update({ where: { id: articleId }, data: { featured: true } });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function unfeatureArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.article.update({ where: { id: articleId }, data: { featured: false } });

  revalidatePath("/admin");
  revalidatePath("/");
}

// Unlike featured, multiple articles can be highlighted at once — they're
// added to (not swapped with) the automatic keyword match in "Transfers &
// Big News", so there's no need to clear any existing flag first.
export async function highlightArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.article.update({ where: { id: articleId }, data: { highlighted: true } });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function unhighlightArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.article.update({ where: { id: articleId }, data: { highlighted: false } });

  revalidatePath("/admin");
  revalidatePath("/");
}

// Recovery path for a false-positive automated flag (profanity/readability) —
// moves it back into the normal review queue so a human can approve/reject
// it like anything else, without needing a direct DB edit.
export async function unflagArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.article.update({ where: { id: articleId }, data: { status: "pending_review" } });

  revalidatePath("/admin");
}
