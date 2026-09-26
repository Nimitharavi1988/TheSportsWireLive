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

// Lite tier — confirmed live (2026-09-19) resolves to gemini-3.5-flash-lite,
// at a fraction of the standard Flash tier's per-token cost (Flash-Lite is
// roughly 6x cheaper on input and 12x cheaper on output per Google's current
// pricing). Same "-latest" auto-tracking alias pattern as before, just the
// lite family instead of the standard one — every call here is short
// factual summarization/translation grounded in given facts, not open-ended
// reasoning, which is exactly the workload the lite tier is designed for.
const MODEL = "gemini-flash-lite-latest";

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
- If the facts above contain no real, substantive, reportable information at all — no actual score, statement, decision, or specific development, just a bare name/place/headline restated — do not paper over that gap with vague hedge sentences ("X has been highlighted in recent coverage", "no further details were provided"), vague hype language that sounds exciting but conveys nothing concrete ("action is underway", "immediate fireworks", "explosive start", "set an early tone", "off to a flying start"), OR self-referential sentences that describe the existence of coverage instead of the actual event ("MLB.com has published an analytical breakdown of Gerrit Cole's pitching arsenal", "The feature examines the mechanics behind the blast", "This analysis centers on..."). That last pattern is especially common when the source is a short video-clip title (e.g. "Breaking down X's pitches", "Field View: Y homers") with no real substance behind the headline — describing that a breakdown/analysis/feature exists is not the same as reporting a fact, even though it reads grammatically like a real sentence. A reader must learn at least one real, specific, checkable fact from every sentence you write — if you can't do that because the facts above genuinely don't contain one, return an empty commentary instead. An honest empty result is always better than a sentence that merely sounds like news.
- Separate paragraphs with a literal blank line (two newlines) — never return the whole thing as one unbroken block.
- Do not mention that you were given source material or instructions — just write the blurb itself.
- Plain text only, no markdown.

Also list the real, named individuals (athletes, coaches, or officials) this story is centrally about — not team names, and not any journalist, reporter, or pundit merely cited as the source of the report. Order them by prominence to the story (most central first), fullest real name as it would appear as a Wikipedia article title (e.g. "Ben Stokes", not "Stokes" or "the England captain"). Include more than one only when multiple people are genuinely co-central (e.g. a batter and a bowler both credited for a result) — don't pad the list with minor mentions. If no specific named athlete/coach/official is truly central, leave personNames empty.

