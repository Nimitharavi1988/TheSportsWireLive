/**
 * Original commentary generation using Google Gemini's free API tier, for
 * two distinct input shapes:
 *  - RSS-sourced news: the source's own text (sourceSnippet) is used ONLY as
 *    grounding input — never stored or displayed as-is — to avoid
 *    republishing the publisher's copyrighted prose (see rssFeeds.ts).
 *  - Structured match data (football-data.org / CricketData.org): our own
 *    factual data (score, competition, standings context), not another
 *    publisher's article, expanded from a bare template into real prose.
 * In both cases the model is instructed to write in its own words, using
 * only the given facts, with no invented details.
 *
 * Docs: https://ai.google.dev/gemini-api/docs
 * Free tier: no credit card required, rate-limited (see Google AI Studio).
 */

const MODEL = "gemini-flash-latest";

function buildRssPrompt(title: string, sourceSnippet: string, sourceName: string): string {
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

function buildMatchPrompt(title: string, factsText: string, competitionName: string): string {
  return `You are writing a short match recap for a sports news site. This is NOT another publisher's article — it's our own structured match data, and you're expanding it into real prose.

Match: "${title}"
Competition: ${competitionName}

Facts (from our own match data — this is the complete set of facts available, nothing else is known about this match):
"""
${factsText}
"""

Write a short, original recap (roughly 4-7 sentences, 2 short paragraphs at most) covering the facts above — result or fixture details, competition context, league standing/form where given — in natural sports-journalism prose. Rules:
- Use ONLY the facts given above. Never invent goalscorers, assists, cards, injuries, lineups, or any other detail not present in the facts — we deliberately don't have play-by-play data at this tier, so do not fabricate it.
- Vary sentence structure and wording rather than restating the facts in the same order and phrasing they're given in.
- If the facts are too thin to fill that length without inventing or repeating, write a shorter piece instead — brevity is always better than padding or fabrication.
- Do not mention that you were given source material or instructions, and do not repeat the headline verbatim at the top — just write the recap itself.
- Plain text only, no markdown.`;
}

interface GeminiCallOptions {
  responseSchema: object;
}

async function callGemini(prompt: string, options: GeminiCallOptions): Promise<any | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            // Disable "thinking" — this is a short factual summarization
            // task, not reasoning-heavy, and thinking tokens add real
            // cost/quota use for no benefit here.
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: "application/json",
            responseSchema: options.responseSchema,
          },
        }),
      }
    );

    if (!res.ok) {
      console.error(`Gemini generation failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini generation error:", err);
    return null;
  }
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
  if (!sourceSnippet || sourceSnippet.trim().length < 20) return EMPTY_RESULT;

  const parsed = await callGemini(buildRssPrompt(title, sourceSnippet, sourceName), {
    responseSchema: {
      type: "OBJECT",
      properties: {
        commentary: { type: "STRING" },
        personNames: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: ["commentary", "personNames"],
    },
  });
  if (!parsed) return EMPTY_RESULT;

  const commentary = typeof parsed.commentary === "string" ? parsed.commentary.trim() : "";
  const personNames: string[] = Array.isArray(parsed.personNames)
    ? parsed.personNames
        .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0)
        .map((n: string) => n.trim())
    : [];
  return { commentary: commentary || null, personNames };
}

// Expands a match-data template (score/fixture + standings context, already
// built from football-data.org/CricketData.org's structured data — see
// footballData.ts/cricketData.ts) into a proper recap, instead of leaving
// match articles as a bare one- or two-sentence template forever.
export async function generateMatchRecap(
  title: string,
  factsText: string,
  competitionName: string
): Promise<string | null> {
  if (!factsText || factsText.trim().length < 20) return null;

  const parsed = await callGemini(buildMatchPrompt(title, factsText, competitionName), {
    responseSchema: {
      type: "OBJECT",
      properties: { recap: { type: "STRING" } },
      required: ["recap"],
    },
  });
  if (!parsed) return null;

  const recap = typeof parsed.recap === "string" ? parsed.recap.trim() : "";
  return recap || null;
}
