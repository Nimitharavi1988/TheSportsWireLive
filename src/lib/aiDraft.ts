/**
 * "Draft with AI" in the story editor (optional): a first draft for a
 * writer to rewrite, check and publish under their own name — never
 * published as it comes. Grounded in data the site already has (the
 * series' fixtures and results, the ground's details, recent stories about
 * the tagged players and teams); anything it needs but doesn't have is left
 * as an [ADD: …] note for the writer, and publishing is blocked until those
 * are gone (lib/stories.ts publishProblems).
 *
 * The same drafts are also made automatically (stories/autoDraft.ts) for the
 * open Story ideas, saved as unpublished drafts for a writer to finish.
 *
 * Same Gemini model and key as the automatic write-ups (commentary.ts), but
 * its own call: that one stops calling for the rest of a run after one
 * failure, which suits a 15-minute batch job, not an editor.
 */
import { MODEL } from "./ingestion/commentary";

export interface DraftFacts {
  brief: string;
  kindLabel: string;
  sportLabel: string;
  seriesLabel: string | null;
  fixtures: string[];
  venues: { name: string; about: string }[];
  people: string[];
  recentStories: { title: string; summary: string; date: string }[];
}

export interface AiDraft {
  title: string;
  summary: string;
  body: string;
  checks: string[];
}

const SHAPE: Record<string, string> = {
  Preview: "what's at stake, form and recent results, the ground and conditions, likely selection questions, what to watch for",
  Analysis: "a lead that states the key question or argument, the evidence from the facts, the counter-view, a clear conclusion",
  Opinion: "a clear argument, reasons backed by the facts, the strongest counter-argument, a firm close",
  Feature: "a strong opening, background, the people and places involved, why it matters now",
  "Match report": "the result up front, how the match turned, standout performances from the facts, then analysis of what it means next",
};

// The prompt (pure, unit-tested).
export function buildDraftPrompt(f: DraftFacts): string {
  const section = (title: string, lines: string[]) => (lines.length ? `${title}:\n${lines.map((l) => `- ${l}`).join("\n")}` : "");
  const facts = [
    section("Fixtures and results", f.fixtures),
    section("Ground", f.venues.map((v) => `${v.name}: ${v.about}`)),
    section("Players and teams in the story", f.people),
    section("Recent coverage (background only; do not copy wording)", f.recentStories.map((s) => `${s.date} — ${s.title}: ${s.summary}`)),
  ].filter(Boolean).join("\n\n");

  return `You are helping a sports writer at Sports Wire Live. Write a FIRST DRAFT that they will rewrite in their own voice, fact-check and publish under their own name.

The writer's brief: ${f.brief}
Kind of piece: ${f.kindLabel} (${SHAPE[f.kindLabel] ?? SHAPE.Analysis})
Sport: ${f.sportLabel}${f.seriesLabel ? `\nSeries or event: ${f.seriesLabel}` : ""}

Facts you may use (the only facts you may state):
${facts || "(none available — keep the draft to structure and questions, using [ADD: …] notes)"}

Rules:
- Use ONLY the facts above. Never invent scores, statistics, quotes, injuries, selections, weather or pitch reports.
- Don't work out facts that aren't stated either — e.g. don't give a series' length from the fixtures listed (more may exist), or a team's form from one result.
- Everything in your own words: never copy or closely paraphrase sentences from the facts (the ground notes come from Wikipedia, the recent coverage from other stories).
- The ground is background: use one or two details that matter to the match, not its history or awards. Focus on the brief.
- Where the piece needs a fact you don't have, write a note in square brackets for the writer, e.g. [ADD: pitch report from the curator] or [ADD: confirmed XI].
- Write it as an editorial, not a wire report: the headline states an angle or asks the real question (e.g. "Why the opening slot is the real selection puzzle"), not just the fixture or a name; open on the point, not the scene; take a position the facts support and say what it means. A viewpoint is fine, an invented fact never is.
- Clear, specific sports-journalism English; vary sentence length; no clichés, no hype, no filler.
- 450-700 words if the facts support it; shorter is better than padding.
- "blocks": the story in order, one paragraph per item; up to three subheadings, each its own item (short, no "##").
- Plain text otherwise: no bold, no bullet lists, no emojis.
- Don't mention AI, prompts or "the facts provided"; don't address the reader as "fans".
- "checks": every fact in your draft the writer should verify before publishing (short phrases).`;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "Headline, under 100 characters, no clickbait" },
    summary: { type: "STRING", description: "One or two sentences, 120-250 characters" },
    // Paragraphs and subheadings as separate items, joined here: a single
    // string sometimes came back with no paragraph breaks at all (a
    // subheading run into the text — seen in testing 2026-09-27).
    blocks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { kind: { type: "STRING", enum: ["paragraph", "subheading"] }, text: { type: "STRING" } },
        required: ["kind", "text"],
      },
    },
    checks: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["title", "summary", "blocks", "checks"],
};

type Block = { kind: "paragraph" | "subheading"; text: string };

// The story text in the editor's format: blank lines between paragraphs,
// "## " subheadings (pure, unit-tested).
export function blocksToBody(blocks: Block[]): string {
  return blocks
    .map((b) => ({ ...b, text: b.text.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim() }))
    .filter((b) => b.text)
    .map((b) => (b.kind === "subheading" ? `## ${b.text}` : b.text))
    .join("\n\n");
}

export class AiDraftError extends Error {}

export async function requestDraft(facts: DraftFacts): Promise<AiDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiDraftError("AI drafting isn't set up on the site yet (GEMINI_API_KEY is missing in Cloudflare).");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildDraftPrompt(facts) }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, temperature: 0.5, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) {
    console.error(`AI draft failed: ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
    throw new AiDraftError(res.status === 402 ? "The Gemini account is out of credit." : res.status === 429 ? "Gemini is busy — try again in a minute." : "The AI draft failed — try again.");
  }
  const data = await res.json();
  const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AiDraftError("The AI returned nothing — try rewording the brief.");
  const draft = JSON.parse(text) as { title?: string; summary?: string; blocks?: Block[]; checks?: string[] };
  const body = blocksToBody(draft.blocks ?? []);
  if (!body) throw new AiDraftError("The AI returned an empty draft — try again.");
  return {
    title: draft.title?.trim() ?? "",
    summary: draft.summary?.trim() ?? "",
    body,
    checks: (draft.checks ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 12),
  };
}
