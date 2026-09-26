"use server";

import { db } from "@/db";
import { article, articleTag, author, vertical } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { isKnownTag } from "@/lib/tags";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { CATEGORY_META } from "@/lib/categoryMeta";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES, mediaBucket, mediaKey, mediaUrl } from "@/lib/media";
import { ORIGINAL_SOURCE, ORIGINAL_TRENDING_SCORE, STORY_KINDS, authorSlug, isOriginalStory, publishProblems, storySlug } from "@/lib/stories";
import { articleUrl, submitToIndexNow } from "@/lib/indexNow";

// Write a story / Edit (src/app/admin/stories). Every action checks the
// admin session and returns a result rather than throwing, so the editor
// can show what went wrong (a thrown server action error blanks the page).

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export async function uploadStoryImage(formData: FormData): Promise<Result<{ url: string }>> {
  if (!(await getSession())) return { ok: false, error: "Not signed in." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No photo received." };
  if (!UPLOAD_TYPES[file.type]) return { ok: false, error: "Use a JPEG, PNG or WebP photo." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Photo is over 5 MB." };
  try {
    const key = mediaKey(createId(), file.type);
    await (await mediaBucket()).put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    return { ok: true, url: mediaUrl(key) };
  } catch (err) {
    console.error("Story photo upload failed:", err);
    return { ok: false, error: "Upload failed — try again." };
  }
}

export interface SaveStoryInput {
  id?: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  // Original stories only (lib/stories.ts STORY_KINDS).
  storyKind: string;
  heroImageUrl: string | null;
  heroImageCredit: string | null;
  authorName: string;
  authorBio: string;
  // Original stories: publish (or save as a draft). Edits of ingested
  // stories keep their status.
  publish: boolean;
  // Edits of ingested stories: put the editor's byline on it (only for a
  // substantial rewrite).
  byline: boolean;
  // The series/event it belongs to (/series/[key]), or none.
  seriesKey: string | null;
  // Players, teams, countries and venues it's about (lib/tags.ts).
  tags: { kind: string; slug: string }[];
}

// The series/event label for a key, from the stories already filed under it.
async function seriesLabelFor(key: string): Promise<string | null> {
  const [row] = await db.select({ label: article.seriesLabel }).from(article)
    .where(and(eq(article.seriesKey, key), isNotNull(article.seriesLabel))).limit(1);
  return row?.label ?? null;
}

// Replaces a story's tags with the chosen set (unknown ones dropped).
async function saveTags(articleId: string, tags: { kind: string; slug: string }[]) {
  const valid = tags.filter(isKnownTag);
  await db.delete(articleTag).where(eq(articleTag.articleId, articleId));
  if (valid.length > 0) {
    await db.insert(articleTag).values(valid.map((t) => ({ articleId, kind: t.kind, slug: t.slug }))).onConflictDoNothing();
  }
}

async function upsertAuthor(name: string, bio: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const slug = authorSlug(trimmed);
  await db.insert(author).values({ slug, name: trimmed, bio: bio.trim() || null })
    .onConflictDoUpdate({ target: author.slug, set: { name: trimmed, ...(bio.trim() ? { bio: bio.trim() } : {}) } });
  return slug;
}

function revalidateStory(slug: string, category: string) {
  revalidatePath(`/article/${slug}`);
  revalidatePath("/");
  revalidatePath(`/sport/${category.split("/")[0]}`);
  revalidatePath("/admin/stories");
  revalidatePath("/analysis");
}

export async function saveStory(input: SaveStoryInput): Promise<Result<{ id: string; slug: string; status: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const categories = Object.keys(CATEGORY_META);
  const now = new Date();

  const existing = input.id
    ? (await db.select().from(article).where(eq(article.id, input.id)).limit(1))[0]
    : undefined;
  if (input.id && !existing) return { ok: false, error: "Story not found." };
  const original = !existing || isOriginalStory(existing);

  // Publishing an original story needs it complete; an edit of an ingested
  // story only needs its text in place (many are shorter than the bar for
  // an original piece).
  if (original && input.publish) {
    const problems = publishProblems(input, categories);
    if (!input.authorName.trim()) problems.push("Add the writer's name for the byline.");
    if (problems.length > 0) return { ok: false, error: problems.join(" ") };
  }
  if (!input.title.trim()) return { ok: false, error: "Add a headline." };
  const storyKind = input.storyKind in STORY_KINDS ? input.storyKind : "analysis";
  const seriesLabel = input.seriesKey ? await seriesLabelFor(input.seriesKey) : null;
  const series = input.seriesKey && seriesLabel ? { seriesKey: input.seriesKey, seriesLabel } : { seriesKey: null, seriesLabel: null };
  if (!original && !input.summary.trim()) return { ok: false, error: "Add a summary." };
  if (!original && input.byline && !input.authorName.trim()) return { ok: false, error: "Add the writer's name for the byline." };

  // Unticking the byline on an edited ingested story takes it off again.
  const byline = original || input.byline ? await upsertAuthor(input.authorName, input.authorBio) : null;
  // An ingested story keeps its photo credit (and its link) unless the
  // photo itself was changed here.
  const photoChanged = !existing || existing.heroImageUrl !== input.heroImageUrl;
  const text = {
    title: input.title.trim(),
    summary: input.summary.trim(),
    body: input.body.trim(),
    ...(photoChanged
      ? { heroImageUrl: input.heroImageUrl, heroImageCredit: input.heroImageUrl ? input.heroImageCredit?.trim() || null : null, heroImageCreditUrl: null }
      : { heroImageCredit: input.heroImageCredit?.trim() || existing!.heroImageCredit }),
    authorSlug: byline,
    ...series,
    reviewedBy: session.userId,
    reviewedAt: now,
    updatedAt: now,
  };

  if (!existing) {
    const [sports] = await db.select({ id: vertical.id }).from(vertical).where(eq(vertical.name, "sports")).limit(1);
    const id = createId();
    const slug = storySlug(text.title, now.getTime());
    await db.insert(article).values({
      ...text,
      id,
      slug,
      verticalId: sports.id,
      category: input.category,
      storyKind,
      sourceName: ORIGINAL_SOURCE,
      sourceUrl: articleUrl(slug),
      dedupeHash: `original-${id}`,
      trendingScore: ORIGINAL_TRENDING_SCORE,
      status: input.publish ? "published" : "draft",
      publishedAt: input.publish ? now : null,
      createdAt: now,
    });
    await saveTags(id, input.tags);
    if (input.publish) await submitToIndexNow([articleUrl(slug)]);
    revalidateStory(slug, input.category);
    return { ok: true, id, slug, status: input.publish ? "published" : "draft" };
  }

  // First publish of a draft: it's new today (news sitemap, feeds).
  const firstPublish = original && input.publish && existing.status === "draft";
  const status = original ? (input.publish ? "published" : "draft") : existing.status;
  await db.update(article).set({
    ...text,
    ...(original ? { category: input.category, storyKind, status } : {}),
    ...(firstPublish ? { publishedAt: now, createdAt: now } : {}),
  }).where(eq(article.id, existing.id));
  await saveTags(existing.id, input.tags);
  if (status === "published") await submitToIndexNow([articleUrl(existing.slug)]);
  revalidateStory(existing.slug, original ? input.category : existing.category);
  return { ok: true, id: existing.id, slug: existing.slug, status };
}

export async function deleteDraft(id: string): Promise<Result<object>> {
  if (!(await getSession())) return { ok: false, error: "Not signed in." };
  const [row] = await db.select({ status: article.status, sourceName: article.sourceName }).from(article).where(eq(article.id, id)).limit(1);
  if (!row || row.status !== "draft" || !isOriginalStory(row)) return { ok: false, error: "Only unpublished drafts can be deleted." };
  await db.delete(article).where(eq(article.id, id));
  revalidatePath("/admin/stories");
  return { ok: true };
}
