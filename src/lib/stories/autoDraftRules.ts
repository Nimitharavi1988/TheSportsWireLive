/** Pure rules for automatic drafts (autoDraft.ts): limits, picking, checks. */
import type { StoryIdea } from "../storyIdeas";
import type { AiDraft } from "../aiDraft";
import type { DraftFormat } from "../aiDraft";
import type { PhotoResult } from "../photoSearch";
import { STORY_LIMITS } from "../stories";
import { articleWords } from "../thinContent";
import { MIN_ENRICHED_WORDS, isRepetitive, mentionsItsInputs } from "./enrichRules";

// Few and good (2026-10-04, was 2 a run / 6 a day): each draft now costs a
// web-research and a fact-check call, and a pile of AI drafts is exactly the
// "scaled content" AdSense rejects. One per run spreads them over the day.
export const MAX_DRAFTS_PER_RUN = 1;
export const MAX_DRAFTS_PER_DAY = 3;
// Ideas researched per run, drafted or not (each is a search call).
export const MAX_RESEARCH_PER_RUN = 3;
// Below this many researched facts there isn't enough for a real piece.
export const MIN_WEB_FACTS = 5;

// Who a draft is suggested to, by sport: the writers' beats as of 2026-10-04.
// Only a suggestion, shown as a note: the byline goes on when that writer has
// read and approved the piece, never automatically.
export const WRITER_BEATS: Record<string, string> = {
  football: "Pavana",
  cricket: "Robin",
  baseball: "Renjini",
  "american-football": "Vinaya",
  "college-football": "Vinaya",
  athletics: "Abhinav Earnest",
};
export const DEFAULT_WRITER = "Abhinav Earnest";

export function suggestedWriter(sport: string): string {
  return WRITER_BEATS[sport] ?? DEFAULT_WRITER;
}

// The formats that suit each kind of idea; one is picked at random so the
// drafts don't all read alike (pure given rnd, unit-tested).
const FORMATS_BY_KIND: Record<string, DraftFormat[]> = {
  preview: ["feature", "qa", "numbers"],
  report: ["takeaways", "numbers", "feature", "reportCard"],
  trend: ["qa", "feature", "takeaways"],
};
export function pickFormat(ideaKind: string, rnd: number = Math.random()): DraftFormat {
  const options = FORMATS_BY_KIND[ideaKind] ?? FORMATS_BY_KIND.trend;
  return options[Math.min(options.length - 1, Math.floor(rnd * options.length))];
}

// A suggested photo must name the subject in its title, so a search for
// "Shubman Gill" can't attach a stadium crowd or another player (pure,
// unit-tested). Matched on the surname, the part file names always carry.
export function pickPhoto(results: PhotoResult[], subject: string): PhotoResult | null {
  const surname = subject.trim().split(/\s+/).pop()?.toLowerCase();
  if (!surname || surname.length < 3) return null;
  return results.find((r) => r.title.toLowerCase().includes(surname)) ?? null;
}

// Notes for the editor at the end of the draft, each kept as a [CHECK: …]
// line so the story can't be published until they're read and deleted.
export function editorNotes(n: { writer: string; sources: string[]; removed: number; photoSubject: string | null }): string[] {
  return [
    `Suggested writer: ${n.writer}. Put their byline on only after they have read and approved this draft.`,
    ...(n.photoSubject ? [`Photo picked automatically: check it shows ${n.photoSubject}, or choose another with Find a photo.`] : []),
    ...(n.removed > 0 ? [`The automatic fact-check removed or corrected ${n.removed} claim${n.removed === 1 ? "" : "s"} the research didn't support.`] : []),
    ...(n.sources.length > 0 ? [`Researched from: ${n.sources.join(", ")}.`] : []),
  ];
}
// Drafts nobody has opened yet: when the queue is this long, stop adding.
export const MAX_UNREVIEWED = 8;
// More gaps than this and the model had too little to go on.
export const MAX_ADD_NOTES = 4;

// One idea per kind in turn (trend, report, preview), so a run's few drafts
// aren't all the same kind. Each kind keeps its own order (pure, unit-tested).
export function pickIdeas(ideas: StoryIdea[], n: number): StoryIdea[] {
  const lanes = (["trend", "report", "preview"] as const).map((k) => ideas.filter((i) => i.kind === k));
  const picked: StoryIdea[] = [];
  for (let round = 0; picked.length < n; round++) {
    const row = lanes.map((l) => l[round]).filter(Boolean);
    if (row.length === 0) break;
    picked.push(...row.slice(0, n - picked.length));
  }
  return picked;
}

// The draft as stored: the facts to verify go in as [CHECK: …] paragraphs at
// the end, which publishProblems refuses to publish until they're deleted
// (pure, unit-tested).
export function draftBodyWithChecks(draft: Pick<AiDraft, "body" | "checks">): string {
  const checks = draft.checks.map((c) => `[CHECK: ${c.replace(/[\[\]]/g, "")}]`);
  return [draft.body, ...checks].join("\n\n");
}

// Review-pack drafts (the local draft script, 2026-10-06): the story text is
// saved CLEAN, with no [ADD]/[CHECK] notes in it, so a reviewer reads it, reads
// the pack beside it and approves, with no editing. A draft that still has a
// gap or a note in the text is not saved (pure, unit-tested).
export function cleanDraftProblem(draft: AiDraft): string | null {
  const base = draftProblem(draft);
  if (base) return base;
  // A story written here is always indexed (thinContent.ts exempts originals),
  // so a short one would be a thin indexed page: it needs the same bar as an
  // enriched report.
  if (articleWords({ body: draft.body, summary: null }) < MIN_ENRICHED_WORDS) return "under the length bar";
  if (mentionsItsInputs(draft.body)) return "talks about its own inputs";
  if (isRepetitive(draft.body)) return "repetitive prose";
  if (/\[(ADD|CHECK)\b/i.test(`${draft.title} ${draft.summary} ${draft.body}`)) return "has notes or gaps in the text";
  return null;
}

// What the reviewer sees beside a clean draft (stored as a DataSnapshot row
// "draft:review:<id>", shown on /admin/stories/review).
export interface ReviewPack {
  writer: string;
  format: string;
  kind: string;
  sport: string;
  sources: string[];
  facts: string[];
  checks: string[];
  removed: number;
  photoSubject: string | null;
  createdAt: string;
}
export const reviewPackKey = (articleId: string) => `draft:review:${articleId}`;

// Whether a draft is worth a writer's time (pure, unit-tested).
export function draftProblem(draft: AiDraft): string | null {
  if (draft.title.length < STORY_LIMITS.title.min || draft.title.length > STORY_LIMITS.title.max) return "headline length";
  if (draft.summary.length < STORY_LIMITS.summary.min || draft.summary.length > STORY_LIMITS.summary.max) return "summary length";
  if (draft.body.length < STORY_LIMITS.body.min) return "too short";
  if ((draft.body.match(/\[ADD\b/gi) ?? []).length > MAX_ADD_NOTES) return "too many gaps";
  return null;
}
