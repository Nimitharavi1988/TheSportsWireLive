/**
 * The paid review pass for local drafts (2026-10-06). The free models write a
 * draft; a stronger paid Gemini model then reads it against the researched
 * facts, rejects one that contradicts itself or the facts, and corrects small
 * slips by DELETING or repairing the sentence (never adding new facts). Only
 * drafts that pass reach the review page, so a reviewer isn't the one finding
 * "the Raiders have the bye" or "Hutchinson is a linebacker".
 *
 * One call per draft (about 4k tokens in, 2k out: a few cents a day at 5-8
 * drafts). It calls the paid key directly, not the router, so it can't compete
 * with the free slots, and the local script caps how many calls it may make.
 * The key is read from GEMINI_PAID_REVIEW_KEY (the script maps the paid
 * GEMINI_API_KEY into it); without one the pass is simply unavailable.
 */
import { RESEARCH_MODEL } from "./research";

export interface ReviewedText { title: string; summary: string; body: string }
export interface DraftReview {
  verdict: "pass" | "fix" | "reject";
  problems: string[];
  corrected?: ReviewedText;
}

const REVIEW_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["pass", "fix", "reject"] },
    problems: { type: "ARRAY", items: { type: "STRING" } },
    title: { type: "STRING" },
    summary: { type: "STRING" },
    body: { type: "STRING" },
  },
  required: ["verdict", "problems"],
};

export function buildReviewPrompt(draft: ReviewedText, facts: string[]): string {
  return `You are the fact-checking editor of a sports news site. Below are FACTS (the only source of truth) and a DRAFT story written from them. Check the draft hard.

FACTS:
${facts.map((f) => `- ${f}`).join("\n")}

DRAFT
Headline: ${draft.title}
Summary: ${draft.summary}
Body:
${draft.body}

Look for, in this order:
1. Anything the facts do not state: events, numbers, quotes, injuries, records, who plays for whom, a person's role or position (e.g. a defensive end called a linebacker).
2. Contradictions inside the draft or against the facts: scores, leads, records, which team has a bye, who is injured, who played.
3. Judgments of a named person's character, motives or past conduct that the facts don't state and attribute.
4. Outlook filler and unsupported hype (a "statement win", "rout", "collapse" for what the facts show as a close game; "the clock is ticking"), and invented grades or labels with no basis in the facts.

Verdict:
- "pass": none of the above.
- "fix": a few small problems. Return the full corrected headline, summary and body: repair a wrong detail only when the facts state the right one, otherwise DELETE the sentence. Never add any fact that is not in the FACTS. Keep the voice and structure; keep subheadings as lines starting with "## ".
- "reject": the draft contradicts itself or the facts in a way you cannot repair by deleting a sentence or two, or most of it is unsupported.
"problems": each problem found, one short line each (empty for "pass"). Be strict: when unsure whether a claim is in the facts, treat it as unsupported.`;
}

// The model's answer in a safe shape (pure, unit-tested).
export function parseReview(raw: unknown): DraftReview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const verdict = r.verdict;
  if (verdict !== "pass" && verdict !== "fix" && verdict !== "reject") return null;
  const problems = Array.isArray(r.problems) ? r.problems.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim()) : [];
  if (verdict !== "fix") return { verdict, problems };
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const corrected = { title: str(r.title), summary: str(r.summary), body: str(r.body) };
  // A "fix" without all three corrected parts can't be used.
  if (!corrected.title || !corrected.summary || !corrected.body) return null;
  return { verdict, problems, corrected };
}

// The review's outcome for the draft (pure, unit-tested): the text to carry
// on with, or why to drop it.
export function applyReview(original: ReviewedText, review: DraftReview): { ok: true; text: ReviewedText; notes: string[] } | { ok: false; reason: string } {
  if (review.verdict === "reject") return { ok: false, reason: `paid review rejected it: ${review.problems.slice(0, 3).join("; ") || "unsupported claims"}` };
  if (review.verdict === "pass") return { ok: true, text: original, notes: ["Paid review: passed, no problems found."] };
  const corrected = review.corrected!;
  return { ok: true, text: corrected, notes: [`Paid review corrected ${review.problems.length} problem(s):`, ...review.problems.map((p) => `  - ${p}`)] };
}

let paidCalls = 0;
export const paidReviewCalls = () => paidCalls;

export async function paidReviewDraft(draft: ReviewedText, facts: string[]): Promise<DraftReview | null> {
  const key = process.env.GEMINI_PAID_REVIEW_KEY;
  if (!key) return null;
  paidCalls++;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${RESEARCH_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildReviewPrompt(draft, facts) }] }],
        generationConfig: {
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: REVIEW_SCHEMA,
          temperature: 0,
          maxOutputTokens: 4096,
        },
      }),
    });
    if (!res.ok) {
      console.error(`Paid review failed: ${res.status} ${(await res.text().catch(() => "")).slice(0, 160)}`);
      return null;
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? parseReview(JSON.parse(text)) : null;
  } catch (err) {
    console.error("Paid review error:", err);
    return null;
  }
}
