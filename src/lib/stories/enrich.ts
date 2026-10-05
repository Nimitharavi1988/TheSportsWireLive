/**
 * Enriching top stories (2026-10-04). Most ingested stories are short
 * write-ups of another outlet's report, under 300 words, so they're noindex
 * (thinContent.ts) and the site had almost nothing in search. Each run takes
 * the day's highest-trending of them and turns them into full reports:
 *
 *   1. research the story on the web (research.ts: Gemini + Google Search),
 *   2. write a 350-550 word news report from those facts only,
 *   3. fact-check it against the research (claims it doesn't support go),
 *   4. replace the story's text in place: same address, headline and photo,
 *      the original publisher still credited, plus a line naming the other
 *      outlets the research drew on.
 *
 * Once over 300 words the story is indexed again by the same rule, with no
 * other switch. Too few facts, a failed check or a short result leaves the
 * story as it was. Every attempt is logged (a DataSnapshot row) so a story is
 * tried once. Runs from the ingest workflow; nothing here publishes anything
 * new.
 */
import { db } from "@/db";
import { article, dataSnapshot } from "@/db/schema";
import { and, desc, eq, gte, notInArray, ne } from "drizzle-orm";
import { callGemini } from "../ingestion/commentary";
import { RESEARCH_MODEL, factCheckDraft, researchStory } from "./research";
import { MATCH_DATA_SOURCE_NAMES } from "../matchDataSources";
import { ORIGINAL_SOURCE } from "../stories";
import { articleWords } from "../thinContent";
import { articleUrl, submitToIndexNow } from "../indexNow";
import {
  MAX_ENRICH_PER_DAY, MAX_ENRICH_PER_RUN, MAX_ENRICH_RESEARCH_PER_RUN, MIN_ENRICHED_WORDS, MIN_ENRICH_FACTS,
  buildEnrichPrompt, creditLine, enrichedToday, pickCandidates, pruneLog, type EnrichLogEntry, type EnrichResult,
} from "./enrichRules";

const LOG_KEY = "enrich:log";

async function readLog(): Promise<EnrichLogEntry[]> {
  const [row] = await db.select({ data: dataSnapshot.data }).from(dataSnapshot).where(eq(dataSnapshot.key, LOG_KEY)).limit(1);
  return ((row?.data as { entries?: EnrichLogEntry[] } | undefined)?.entries) ?? [];
}

async function writeLog(entries: EnrichLogEntry[]) {
  await db.insert(dataSnapshot).values({ key: LOG_KEY, data: { entries }, sourceUrl: "internal:enrich", fetchedAt: new Date() })
    .onConflictDoUpdate({ target: dataSnapshot.key, set: { data: { entries }, fetchedAt: new Date() } });
}

const ENRICH_SCHEMA = { type: "OBJECT", properties: { paragraphs: { type: "ARRAY", items: { type: "STRING" } } }, required: ["paragraphs"] };

// dryRun: research, write and check as usual, but print the result instead
// of saving anything (no story change, no log, no IndexNow).
export async function enrichTopStories(now: Date = new Date(), opts: { dryRun?: boolean } = {}): Promise<{ enriched: number; note: string }> {
  let log = pruneLog(await readLog(), now);
  const room = Math.min(MAX_ENRICH_PER_RUN, MAX_ENRICH_PER_DAY - enrichedToday(log, now));
  if (room <= 0) return { enriched: 0, note: "daily limit reached" };

  const rows = await db
    .select({
      id: article.id, slug: article.slug, title: article.title, body: article.body, summary: article.summary,
      sourceName: article.sourceName, heroImageUrl: article.heroImageUrl, homeCrestUrl: article.homeCrestUrl,
    })
    .from(article)
    .where(and(
      eq(article.status, "published"),
      ne(article.sourceName, ORIGINAL_SOURCE),
      notInArray(article.sourceName, MATCH_DATA_SOURCE_NAMES),
      gte(article.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
    ))
    .orderBy(desc(article.trendingScore))
    .limit(60);

  let enriched = 0;
  let note = "ok";
  const record = (id: string, result: EnrichResult) => { log = [...log, { id, at: now.toISOString(), result }]; };

  for (const story of pickCandidates(rows, log, MAX_ENRICH_RESEARCH_PER_RUN)) {
    if (enriched >= room) break;
    const text = (story.body?.trim() ? story.body : story.summary).trim();
    const research = await researchStory(story.title, `${story.summary}\n\n${text}`.slice(0, 1500), now);
    // Gemini unavailable: stop without marking, so the story is tried again.
    if (!research) { note = "research unavailable"; break; }
    if (research.facts.length < MIN_ENRICH_FACTS) { record(story.id, "few-facts"); continue; }

    const written = (await callGemini(buildEnrichPrompt({ title: story.title, sourceName: story.sourceName, text, facts: research.facts }), {
      responseSchema: ENRICH_SCHEMA, priority: "high", model: RESEARCH_MODEL, temperature: 0.3, maxOutputTokens: 3072,
    })) as { paragraphs?: string[] } | null;
    const draft = (written?.paragraphs ?? []).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n");
    if (!draft) { note = "writing failed"; break; }

    const checked = await factCheckDraft(research.facts, draft);
    if (!checked) { note = "fact-check unavailable"; break; }
    // The check may return subheadings; a news report is plain paragraphs.
    const body = checked.body.split(/\n\n+/).map((p) => p.replace(/^##\s+/, "")).join("\n\n");
    if (articleWords({ body, summary: null }) < MIN_ENRICHED_WORDS) { record(story.id, "too-short"); continue; }

    const credit = creditLine(research.sources, story.sourceName);
    const finalBody = credit ? `${body}\n\n${credit}` : body;
    if (opts.dryRun) {
      console.log(`\n=== DRY RUN: "${story.title}" (${story.sourceName}), was ${articleWords(story)} words, now ${articleWords({ body: finalBody, summary: null })}; removed by check: ${JSON.stringify(checked.removed)}\n\n${finalBody}\n`);
      enriched++;
      continue;
    }
    await db.update(article).set({ body: finalBody, updatedAt: new Date() }).where(eq(article.id, story.id));
    record(story.id, "enriched");
    enriched++;
    console.log(`Enriched: "${story.title}" (${articleWords({ body: finalBody, summary: null })} words, ${research.facts.length} facts, ${checked.removed.length} removed by the check).`);
    // Indexable now (thinContent.ts): tell search engines it changed.
    await submitToIndexNow([articleUrl(story.slug)]);
  }

  if (!opts.dryRun) await writeLog(log);
  return { enriched, note };
}

if (require.main === module) {
  enrichTopStories(new Date(), { dryRun: process.argv.includes("--dry-run") })
    .then(({ enriched, note }) => {
      console.log(`Enrich top stories: ${enriched} enriched (${note}).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Enrich top stories failed:", err);
      process.exit(1);
    });
}
