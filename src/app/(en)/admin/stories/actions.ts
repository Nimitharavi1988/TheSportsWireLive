"use server";

import { db } from "@/db";
import { article, articleTag, author, vertical } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isKnownTag } from "@/lib/tags";
import { markStoryIdea } from "@/lib/storyIdeasData";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { CATEGORY_META } from "@/lib/categoryMeta";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES, mediaBucket, mediaKey, mediaUrl } from "@/lib/media";
import { ORIGINAL_SOURCE, ORIGINAL_TRENDING_SCORE, STORY_KINDS, authorSlug, isOriginalStory, publishProblems, storySlug } from "@/lib/stories";
import { articleUrl, submitToIndexNow } from "@/lib/indexNow";
import { searchPhotos, type PhotoResult } from "@/lib/photoSearch";
import { AiDraftError, requestDraft, type AiDraft } from "@/lib/aiDraft";
import { gatherDraftFacts, seriesLabelFor, type DraftRequest } from "@/lib/draftFacts";

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
  // The photo's source page (licence + author), for photos from the finder.
  heroImageCreditUrl: string | null;
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
  // The Story ideas entry it was started from (new stories only).
  ideaKey?: string;
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
      ? {
          heroImageUrl: input.heroImageUrl,
          heroImageCredit: input.heroImageUrl ? input.heroImageCredit?.trim() || null : null,
          heroImageCreditUrl: input.heroImageUrl ? input.heroImageCreditUrl : null,
        }
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
    // Off the Story ideas list: someone is writing it.
    if (input.ideaKey) await markStoryIdea(input.ideaKey.slice(0, 200), "used", id);
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

// Takes a published original story off the site, back to an editable draft
// (e.g. a piece found to need a rewrite). Publish puts it back; it then
// counts as new that day, like any first publish.
export async function unpublishStory(id: string): Promise<Result<object>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const [row] = await db.select({ status: article.status, sourceName: article.sourceName, slug: article.slug, category: article.category })
    .from(article).where(eq(article.id, id)).limit(1);
  if (!row || row.status !== "published" || !isOriginalStory(row)) return { ok: false, error: "Only published stories written here can be unpublished." };
  await db.update(article).set({ status: "draft", reviewedBy: session.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(article.id, id));
  revalidateStory(row.slug, row.category);
  return { ok: true };
}

export async function deleteDraft(id: string): Promise<Result<object>> {
  if (!(await getSession())) return { ok: false, error: "Not signed in." };
  const [row] = await db.select({ status: article.status, sourceName: article.sourceName }).from(article).where(eq(article.id, id)).limit(1);
  if (!row || row.status !== "draft" || !isOriginalStory(row)) return { ok: false, error: "Only unpublished drafts can be deleted." };
  await db.delete(article).where(eq(article.id, id));
  revalidatePath("/admin/stories");
  return { ok: true };
}

// ---- Photo finder (lib/photoSearch.ts) ------------------------------------

export async function searchStoryPhotos(query: string): Promise<Result<{ results: PhotoResult[]; failed: string[] }>> {
  if (!(await getSession())) return { ok: false, error: "Not signed in." };
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return { ok: false, error: "Type at least two letters." };
  try {
    return { ok: true, ...(await searchPhotos(q)) };
  } catch (err) {
    console.error("Photo search failed:", err);
    return { ok: false, error: "Search failed — try again." };
  }
}

// Hosts the two sources serve images from; nothing else is fetched.
const PHOTO_HOSTS = /^(upload|thumb)\.wikimedia\.org$|^(live|farm\d+)\.staticflickr\.com$/;
const MAX_IMPORT_BYTES = 12 * 1024 * 1024;

// Copies a chosen photo into our storage (lib/media.ts) and returns it with
// the credit its licence requires.
export async function importStoryPhoto(photo: Pick<PhotoResult, "importUrl" | "credit" | "landingUrl">): Promise<Result<{ url: string; credit: string; creditUrl: string }>> {
  if (!(await getSession())) return { ok: false, error: "Not signed in." };
  let source: URL;
  try {
    source = new URL(photo.importUrl);
  } catch {
    return { ok: false, error: "That photo can't be used." };
  }
  if (source.protocol !== "https:" || !PHOTO_HOSTS.test(source.hostname)) return { ok: false, error: "That photo's host isn't allowed." };
  try {
    const res = await fetch(source, { headers: { "User-Agent": "SportsWireLive/1.0 (https://sportswirelive.com; contact@hyperianai.com)" } });
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res.ok || !UPLOAD_TYPES[type]) return { ok: false, error: "Couldn't download that photo — pick another." };
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_IMPORT_BYTES) return { ok: false, error: "That photo is too large — pick another." };
    const key = mediaKey(createId(), type);
    await (await mediaBucket()).put(key, bytes, { httpMetadata: { contentType: type } });
    return { ok: true, url: mediaUrl(key), credit: photo.credit, creditUrl: photo.landingUrl };
  } catch (err) {
    console.error("Photo import failed:", err);
    return { ok: false, error: "Couldn't save that photo — try again." };
  }
}

// ---- AI draft (optional; lib/aiDraft.ts) -----------------------------------

export type AiDraftRequest = DraftRequest;

// Gathers what the site knows about the story's series, grounds, players
// and teams, and asks for a first draft built only from that.
export async function draftStoryWithAI(req: AiDraftRequest): Promise<Result<{ draft: AiDraft }>> {
  if (!(await getSession())) return { ok: false, error: "Not signed in." };
  const brief = req.brief.trim().slice(0, 600);
  if (brief.length < 10) return { ok: false, error: "Describe the story in a sentence or two first." };

  try {
    const draft = await requestDraft(await gatherDraftFacts({ ...req, brief }));
    return { ok: true, draft };
  } catch (err) {
    if (err instanceof AiDraftError) return { ok: false, error: err.message };
    console.error("AI draft failed:", err);
    return { ok: false, error: "The AI draft failed — try again." };
  }
}
