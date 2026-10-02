/**
 * Automatic story drafts: turns the open Story ideas (storyIdeas.ts — big
 * matches finished or coming up, players and teams in the news) into
 * editorial-style drafts in admin, so a writer starts from a finished first
 * pass instead of a blank page. Runs from the ingest workflow.
 *
 * NOTHING IS PUBLISHED HERE. Each draft is saved unpublished with no byline
 * and no photo, and carries [ADD: …] notes (gaps the model couldn't fill
 * from our data) and [CHECK: …] notes (every fact to verify). Publishing is
 * blocked until a writer clears them, adds a photo and puts their name on it
 * (stories.ts publishProblems). The drafts only use facts the site holds
 * (draftFacts.ts), the same grounding as "Draft with AI" in the editor.
 *
 * Spend and queue are capped so a busy news day can't flood the review
 * queue or the Gemini budget.
 */
import { db } from "@/db";
import { article, articleTag, vertical } from "@/db/schema";
import { and, eq, gte, isNull, count } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { fetchStoryIdeas, markStoryIdea } from "../storyIdeasData";
import type { StoryIdea } from "../storyIdeas";
import { MAX_DRAFTS_PER_DAY, MAX_DRAFTS_PER_RUN, MAX_UNREVIEWED, draftBodyWithChecks, draftProblem, pickIdeas } from "./autoDraftRules";
import { gatherDraftFacts, hasGroundingFacts, seriesLabelFor } from "../draftFacts";
import { AiDraftError, requestDraft, type AiDraft } from "../aiDraft";
import { ORIGINAL_SOURCE, ORIGINAL_TRENDING_SCORE, storySlug } from "../stories";
import { isKnownTag } from "../tags";
import { articleUrl } from "../indexNow";

async function autoDraftCounts(now: Date) {
  const base = and(eq(article.sourceName, ORIGINAL_SOURCE), eq(article.status, "draft"), isNull(article.reviewedBy));
  const [[unreviewed], [today]] = await Promise.all([
    db.select({ n: count() }).from(article).where(base),
    db.select({ n: count() }).from(article).where(and(base, gte(article.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)))),
  ]);
  return { unreviewed: unreviewed.n, today: today.n };
}

async function saveDraft(idea: StoryIdea, draft: AiDraft, verticalId: string, now: Date): Promise<string> {
  const id = createId();
  const slug = storySlug(draft.title, now.getTime());
  const seriesLabel = idea.seriesKey ? await seriesLabelFor(idea.seriesKey) : null;
  await db.insert(article).values({
    id,
    slug,
    verticalId,
    title: draft.title,
    summary: draft.summary,
    body: draftBodyWithChecks(draft),
    category: idea.sport,
    storyKind: idea.storyKind,
    seriesKey: idea.seriesKey && seriesLabel ? idea.seriesKey : null,
    seriesLabel: idea.seriesKey && seriesLabel ? seriesLabel : null,
    sourceName: ORIGINAL_SOURCE,
    sourceUrl: articleUrl(slug),
    dedupeHash: `original-${id}`,
    trendingScore: ORIGINAL_TRENDING_SCORE,
    // reviewedBy stays null until a writer saves it: that's what marks it an
    // automatic draft in the Stories list.
    status: "draft",
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  const tags = idea.tags.filter(isKnownTag);
  if (tags.length > 0) await db.insert(articleTag).values(tags.map((t) => ({ articleId: id, kind: t.kind, slug: t.slug }))).onConflictDoNothing();
  await markStoryIdea(idea.key, "used", id);
  return id;
}

export async function autoDraftStories(now: Date = new Date()): Promise<{ drafted: number; note: string }> {
  const counts = await autoDraftCounts(now);
  if (counts.unreviewed >= MAX_UNREVIEWED) return { drafted: 0, note: `${counts.unreviewed} drafts still waiting for review` };
  const room = Math.min(MAX_DRAFTS_PER_RUN, MAX_DRAFTS_PER_DAY - counts.today, MAX_UNREVIEWED - counts.unreviewed);
  if (room <= 0) return { drafted: 0, note: "daily limit reached" };

  const [sports] = await db.select({ id: vertical.id }).from(vertical).where(eq(vertical.name, "sports")).limit(1);
  if (!sports) return { drafted: 0, note: "no sports vertical" };

  let drafted = 0;
  // Ideas without facts are skipped (not marked), so they're tried again as
  // data arrives; pick more than needed to allow for them.
  for (const idea of pickIdeas(await fetchStoryIdeas(now), 12)) {
    if (drafted >= room) break;
    const facts = await gatherDraftFacts({ brief: idea.brief, category: idea.sport, storyKind: idea.storyKind, seriesKey: idea.seriesKey, tags: idea.tags });
    if (!hasGroundingFacts(facts)) continue;
    let draft: AiDraft;
    try {
      draft = await requestDraft(facts);
    } catch (err) {
      // Out of credit, busy or not configured: stop, try again next run.
      if (err instanceof AiDraftError) return { drafted, note: err.message };
      throw err;
    }
    const problem = draftProblem(draft);
    if (problem) {
      // Not retried — it would cost a call every run.
      console.log(`Auto-draft skipped "${idea.headline}" (${problem}).`);
      await markStoryIdea(idea.key, "dismissed");
      continue;
    }
    await saveDraft(idea, draft, sports.id, now);
    console.log(`Auto-draft saved: "${draft.title}" (${idea.kind}, ${idea.sport}).`);
    drafted++;
  }
  return { drafted, note: "ok" };
}

if (require.main === module) {
  autoDraftStories()
    .then(({ drafted, note }) => {
      console.log(`Auto-draft: ${drafted} new draft(s) (${note}).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Auto-draft run failed:", err);
      process.exit(1);
    });
}