Also extract the real-world venue/stadium name (e.g. "Old Trafford", "Lord's", "the MCG") ONLY if the facts above genuinely state where this happened — never guess, infer from the teams/competition, or fill in a team's usual home ground. If no venue is explicitly stated in the facts, leave venue empty.`;
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
- Separate paragraphs with a literal blank line (two newlines) — never return the whole thing as one unbroken block.
- Do not mention that you were given source material or instructions, and do not repeat the headline verbatim at the top — just write the recap itself.
- Plain text only, no markdown.`;
}

interface GeminiCallOptions {
  responseSchema: object;
}

// Set when Gemini says it can't serve requests at all (out of credits,
// rate-limited, auth or server errors) — as opposed to answering and
// producing nothing usable. Callers use it to leave stories waiting
// instead of rejecting them (confirmed 2026-09-26: prepaid credits ran out,
// every call returned 402, and every story was rejected as if the model
// had declined it). Once set, further calls in this run are skipped.
let unavailable: string | null = null;

export function aiUnavailableReason(): string | null {
  return unavailable;
}

const UNAVAILABLE_STATUSES = new Set([401, 402, 403, 429, 500, 502, 503, 504]);

async function callGemini(prompt: string, options: GeminiCallOptions): Promise<any | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    unavailable = "AI not configured (GEMINI_API_KEY unset)";
    return null;
  }
  if (unavailable) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            // No thinkingConfig override — confirmed live (2026-09-19) that
            // gemini-flash-lite-latest (gemini-3.5-flash-lite) rejects
            // thinkingBudget: 0 outright (400 INVALID_ARGUMENT), unlike the
            // standard Flash tier this used to target. usageMetadata on this
            // model shows no separate hidden reasoning-token cost anyway
            // (totalTokenCount == promptTokenCount + candidatesTokenCount in
            // every test call), so there's nothing to disable here.
            responseMimeType: "application/json",
            responseSchema: options.responseSchema,
            // Low, not zero — a little variation keeps prose from feeling
            // templated across near-identical stories, but the whole point
            // of every prompt here is "stay faithful to the given facts,
            // never invent," so a high-creativity default fights that goal.
            // Free to set, no cost impact either way.
            temperature: 0.3,
            // Every prompt here asks for a couple short paragraphs at most —
            // this caps worst-case cost on an occasional runaway response
            // rather than silently paying for output nobody wants.
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`Gemini generation failed: ${res.status} ${detail.slice(0, 200)}`);
      if (UNAVAILABLE_STATUSES.has(res.status)) {
        unavailable = res.status === 402 ? "AI unavailable (402: credits depleted)" : `AI unavailable (HTTP ${res.status})`;
      }
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
  // Real venue/stadium name, only when genuinely stated in the source
  // text — never inferred from the teams/competition. Extracted from the
  // same Gemini call rather than a separate one, since the model is
  // already reading the full grounded text here. Powers SportsEvent
  // JSON-LD's "location" field (see article/[slug]/page.tsx) for
  // editorial/RSS match reports, extending real venue coverage beyond the
  // structured match-data sources (CricketData.org/ESPN NFL).
  venue: string | null;
}

const EMPTY_RESULT: CommentaryResult = { commentary: null, personNames: [], venue: null };

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
        venue: { type: "STRING" },
      },
      required: ["commentary", "personNames", "venue"],
    },
  });
  if (!parsed) return EMPTY_RESULT;

  const commentary = typeof parsed.commentary === "string" ? parsed.commentary.trim() : "";
  const personNames: string[] = Array.isArray(parsed.personNames)
    ? parsed.personNames
        .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0)
        .map((n: string) => n.trim())
    : [];
  const venue = typeof parsed.venue === "string" && parsed.venue.trim().length > 0 ? parsed.venue.trim() : null;
  return { commentary: commentary || null, personNames, venue };
}

// buildRssPrompt above already instructs the model to self-police vagueness
// in the same generation pass ("if you can't [state a real, specific,
// checkable fact], return an empty commentary instead") -- confirmed live
// 2026-09-20 that it doesn't reliably follow that instruction: a real
// published example ("During the recent match, Manchester City secured a
// high-scoring moment when Erling Haaland successfully converted from close
// range at the far post...") named no opponent, no score, nothing
// checkable, despite the rule. Asking a model to generate prose and
// critically self-assess it in the same autoregressive pass is weaker than
// a second, narrowly-scoped verification call -- this is that second call.
// Deliberately NOT folded into generateCommentary's own response schema for
// the same reason: a self-reported "hasSubstance: true" field returned
// alongside text the model just committed to writing has the identical
// self-assessment weakness this exists to avoid.
function buildSubstanceCheckPrompt(title: string, commentary: string): string {
  return `Headline: "${title}"

Text to check:
"""
${commentary}
"""

