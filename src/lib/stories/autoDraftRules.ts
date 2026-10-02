/** Pure rules for automatic drafts (autoDraft.ts): limits, picking, checks. */
import type { StoryIdea } from "../storyIdeas";
import type { AiDraft } from "../aiDraft";
import { STORY_LIMITS } from "../stories";

export const MAX_DRAFTS_PER_RUN = 2;
export const MAX_DRAFTS_PER_DAY = 6;
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

// Whether a draft is worth a writer's time (pure, unit-tested).
export function draftProblem(draft: AiDraft): string | null {
  if (draft.title.length < STORY_LIMITS.title.min || draft.title.length > STORY_LIMITS.title.max) return "headline length";
  if (draft.summary.length < STORY_LIMITS.summary.min || draft.summary.length > STORY_LIMITS.summary.max) return "summary length";
  if (draft.body.length < STORY_LIMITS.body.min) return "too short";
  if ((draft.body.match(/\[ADD\b/gi) ?? []).length > MAX_ADD_NOTES) return "too many gaps";
  return null;
}
