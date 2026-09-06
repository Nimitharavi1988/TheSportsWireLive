/**
 * Original commentary generation for RSS-sourced news, using Google Gemini's
 * free API tier. The source's own text (sourceSnippet) is used ONLY as
 * grounding input here — never stored or displayed as-is — to avoid
 * republishing the publisher's copyrighted prose (see rssFeeds.ts). The
 * model is instructed to write brief original commentary in its own words,
 * using only the given facts, with no invented details.
 *
 * Docs: https://ai.google.dev/gemini-api/docs
 * Free tier: no credit card required, rate-limited (see Google AI Studio).
 */

const MODEL = "gemini-flash-latest";

function buildPrompt(title: string, sourceSnippet: string, sourceName: string): string {
  return `You are writing a brief original news blurb for a sports aggregator site, based on a report from ${sourceName}.

Headline: "${title}"

Facts from the source report (for reference only — do not copy any phrase or sentence from this text):
"""
${sourceSnippet}
"""

Write a fuller original blurb (aim for 2 short paragraphs, roughly 5-8 sentences total when the facts support it) covering every concrete fact given above — names, numbers, results, context — in your own words and sentence structure. Rules:
- Never copy phrasing verbatim or near-verbatim from the facts above — use entirely your own wording and sentence structure throughout.
- Never invent any fact, statistic, quote, or detail not present in the facts above. Do not pad length with generic filler, speculation, or restating the same fact twice — only expand as far as the real facts given actually go.
- If the facts above are too thin to fill that length without inventing or repeating, write a shorter piece instead — brevity is always better than padding.
- Do not mention that you were given source material or instructions — just write the blurb itself.
- Plain text only, no markdown.

Also list the real, named individuals (athletes, coaches, or officials) this story is centrally about — not team names, and not any journalist, reporter, or pundit merely cited as the source of the report. Order them by prominence to the story (most central first), fullest real name as it would appear as a Wikipedia article title (e.g. "Ben Stokes", not "Stokes" or "the England captain"). Include more than one only when multiple people are genuinely co-central (e.g. a batter and a bowler both credited for a result) — don't pad the list with minor mentions. If no specific named athlete/coach/official is truly central, leave personNames empty.`;
}

export interface CommentaryResult {
  commentary: string | null;
  personNames: string[];
}

const EMPTY_RESULT: CommentaryResult = { commentary: null, personNames: [] };

export async function generateCommentary(
  title: string,
  sourceSnippet: string | undefined,
  sourceName: string
): Promise<CommentaryResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !sourceSnippet || sourceSnippet.trim().length < 20) {
    return EMPTY_RESULT;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(title, sourceSnippet, sourceName) }] }],
          generationConfig: {
            // Disable "thinking" — this is a short factual summarization
            // task, not reasoning-heavy, and thinking tokens add real
            // cost/quota use for no benefit here.
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                commentary: { type: "STRING" },
                personNames: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["commentary", "personNames"],
            },
          },
        }),
      }
    );

    if (!res.ok) {
      console.error(`Gemini commentary generation failed: ${res.status}`);
      return EMPTY_RESULT;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return EMPTY_RESULT;

    const parsed = JSON.parse(text);
    const commentary = typeof parsed.commentary === "string" ? parsed.commentary.trim() : "";
    const personNames: string[] = Array.isArray(parsed.personNames)
      ? parsed.personNames
          .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0)
          .map((n: string) => n.trim())
      : [];
    return { commentary: commentary || null, personNames };
  } catch (err) {
    console.error("Gemini commentary generation error:", err);
    return EMPTY_RESULT;
  }
}