Does the text above contain at least one specific, checkable fact (a number, a named individual beyond who's already in the headline, a direct quote, or a concrete result/decision) that a reader couldn't already have guessed from the headline alone? Answer strictly based on the text given -- a sentence that merely restates the headline in different words, or reads as exciting but conveys nothing concrete, does not count.`;
}

export async function verifyCommentaryHasSubstance(title: string, commentary: string): Promise<boolean> {
  const parsed = await callGemini(buildSubstanceCheckPrompt(title, commentary), {
    responseSchema: {
      type: "OBJECT",
      properties: { hasSubstance: { type: "BOOLEAN" } },
      required: ["hasSubstance"],
    },
  });
  // Fail open (treat as substantive) on a Gemini hiccup -- this check
  // narrows an already-generated, already-accepted-by-the-first-pass
  // commentary; a verification-call outage should never itself cause a
  // real, possibly-fine article to be rejected. Only an explicit `false`
  // from a successful check rejects.
  if (!parsed) return true;
  return parsed.hasSubstance !== false;
}

// Explicit-request caption upgrade (2026-09-22), replacing the previous
// mechanical "hook + truncated body" caption assembly in facebook.ts/
// instagram.ts. Deliberately does NOT generate hashtags here — those come
// from hashtagRepertoire.ts's deterministic, signal-based selection
// (category/title-text/player matches), not the model's judgment, so a tag
// can never be attached to an article it doesn't actually apply to. One
// call produces both platform captions together (cheaper than two calls,
// and keeps the two versions consistent with the same underlying facts).
function buildSocialCaptionsPrompt(title: string, body: string): string {
  return `You are an expert sports social media manager. Write two captions for the same story, one for Facebook and one for Instagram, following these platform rules exactly.

Headline: "${title}"

Facts (the ONLY source of information you may use — never invent a detail, quote, or statistic not stated here):
"""
${body}
"""

FACEBOOK caption:
- Punchy, professional, engaging — 2-4 short sentences.
- End with a clear call to action telling readers to click the link to read more (your own wording, doesn't need to be verbatim).
- Do not include any hashtags — those are added separately.
- Do not repeat the headline verbatim at the top.

INSTAGRAM caption:
- Longer than the Facebook version, with a captivating hook as the very first sentence.
- Use 1-3 emojis as visual breaks between short paragraphs (not decorative clutter — each one should mark a real break in the text).
- End with a call to action telling readers to click the link in the bio to read the full story (your own wording).
- Do not include any hashtags — those are added separately.
- Do not repeat the headline verbatim at the top.

Both captions must stay strictly true to the facts given above — no invented details, no speculation stated as fact. Plain text only, no markdown.`;
}

export interface SocialCaptions {
  facebook: string;
  instagram: string;
}

export async function generateSocialCaptions(title: string, body: string): Promise<SocialCaptions | null> {
  if (!body || body.trim().length < 40) return null;

  const parsed = await callGemini(buildSocialCaptionsPrompt(title, body), {
    responseSchema: {
      type: "OBJECT",
      properties: {
        facebookCaption: { type: "STRING" },
        instagramCaption: { type: "STRING" },
      },
      required: ["facebookCaption", "instagramCaption"],
    },
  });
  if (!parsed) return null;

  const facebook = typeof parsed.facebookCaption === "string" ? parsed.facebookCaption.trim() : "";
  const instagram = typeof parsed.instagramCaption === "string" ? parsed.instagramCaption.trim() : "";
  if (!facebook || !instagram) return null;

  return { facebook, instagram };
}

function buildPosterPrompt(title: string, body: string): string {
  return `You are writing the on-image copy for a single sports-news Instagram poster (bold cover graphic, not the caption).

Headline: "${title}"

Full article text (the ONLY source of facts you may use):
"""
${body}
"""

Produce:
- eyebrow: a short all-caps category/context label, 2-4 words (e.g. "MANCHESTER DERBY", "TRANSFER NEWS", "MATCH REPORT"). No punctuation.
- hook: a bold, attention-grabbing headline for the poster, under 10 words, that is strictly true to the article — dramatic phrasing is fine, but never state anything not actually supported by the text. Do not use clickbait that misrepresents the facts (e.g. don't imply a twist that didn't happen).
- rows: 3 to 5 short label/value pairs, a quick-read fact summary of the story (e.g. score, key name, key stat, outcome) — every value must be a real fact stated in the article text above, never invented or estimated. label is 1-3 words, value is under 8 words. Fewer, real rows are better than padding with invented or vague ones.

If the article doesn't contain enough concrete facts for at least 3 real rows, return fewer rows rather than inventing any.`;
}

export interface PosterContent {
  eyebrow: string;
  hook: string;
  rows: { label: string; value: string }[];
}

// Bespoke per-article poster copy (bold hook headline + a quick-read fact
// table) for the Instagram poster format — see instagramPoster.tsx for the
// actual image rendering. Grounded strictly in the article's own text, same
// no-invented-facts policy as generateCommentary/generateMatchRecap above.
export async function generatePosterContent(title: string, body: string): Promise<PosterContent | null> {
  if (!body || body.trim().length < 40) return null;

  const parsed = await callGemini(buildPosterPrompt(title, body), {
    responseSchema: {
      type: "OBJECT",
      properties: {
        eyebrow: { type: "STRING" },
        hook: { type: "STRING" },
        rows: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { label: { type: "STRING" }, value: { type: "STRING" } },
            required: ["label", "value"],
          },
        },
      },
      required: ["eyebrow", "hook", "rows"],
    },
  });
  if (!parsed) return null;

  const eyebrow = typeof parsed.eyebrow === "string" ? parsed.eyebrow.trim() : "";
  const hook = typeof parsed.hook === "string" ? parsed.hook.trim() : "";
  const rows = Array.isArray(parsed.rows)
    ? parsed.rows
        .filter((r: any) => typeof r?.label === "string" && typeof r?.value === "string" && r.label.trim() && r.value.trim())
        .map((r: any) => ({ label: r.label.trim(), value: r.value.trim() }))
        .slice(0, 5)
    : [];

  if (!hook || rows.length < 3) return null;
  return { eyebrow: eyebrow || "SPORTS NEWS", hook, rows };
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
