/**
 * Automatic story drafts: turns the open Story ideas (storyIdeas.ts — big
 * matches finished or coming up, players and teams in the news) into
 * editorial-style drafts in admin, so a writer starts from a finished first
 * pass instead of a blank page. Runs from the ingest workflow.
 *
 * NOTHING IS PUBLISHED HERE. Each draft is saved unpublished with no byline,
 * and carries [ADD: …] notes (gaps the model couldn't fill) and [CHECK: …]
 * notes (facts to verify, the suggested writer, the sources). Publishing is
 * blocked until a writer clears them and puts their name on it (stories.ts
 * publishProblems).
 *
 * Each draft (since 2026-10-04): the facts are researched on the web first
 * (research.ts), on top of what the site holds (draftFacts.ts); it's written
 * in one of several formats picked at random; a second call fact-checks it
 * against the research and cuts what isn't supported; and a licensed photo
 * that names the subject is attached when one exists.
 *
 * Spend and queue are capped so a busy news day can't flood the review
 * queue or the Gemini budget.
 */
import { db } from "@/db";
import { article, articleTag, dataSnapshot, vertical } from "@/db/schema";
import { and, eq, gte, isNull, count } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { fetchStoryIdeas, markStoryIdea } from "../storyIdeasData";
import type { StoryIdea } from "../storyIdeas";
import {
  MAX_DRAFTS_PER_DAY, MAX_DRAFTS_PER_RUN, MAX_RESEARCH_PER_RUN, MAX_UNREVIEWED, MIN_WEB_FACTS,
  cleanDraftProblem, draftBodyWithChecks, draftProblem, editorNotes, pickFormat, pickIdeas, pickPhoto, reviewPackKey, suggestedWriter,
  type ReviewPack,
} from "./autoDraftRules";
import { researchFromCoverage } from "./coverageResearch";
import { gatherDraftFacts, seriesLabelFor } from "../draftFacts";
import { AiDraftError, requestDraft, type AiDraft } from "../aiDraft";
import { RESEARCH_MODEL, factCheckDraft, researchStory } from "./research";
import { searchPhotos, type PhotoResult } from "../photoSearch";
import { ORIGINAL_SOURCE, ORIGINAL_TRENDING_SCORE, storySlug } from "../stories";
import { isKnownTag } from "../tags";
import { articleUrl } from "../indexNow";
import { TRACKED_PLAYERS } from "../players";
import { TRACKED_CLUBS } from "../clubs";
import { TRACKED_COUNTRIES } from "../countries";
import { VENUES } from "../venues";

// Who or what the photo should show: the first tagged player, else team,
// else ground.
function photoSubject(tags: { kind: string; slug: string }[]): string | null {
  const find = <T extends { slug: string; name: string }>(kind: string, list: T[]) =>
    tags.filter((t) => t.kind === kind).map((t) => list.find((x) => x.slug === t.slug)?.name).find(Boolean);
  return find("player", TRACKED_PLAYERS) ?? find("club", TRACKED_CLUBS) ?? find("country", TRACKED_COUNTRIES) ?? find("venue", VENUES) ?? null;
}

async function suggestPhoto(subject: string | null): Promise<PhotoResult | null> {
  if (!subject) return null;
  try {
    return pickPhoto((await searchPhotos(subject)).results, subject);
  } catch (err) {
    console.error("Auto-draft photo search failed:", err);
    return null;
  }
}

async function autoDraftCounts(now: Date) {
  const base = and(eq(article.sourceName, ORIGINAL_SOURCE), eq(article.status, "draft"), isNull(article.reviewedBy));
  const [[unreviewed], [today]] = await Promise.all([
    db.select({ n: count() }).from(article).where(base),
    db.select({ n: count() }).from(article).where(and(base, gte(article.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)))),
  ]);
  return { unreviewed: unreviewed.n, today: today.n };
}

