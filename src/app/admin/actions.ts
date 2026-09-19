"use server";

import { db } from "@/db";
import { article, poll, pollOption } from "@/db/schema";
import { and, eq, inArray, ilike, asc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getSession } from "@/lib/auth";
import { isMatchDataSource } from "@/lib/matchDataSources";
import { postArticleToFacebook } from "@/lib/social/facebook";
import { postArticleToInstagram } from "@/lib/social/instagram";
import { sendPushToAllSubscribers } from "@/lib/push";
import { HERO_CAP, sectionOf } from "@/lib/heroConfig";
import { submitToIndexNow, articleUrl } from "@/lib/indexNow";
import { revalidatePath } from "next/cache";

export async function approveArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const [updated] = await db.update(article)
    .set({
      status: "published",
      // publishedAt is deliberately NOT set here — it already holds the
      // article's real-world publish date from ingestion (runIngest.ts).
      // Overwriting it with the approval timestamp was the bug that made
      // old news display with a fresh-looking date.
      reviewedBy: session.userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(article.id, articleId))
    .returning();

  // Queue social posting — errors here are logged but don't block
  // the article from being published on the site (per plan: isolated
  // social publisher, a platform issue shouldn't affect the core site).
  try {
    await postArticleToFacebook(articleId);
  } catch (err) {
    console.error("Facebook post failed for article", articleId, err);
  }
  try {
    await postArticleToInstagram(articleId);
  } catch (err) {
    console.error("Instagram post failed for article", articleId, err);
  }

  // Best-effort, same isolation principle as the Facebook post above.
  await submitToIndexNow([articleUrl(updated.slug)]);

  revalidatePath("/admin");
}

