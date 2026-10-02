// Phase 0 spike for the Spanish site (see PLAN.md): translate ~20 real published
// articles with Gemini and report quality signals + token usage. Read-only: it
// writes nothing to the database. Usage:
//   npx tsx --env-file=.env scripts/spikeTranslate.ts [model] [count]
import { db } from "../src/db";
import { article } from "../src/db/schema";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

const MODEL = process.argv[2] ?? "gemini-flash-lite-latest";
const COUNT = Number(process.argv[3] ?? 20);
const CATEGORIES = ["football", "basketball", "baseball", "american-football", "formula-1", "athletics"];

const PROMPT = (title: string, summary: string, body: string) => `You are a professional sports-news translator. Translate the article below from English into NEUTRAL Spanish for a mixed audience of US Hispanic, Latin American and Spanish readers.

Rules:
- Faithful translation only: do not add, drop, or change any fact, number, score, date, quote or name. Do not summarise.
- Neutral, widely understood Spanish. Avoid regional slang. Use "fútbol" for soccer, "fútbol americano" for the NFL, "béisbol" for baseball, "baloncesto" for basketball.
- Keep names of people, teams, clubs, leagues, venues and competitions as they are normally written (do not translate "Manchester United", "Lakers", etc.).
- Keep the paragraph structure (blank lines) of the body exactly.
- Return JSON with title, summary, body.

TITLE: ${title}

SUMMARY: ${summary}

BODY:
${body}`;

async function translate(title: string, summary: string, body: string) {
  const t0 = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT(title, summary, body) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: { title: { type: "STRING" }, summary: { type: "STRING" }, body: { type: "STRING" } },
          required: ["title", "summary", "body"],
        },
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    }),
  });
  if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 200)}` };
  const j: any = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    return { out: JSON.parse(text) as { title: string; summary: string; body: string }, usage: j.usageMetadata, ms: Date.now() - t0 };
  } catch {
    return { error: `bad JSON (finish=${j.candidates?.[0]?.finishReason})`, usage: j.usageMetadata };
  }
}

// Deterministic checks: every number in the source must survive translation,
// and no long run of common English function words may remain.
function numbers(s: string) {
  return (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", "."));
}
function checks(src: { title: string; summary: string; body: string }, out: { title: string; summary: string; body: string }) {
  const srcNums = new Set(numbers(`${src.title} ${src.summary} ${src.body}`));
  const outNums = new Set(numbers(`${out.title} ${out.summary} ${out.body}`));
  const missing = [...srcNums].filter((n) => !outNums.has(n));
  const english = (out.body.match(/\b(the|and|with|has|have|will|said)\b/gi) ?? []).length;
  const ratio = out.body.length / Math.max(1, src.body.length);
  return { missingNumbers: missing, englishWords: english, lengthRatio: +ratio.toFixed(2) };
}

async function main() {
  const picked: { id: string; category: string; title: string; summary: string; body: string | null }[] = [];
  const per = Math.ceil(COUNT / CATEGORIES.length);
  for (const cat of CATEGORIES) {
    const rows = await db
      .select({ id: article.id, category: article.category, title: article.title, summary: article.summary, body: article.body })
      .from(article)
      .where(and(eq(article.status, "published"), eq(article.category, cat), isNotNull(article.body)))
      .orderBy(desc(article.createdAt))
      .limit(60);
    let n = 0;
    for (const r of rows) {
      if ((r.body ?? "").length < 400 || r.title.startsWith("Preview:")) continue;
      picked.push(r);
      if (++n >= per) break;
    }
  }
  console.log("picked", picked.length, picked.map((p) => p.category).join(","));

  let inTok = 0, outTok = 0, fails = 0, flagged = 0, totalMs = 0;
  for (const r of picked) {
    const src = { title: r.title, summary: r.summary, body: r.body! };
    const res = await translate(src.title, src.summary, src.body);
    if ("error" in res) { fails++; console.log(`FAIL [${r.category}] ${r.title.slice(0, 60)} -> ${res.error}`); continue; }
    inTok += res.usage?.promptTokenCount ?? 0;
    outTok += res.usage?.candidatesTokenCount ?? 0;
    totalMs += res.ms ?? 0;
    const c = checks(src, res.out);
    const bad = c.missingNumbers.length > 0 || c.englishWords > 6 || c.lengthRatio < 0.8 || c.lengthRatio > 1.6;
    if (bad) flagged++;
    console.log(`${bad ? "FLAG" : "ok  "} [${r.category}] ${JSON.stringify(c)}\n  EN: ${src.title}\n  ES: ${res.out.title}\n  ES body: ${res.out.body.slice(0, 220).replace(/\n/g, " ")}...\n`);
  }
  const n = picked.length - fails;
  console.log(`\nmodel=${MODEL} articles=${picked.length} failed=${fails} flagged=${flagged}`);
  console.log(`avg tokens/article: in=${Math.round(inTok / Math.max(1, n))} out=${Math.round(outTok / Math.max(1, n))}; avg latency ${Math.round(totalMs / Math.max(1, n))}ms`);
  process.exit(0);
}
main();
