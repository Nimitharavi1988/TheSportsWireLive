/**
 * Quality audit of the site's routine news write-ups (2026-10-06): did the move
 * to free AI models (the router, switched on about 2026-10-05 00:30 UTC) make
 * the write-ups worse? Read-only: nothing is changed.
 *
 *   npx tsx scripts/newsQualityAudit.ts
 *   options: --sample N (30)  stories per cohort judged by the paid model
 *            --auto N (400)   stories per cohort for the automatic checks
 *            --no-judge       automatic checks only (no paid calls)
 *            --env path/to/.dev.vars
 *
 * Two cohorts are compared:
 *   BEFORE: written 2026-10-04 00:00-24:00 UTC (paid Gemini, no router)
 *   AFTER:  written in the last 24 hours (free models via the router)
 *
 * Automatic checks (all of the sample): words, endings cut off, [ADD]/[CHECK]
 * notes, talk about "the provided facts", repeated sentence openings, figures of
 * 3+ digits that are in neither the headline nor the source snippet, and the
 * share of the body that is copied from the snippet.
 * Paid judge (a few cents): a Gemini model scores each sampled write-up for
 * faithfulness to the source PAGE (re-fetched, as the writer saw it) from 1 to 5
 * and lists unsupported claims. The key (GEMINI_API_KEY) is used only for that.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function envFile(): string | null {
  const i = process.argv.indexOf("--env");
  const candidates = [i >= 0 ? process.argv[i + 1] : "", ".dev.vars", resolve("..", "TheSportsWireLive", ".dev.vars")].filter(Boolean);
  return candidates.map((p) => resolve(p)).find((p) => existsSync(p)) ?? null;
}
function num(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

interface Row { id: string; title: string; summary: string; body: string; sourceName: string; sourceUrl: string; createdAt: Date }
interface Metrics { n: number; words: number; short: number; cut: number; notes: number; leaks: number; repetitive: number; ungrounded: number; copied: number }
interface Judged { title: string; score: number; unsupported: string[]; problems: string[] }
interface Skipped { noSource: number; junkSource: number }

const pct = (a: number, n: number) => (n ? `${Math.round((100 * a) / n)}%` : "-");

async function main() {
  const file = envFile();
  if (!file) { console.error("No .dev.vars found. Pass --env <path>."); process.exit(1); }
  let paidKey = "";
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!m) continue;
    const v = m[2].trim().replace(/^"|"$/g, "");
    if (m[1] === "DATABASE_URL") process.env.DATABASE_URL = v;
    if (m[1] === "GEMINI_API_KEY") paidKey = v;
  }
  const judge = !process.argv.includes("--no-judge") && !!paidKey;
  const autoN = num("auto", 400);
  const sampleN = num("sample", 30);

  const { sql } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { mentionsItsInputs, isRepetitive } = await import("../src/lib/stories/enrichRules");
  const { ungroundedNumbers } = await import("../src/lib/llm/grounding");
  const { extractArticleContent } = await import("../src/lib/ingestion/articleTextExtractor");
  const { MATCH_DATA_SOURCE_NAMES } = await import("../src/lib/matchDataSources");

  const matchList = sql.join(MATCH_DATA_SOURCE_NAMES.map((n: string) => sql`${n}`), sql`, `);
  const fetchCohort = async (from: string, to: string): Promise<Row[]> => {
    const r = await db.execute(sql`select id, title, summary, body, "sourceName", "sourceUrl", "createdAt" from "Article"
      where body is not null and length(body) > 80 and status in ('published','pending_review')
        and "sourceName" <> 'Sports Wire Live' and "sourceName" not in (${matchList})
        and body not like '%This report also draws on coverage%'
        and "createdAt" >= ${from}::timestamp and "createdAt" < ${to}::timestamp
      order by random() limit ${autoN}`);
    return r.rows as unknown as Row[];
  };
  const now = new Date();
  const iso = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);
  const before = await fetchCohort("2026-10-04 00:00:00", "2026-10-05 00:00:00");
  const after = await fetchCohort(iso(new Date(now.getTime() - 24 * 3600e3)), iso(now));

  const measure = (rows: Row[]): { m: Metrics; flagged: { title: string; why: string[] }[] } => {
    const m: Metrics = { n: rows.length, words: 0, short: 0, cut: 0, notes: 0, leaks: 0, repetitive: 0, ungrounded: 0, copied: 0 };
    const flagged: { title: string; why: string[] }[] = [];
    for (const r of rows) {
      const words = r.body.trim().split(/\s+/).length;
      m.words += words;
      const why: string[] = [];
      if (words < 60) { m.short++; why.push(`short (${words} words)`); }
      if (!/[.!?"”’)]\s*$/.test(r.body.trim())) { m.cut++; why.push("ends mid-sentence"); }
      if (/\[(ADD|CHECK)\b/i.test(r.body)) { m.notes++; why.push("has [ADD]/[CHECK] notes"); }
      if (mentionsItsInputs(r.body)) { m.leaks++; why.push("talks about its inputs"); }
      if (isRepetitive(r.body)) { m.repetitive++; why.push("repetitive"); }
      const bad = ungroundedNumbers(r.body, `${r.title}\n${r.summary}`);
      if (bad.length) { m.ungrounded++; why.push(`figures not in headline/snippet: ${bad.slice(0, 3).join(", ")}`); }
      const sum = r.summary.trim();
      if (sum.length > 80 && r.body.includes(sum.slice(0, 80))) { m.copied++; why.push("copies the snippet"); }
      if (why.length) flagged.push({ title: r.title, why });
    }
    return { m, flagged };
  };
  const a = measure(before);
  const b = measure(after);

  const row = (label: string, f: (m: Metrics) => string) => console.log(`${label.padEnd(44)} ${f(a.m).padStart(10)} ${f(b.m).padStart(10)}`);
  console.log(`\nAUTOMATIC CHECKS (random samples)           BEFORE (Oct 4)  AFTER (last 24h)`);
  console.log(`Write-ups checked`.padEnd(44), String(a.m.n).padStart(10), String(b.m.n).padStart(10));
  row("Average length (words)", (m) => String(m.n ? Math.round(m.words / m.n) : 0));
  row("Under 60 words", (m) => pct(m.short, m.n));
  row("Ends mid-sentence", (m) => pct(m.cut, m.n));
  row("Has [ADD]/[CHECK] notes", (m) => pct(m.notes, m.n));
  row("Talks about its inputs", (m) => pct(m.leaks, m.n));
  row("Repetitive prose", (m) => pct(m.repetitive, m.n));
  row("Figures not in headline/snippet", (m) => pct(m.ungrounded, m.n));
  row("Copies the snippet", (m) => pct(m.copied, m.n));

  const worst = (label: string, flagged: { title: string; why: string[] }[]) => {
    console.log(`\n${label}: ${flagged.length} flagged; first 6:`);
    for (const f of flagged.slice(0, 6)) console.log(`  - ${f.title.slice(0, 80)} [${f.why.join("; ")}]`);
  };
  worst("BEFORE", a.flagged);
  worst("AFTER", b.flagged);

  if (judge) {
    const { RESEARCH_MODEL } = await import("../src/lib/stories/research");
    const schema = {
      type: "OBJECT",
      properties: { score: { type: "INTEGER" }, unsupported: { type: "ARRAY", items: { type: "STRING" } }, problems: { type: "ARRAY", items: { type: "STRING" } } },
      required: ["score", "unsupported", "problems"],
    };
    // Why a story could not be judged fairly: no readable source now, or a page
    // that is mostly navigation (few of the headline's words appear in it). The
    // second is a fault of the source text the writer was given, not of the model.
    const skipped: Record<string, Skipped> = { before: { noSource: 0, junkSource: 0 }, after: { noSource: 0, junkSource: 0 } };
    const { significantWords } = await import("../src/lib/titleSimilarity");
    const relevance = (title: string, text: string) => {
      const words = [...significantWords(title)];
      const t = text.toLowerCase();
      return words.length ? words.filter((w) => t.includes(w)).length / words.length : 0;
    };
    let cohort: "before" | "after" = "before";
    const judgeOne = async (r: Row): Promise<Judged | null> => {
      const page = r.sourceUrl.includes("news.google.com") ? null : await extractArticleContent(r.sourceUrl).catch(() => null);
      const source = page?.text && page.text.length >= 600 ? page.text : "";
      if (!source) { skipped[cohort].noSource++; return null; }
      if (relevance(r.title, source) < 0.4) { skipped[cohort].junkSource++; return null; }
      const prompt = `You are checking a short news write-up against its source. SOURCE:\n${source}\n\nHEADLINE: ${r.title}\n\nWRITE-UP:\n${r.body}\n\nScore faithfulness 1-5: 5 = every claim is in the source; 4 = one minor unsupported detail; 3 = a few unsupported or vague claims; 2 = an important claim is wrong or invented (a wrong team, person, score, quote); 1 = mostly unsupported. "unsupported": claims not in the source (short). "problems": other defects (garbled, off-topic, hype, repeated, cut off). Be strict.`;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${RESEARCH_MODEL}:generateContent`, {
          method: "POST", headers: { "Content-Type": "application/json", "X-goog-api-key": paidKey },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { thinkingConfig: { thinkingBudget: 0 }, responseMimeType: "application/json", responseSchema: schema, temperature: 0, maxOutputTokens: 700 } }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const out = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "null");
        if (!out || typeof out.score !== "number") return null;
        return { title: r.title, score: out.score, unsupported: out.unsupported ?? [], problems: out.problems ?? [] };
      } catch { return null; }
    };
    const run = async (rows: Row[]): Promise<Judged[]> => {
      const out: Judged[] = [];
      const queue = rows.slice(0, sampleN * 4); // many have no readable source
      const workers = Array.from({ length: 3 }, async () => {
        while (queue.length && out.length < sampleN) {
          const r = queue.shift()!;
          const j = await judgeOne(r);
          if (j) out.push(j);
        }
      });
      await Promise.all(workers);
      return out;
    };
    cohort = "before";
    const ja = await run(before);
    cohort = "after";
    const jb = await run(after);
    const avg = (xs: Judged[]) => (xs.length ? (xs.reduce((s, x) => s + x.score, 0) / xs.length).toFixed(2) : "-");
    const low = (xs: Judged[]) => pct(xs.filter((x) => x.score <= 2).length, xs.length);
    console.log(`\nPAID JUDGE (faithfulness to the source page, 1-5)   BEFORE   AFTER`);
    console.log(`Write-ups judged (readable, relevant source)`.padEnd(50), String(ja.length).padStart(7), String(jb.length).padStart(7));
    console.log(`Skipped: source unreadable now`.padEnd(50), String(skipped.before.noSource).padStart(7), String(skipped.after.noSource).padStart(7));
    console.log(`Skipped: source page is mostly navigation`.padEnd(50), String(skipped.before.junkSource).padStart(7), String(skipped.after.junkSource).padStart(7));
    console.log(`Average score`.padEnd(50), avg(ja).padStart(7), avg(jb).padStart(7));
    console.log(`Scored 1-2 (an important claim wrong or invented)`.padEnd(50), low(ja).padStart(7), low(jb).padStart(7));
    for (const [label, xs] of [["BEFORE", ja], ["AFTER", jb]] as const) {
      console.log(`\n${label}: lowest scores`);
      for (const x of [...xs].sort((p, q) => p.score - q.score).slice(0, 5)) {
        console.log(`  - [${x.score}] ${x.title.slice(0, 70)} :: ${[...x.unsupported, ...x.problems].slice(0, 2).join(" | ").slice(0, 220)}`);
      }
    }
  } else {
    console.log("\n(Paid judge skipped.)");
  }
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
