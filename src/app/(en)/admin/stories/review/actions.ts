"use server";

import { db } from "@/db";
import { article, author } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { CATEGORY_META } from "@/lib/categoryMeta";
import { ORIGINAL_SOURCE, authorSlug, publishProblems } from "@/lib/stories";
import { articleUrl, submitToIndexNow } from "@/lib/indexNow";

// One-click approval of an auto-draft that was saved clean with a review pack
// (src/lib/stories/autoDraft.ts, reviewPack mode). The reviewer's session is
// recorded as the approver; the byline is the name typed on the review page
// (prefilled from DRAFT_BYLINE_NAME). Nothing publishes without this click.
export async function approveReviewedDraft(formData: FormData): Promise<void> {
  if (!(await getSession())) redirect("/admin/login");
  const session = (await getSession())!;
  const id = String(formData.get("id") ?? "");
  const byline = String(formData.get("byline") ?? "").trim();
  const back = (msg: string) => redirect(`/admin/stories/review?error=${encodeURIComponent(msg)}`);

  if (!byline) return back("Add the name for the byline.");
  const [row] = await db.select().from(article).where(and(
    eq(article.id, id), eq(article.sourceName, ORIGINAL_SOURCE), eq(article.status, "draft"),
  )).limit(1);
  if (!row) return back("That draft is no longer waiting for review.");

  const problems = publishProblems(
    { title: row.title, summary: row.summary, body: row.body ?? "", category: row.category, heroImageUrl: row.heroImageUrl },
    Object.keys(CATEGORY_META),
  );
  if (problems.length > 0) return back(`"${row.title}" can't be published yet: ${problems.join(" ")}`);

  const slug = authorSlug(byline);
  await db.insert(author).values({ slug, name: byline }).onConflictDoNothing();
  const now = new Date();
  await db.update(article).set({
    status: "published", publishedAt: now, createdAt: now, authorSlug: slug,
    reviewedBy: session.userId, reviewedAt: now, updatedAt: now,
  }).where(eq(article.id, row.id));
  await submitToIndexNow([articleUrl(row.slug)]);
  revalidatePath(`/article/${row.slug}`);
  revalidatePath("/");
  revalidatePath(`/sport/${row.category.split("/")[0]}`);
  revalidatePath("/analysis");
  revalidatePath("/admin/stories");
  redirect(`/admin/stories/review?approved=${encodeURIComponent(row.title)}`);
}