async function saveDraft(idea: StoryIdea, draft: AiDraft, photo: PhotoResult | null, verticalId: string, now: Date, pack?: ReviewPack): Promise<string> {
  const id = createId();
  const slug = storySlug(draft.title, now.getTime());
  const seriesLabel = idea.seriesKey ? await seriesLabelFor(idea.seriesKey) : null;
  await db.insert(article).values({
    id,
    slug,
    verticalId,
    title: draft.title,
    summary: draft.summary,
    // A review-pack draft keeps its text clean; the checks live in the pack.
    body: pack ? draft.body : draftBodyWithChecks(draft),
    // Linked from Commons, not copied to our storage: this runs on GitHub
    // Actions, which has no access to the media bucket. Picking it again
    // with Find a photo in the editor copies it over.
    heroImageUrl: photo?.importUrl ?? null,
    heroImageCredit: photo?.credit ?? null,
    heroImageCreditUrl: photo?.landingUrl ?? null,
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
  if (pack) {
    await db.insert(dataSnapshot).values({ key: reviewPackKey(id), data: pack, sourceUrl: "internal:draft-review", fetchedAt: now })
      .onConflictDoUpdate({ target: dataSnapshot.key, set: { data: pack, fetchedAt: now } });
  }
  await markStoryIdea(idea.key, "used", id);
  return id;
}

// The workflow uses the defaults. The local script (scripts/draftLocal.ts)
// raises the limits, researches from stored coverage instead of paid web
// search (freeResearch) and saves clean drafts with a review pack beside them
// (reviewPack) for one-click approval at /admin/stories/review.
export interface AutoDraftOptions {
  perRun?: number;
  perDay?: number;
  researchPerRun?: number;
  maxUnreviewed?: number;
  freeResearch?: boolean;
  reviewPack?: boolean;
}

export async function autoDraftStories(now: Date = new Date(), opts: AutoDraftOptions = {}): Promise<{ drafted: number; note: string }> {
  const perRun = opts.perRun ?? MAX_DRAFTS_PER_RUN;
  const perDay = opts.perDay ?? MAX_DRAFTS_PER_DAY;
  const researchPerRun = opts.researchPerRun ?? MAX_RESEARCH_PER_RUN;
  const maxUnreviewed = opts.maxUnreviewed ?? MAX_UNREVIEWED;
  const counts = await autoDraftCounts(now);
  if (counts.unreviewed >= maxUnreviewed) return { drafted: 0, note: `${counts.unreviewed} drafts still waiting for review` };
  const room = Math.min(perRun, perDay - counts.today, maxUnreviewed - counts.unreviewed);
  if (room <= 0) return { drafted: 0, note: "daily limit reached" };

  const [sports] = await db.select({ id: vertical.id }).from(vertical).where(eq(vertical.name, "sports")).limit(1);
  if (!sports) return { drafted: 0, note: "no sports vertical" };

  let drafted = 0;
  let researched = 0;
  // Ideas without facts are skipped (not marked), so they're tried again as
  // data arrives; pick more than needed to allow for them.
  for (const idea of pickIdeas(await fetchStoryIdeas(now), 12)) {
    if (drafted >= room) break;
    // Each idea tried costs a search call, drafted or not.
    if (++researched > researchPerRun) break;
    const research = opts.freeResearch
      ? await researchFromCoverage({ id: `idea:${idea.key}`, title: idea.headline, summary: idea.brief, sourceName: ORIGINAL_SOURCE, sourceUrl: "", category: idea.sport }, now)
      : await researchStory(idea.headline, idea.brief, now);
    // Gemini unavailable: stop, try again next run.
    if (!research) return { drafted, note: "research unavailable" };
    if (research.facts.length < MIN_WEB_FACTS) {
      // Too little reported yet: dismissed rather than retried every run.
      console.log(`Auto-draft skipped "${idea.headline}" (${research.facts.length} researched facts).`);
      await markStoryIdea(idea.key, "dismissed");
      continue;
    }
    const facts = await gatherDraftFacts({ brief: idea.brief, category: idea.sport, storyKind: idea.storyKind, seriesKey: idea.seriesKey, tags: idea.tags });
    const format = pickFormat(idea.kind);
    let draft: AiDraft;
    try {
      draft = await requestDraft({ ...facts, webFacts: research.facts, format }, RESEARCH_MODEL);
    } catch (err) {
      // Out of credit, busy or not configured: stop, try again next run.
      if (err instanceof AiDraftError) return { drafted, note: err.message };
      throw err;
    }
    const problem = opts.reviewPack ? cleanDraftProblem(draft) : draftProblem(draft);
    if (problem) {
      // Not retried — it would cost a call every run.
      console.log(`Auto-draft skipped "${idea.headline}" (${problem}).`);
      await markStoryIdea(idea.key, "dismissed");
      continue;
    }
    // Checked against the researched facts plus the site's own fixtures.
    const checked = await factCheckDraft([...research.facts, ...facts.fixtures], draft.body);
    if (!checked) return { drafted, note: "fact-check unavailable" };
    const checkedDraft = { ...draft, body: checked.body };
    if (opts.reviewPack ? cleanDraftProblem(checkedDraft) : draftProblem(checkedDraft)) {
      console.log(`Auto-draft skipped "${idea.headline}" (too little left after the fact-check).`);
      await markStoryIdea(idea.key, "dismissed");
      continue;
    }
    const subject = photoSubject(idea.tags);
    const photo = await suggestPhoto(subject);
    const notes = editorNotes({ writer: suggestedWriter(idea.sport), sources: research.sources, removed: checked.removed.length, photoSubject: photo ? subject : null });
    const checks = [...notes, ...draft.checks];
    const pack: ReviewPack | undefined = opts.reviewPack
      ? {
          writer: suggestedWriter(idea.sport), format, kind: idea.kind, sport: idea.sport, sources: research.sources,
          facts: research.facts, checks, removed: checked.removed.length, photoSubject: photo ? subject : null, createdAt: now.toISOString(),
        }
      : undefined;
    await saveDraft(idea, { ...checkedDraft, checks }, photo, sports.id, now, pack);
    console.log(`Auto-draft saved: "${draft.title}" (${idea.kind}, ${idea.sport}, ${format}, ${research.facts.length} facts, ${checked.removed.length} removed).`);
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