// Manual catch-up for an already-published article that never made it to
// Facebook — either autoApprove.ts's isHighlightWorthy/volume-cap filter
// left it out, or a post attempt failed (rate limit, transient API error).
// No gating here: an admin explicitly choosing "Post to Facebook" for one
// specific article is a deliberate action, same reasoning as the single-
// article approveArticle's own always-post behavior above.
// Returns a result instead of throwing — a plain <form action> letting this
// throw uncaught was crashing the whole admin page into the generic
// error.tsx boundary ("Something went wrong") on any real failure (a rate
// limit, a transient API error), with the actual reason never shown to the
// admin. The client button now calls this directly and displays whatever
// error comes back instead.
export async function postToFacebookManually(articleId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  try {
    await postArticleToFacebook(articleId);
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Same manual catch-up as postToFacebookManually above, for Instagram.
export async function postToInstagramManually(articleId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  try {
    await postArticleToInstagram(articleId);
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Deliberately admin-triggered only, never automatic — see push.ts's own
// comment for why. An admin decides per-article whether a story is big
// enough to interrupt every subscriber's phone for.
export async function sendPushNotificationManually(articleId: string): Promise<{ success: boolean; error?: string; sent?: number; failed?: number }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const [target] = await db.select({ title: article.title, slug: article.slug }).from(article).where(eq(article.id, articleId)).limit(1);
  if (!target) return { success: false, error: "Article not found" };

  try {
    const { sent, failed } = await sendPushToAllSubscribers(target);
    return { success: true, sent, failed };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Queues the bold-poster Instagram format (bespoke per-article hook + fact
// table over a real photo — see instagramPoster.tsx) instead of posting
// inline. This can't run inline here the way postToInstagramManually does:
// next/og can't render in this deployed Cloudflare Worker (confirmed bad
// fit for Workers/WASM), so poster generation has to happen in a plain
// Node runner. Triggers the post-instagram-poster.yml GitHub Actions
// workflow via its dispatch API, which does the actual generation +
// posting — this only kicks that off and returns immediately, it does not
// wait for the result. GITHUB_DISPATCH_TOKEN is a repo-scoped GitHub PAT
// with Actions read/write, set as a Cloudflare secret (never in this repo).
const GITHUB_REPO = "Nimitharavi1988/TheSportsWireLive";

export async function postInstagramPosterManually(articleId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { success: false, error: "GITHUB_DISPATCH_TOKEN is not configured" };

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/post-instagram-poster.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "master", inputs: { article_id: articleId } }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub dispatch failed (${res.status}): ${text}`);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
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
  const published = await db.update(article)
    .set({
      status: "published",
      // Not touching publishedAt — see approveArticle.
      reviewedBy: session.userId,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(inArray(article.id, articleIds))
    .returning({ slug: article.slug });
  await submitToIndexNow(published.map((a) => articleUrl(a.slug)));

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
  const whereConditions = [
    eq(article.status, "pending_review"),
    ...(source ? [eq(article.sourceName, source)] : []),
    ...(category ? [eq(article.category, category)] : []),
    ...(q ? [ilike(article.title, `%${q}%`)] : []),
  ];

  const now = new Date();
  // .returning() gives back each affected row's post-update values in one
  // atomic statement — the WHERE clause is still evaluated against each
  // row's state before the update, so this replaces what used to need a
  // separate pre-update query (a Prisma updateMany limitation, not a real
  // requirement) with something that's also race-condition-free.
  const matching = await db.update(article)
    .set({
      status: "published",
      // Not touching publishedAt — see approveArticle.
      reviewedBy: session.userId,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(and(...whereConditions))
    .returning({ slug: article.slug });

  await submitToIndexNow(matching.map((a) => articleUrl(a.slug)));

  revalidatePath("/admin");
}

export async function rejectArticle(articleId: string, reason?: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.update(article)
    .set({
      status: "rejected",
      reviewedBy: session.userId,
      reviewedAt: new Date(),
      profanityDetail: reason ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(article.id, articleId));

  revalidatePath("/admin");
}

// Up to HERO_CAP articles can be manually picked per section (football,
// cricket, american-football — see sectionOf), most-recently-picked first
// within that section. Picking one more than the cap within the SAME
// section auto-retires that section's oldest pick, rather than blocking
// the action or touching any other section's picks — a cricket pick and a
// football pick don't compete for the same budget, since they only ever
// appear on their own section's hero anyway (found and fixed after a real
// report: featuring 5 cricket articles was silently blocking football
// picks from being added at all, auto-retiring cricket picks instead of
// leaving them alone).
export async function featureArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const targetRows = await db.select({ category: article.category }).from(article).where(eq(article.id, articleId)).limit(1);
  const target = targetRows[0] ?? null;
  if (!target) throw new Error("Article not found");
  const section = sectionOf(target.category);

  const currentlyFeatured = await db.select({ id: article.id, category: article.category }).from(article)
    .where(eq(article.featured, true)).orderBy(asc(article.featuredAt));
  const inSameSection = currentlyFeatured.filter((a) => sectionOf(a.category) === section);
  const alreadyPicked = inSameSection.some((a) => a.id === articleId);
  if (!alreadyPicked && inSameSection.length >= HERO_CAP) {
    const oldest = inSameSection[0];
    await db.update(article).set({ featured: false, featuredAt: null, updatedAt: new Date() }).where(eq(article.id, oldest.id));
  }

  await db.update(article).set({ featured: true, featuredAt: new Date(), updatedAt: new Date() }).where(eq(article.id, articleId));

  revalidatePath("/admin");
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}

export async function unfeatureArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.update(article).set({ featured: false, featuredAt: null, updatedAt: new Date() }).where(eq(article.id, articleId));

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

  // A raw auto-generated scoreline ("Yankees 6-4 Mets") isn't "big news" —
  // "📌 Editor's pick" is meant for genuinely notable curated stories.
  // Enforced server-side (not just hidden in the UI) so this can't drift.
  const targetRows = await db.select({ sourceName: article.sourceName }).from(article).where(eq(article.id, articleId)).limit(1);
  const target = targetRows[0] ?? null;
  if (target && isMatchDataSource(target.sourceName)) {
    throw new Error("Match-data results can't be highlighted as Editor's pick — that's for editorial stories.");
  }

  await db.update(article).set({ highlighted: true, highlightedAt: new Date(), updatedAt: new Date() }).where(eq(article.id, articleId));

  revalidatePath("/admin");
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}

export async function unhighlightArticle(articleId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await db.update(article).set({ highlighted: false, highlightedAt: null, updatedAt: new Date() }).where(eq(article.id, articleId));

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

  await db.update(article).set({ status: "pending_review", updatedAt: new Date() }).where(eq(article.id, articleId));

  revalidatePath("/admin");
}

// Hand-curated only, deliberately not auto-generated — a predictive/
// speculative poll question ("Will X score next match?") is a different
// content category from this site's strict "grounded in real facts only"
// editorial line elsewhere, so it's a human decision each time, not a
// pipeline step. One poll per article (schema-enforced via a unique
// constraint on Poll.articleId).
export async function createPoll(articleId: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const cleanQuestion = String(formData.get("question") ?? "").trim();
  const cleanOptions = formData
    .getAll("option")
    .map((o) => String(o).trim())
    .filter(Boolean);
  if (!cleanQuestion || cleanOptions.length < 2) {
    throw new Error("A poll needs a question and at least 2 options");
  }

  // drizzle-orm/neon-http has no db.transaction() support (throws at
  // runtime) — db.batch() is Neon's HTTP-driver equivalent, sending both
  // statements as one atomic request so a failure partway through can't
  // leave an orphaned poll with zero options.
  const pollId = createId();
  await db.batch([
    db.insert(poll).values({ id: pollId, articleId, question: cleanQuestion }),
    db.insert(pollOption).values(cleanOptions.map((text) => ({ id: createId(), pollId, text }))),
  ]);

  revalidatePath("/admin");
  revalidatePath(`/article/[slug]`, "page");
}

// No edit flow for MVP scope — a poll with real votes shouldn't have its
// options silently rewritten underneath those votes, so "start over" is the
// deliberate recovery path rather than an in-place edit.
export async function deletePoll(pollId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  // Real Postgres ON DELETE CASCADE (from the original Prisma migration)
  // still applies here regardless of ORM — PollOption/PollVote rows for
  // this poll are removed by the database itself, not application logic.
  await db.delete(poll).where(eq(poll.id, pollId));

  revalidatePath("/admin");
  revalidatePath(`/article/[slug]`, "page");
}
