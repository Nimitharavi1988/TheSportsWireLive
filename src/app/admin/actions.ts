"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { postArticleToFacebook } from "@/lib/social/facebook";
import { HERO_CAP } from "@/lib/heroConfig";
import { revalidatePath } from "next/cache";

export async function approveArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.article.update({
    where: { id: articleId },
    data: {
      status: "published",
      // publishedAt is deliberately NOT set here — it already holds the
      // article's real-world publish date from ingestion (runIngest.ts).
      // Overwriting it with the approval timestamp was the bug that made
      // old news display with a fresh-looking date.
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
      // Not touching publishedAt — see approveArticle.
      reviewedBy: session.userId,
      reviewedAt: now,
    },
  });

  revalidatePath("/admin");
}

// "Approve all" from the queue toolbar — approves every pending article
// matching the current search/source/category filter (not just the current
// page's 50), in one updateMany so this stays cheap regardless of count:
// a single UPDATE statement server-side, not N individual calls. Same as
// the multi-select bulk approve, this skips the per-article Facebook post.
export async function approveAllMatching(filters: { q?: string; source?: string; category?: string }) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const { q, source, category } = filters;
  const now = new Date();
  await db.article.updateMany({
    where: {
      status: "pending_review",
      ...(source ? { sourceName: source } : {}),
      ...(category ? { category } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    data: {
      status: "published",
      // Not touching publishedAt — see approveArticle.
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

// Up to HERO_CAP articles can be manually picked for the hero carousel at
// once, most-recently-picked first (see featuredAt). Picking one more than
// the cap auto-retires the oldest pick rather than blocking the action or
// replacing everything — this keeps the cap enforced without the admin
// needing to remove one first.
export async function featureArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const currentlyFeatured = await db.article.findMany({
    where: { featured: true },
    orderBy: { featuredAt: "asc" },
    select: { id: true },
  });
  const alreadyPicked = currentlyFeatured.some((a) => a.id === articleId);
  if (!alreadyPicked && currentlyFeatured.length >= HERO_CAP) {
    const oldest = currentlyFeatured[0];
    await db.article.update({ where: { id: oldest.id }, data: { featured: false, featuredAt: null } });
  }

  await db.article.update({ where: { id: articleId }, data: { featured: true, featuredAt: new Date() } });

  revalidatePath("/admin");
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}

export async function unfeatureArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.article.update({ where: { id: articleId }, data: { featured: false, featuredAt: null } });

  revalidatePath("/admin");
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}

// Unlike featured, multiple articles can be highlighted at once — they're
// added to (not swapped with) the automatic keyword match in "Transfers &
// Big News", so there's no need to clear any existing flag first. The
// homepage itself caps the visible count at 4, most-recently-picked first.
export async function highlightArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.article.update({ where: { id: articleId }, data: { highlighted: true, highlightedAt: new Date() } });

  revalidatePath("/admin");
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}

export async function unhighlightArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.article.update({ where: { id: articleId }, data: { highlighted: false, highlightedAt: null } });

  revalidatePath("/admin");
  revalidatePath("/admin/homepage");
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
