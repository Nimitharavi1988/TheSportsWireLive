/**
 * Reusable maintenance tool (NOT a one-off — keep this) that answers "who
 * should we be tracking that we aren't?" without relying on someone
 * eyeballing headlines and happening to notice a gap (how Vaibhav
 * Sooryavanshi and Ajinkya Rahane were found — real, but not something that
 * scales).
 *
 * Pulls recent headlines, asks Gemini to extract real people (athletes,
 * managers, coaches) mentioned repeatedly, cross-references the result
 * against players.ts's existing searchTerms, and prints only the names that
 * aren't already covered — as a report for a human to review, not an
 * auto-add. Every existing entry in players.ts carries real judgment calls
 * (exact sport, a full name vs. a surname safe enough to match on its own,
 * a hand-verified Cricinfo ID) that this script can't make responsibly on
 * its own — see e.g. the "George Best"/"Travis Head" comments in players.ts
 * for why a bare surname is sometimes wrong.
 *
 * Run periodically: npx tsx --env-file=.env scripts/nameGapReport.ts
 */
import { db } from "../src/lib/db";
import { TRACKED_PLAYERS } from "../src/lib/players";

const MODEL = "gemini-flash-latest";
const LOOKBACK_DAYS = 14;
// Caps prompt size/cost — recent+trending headlines are already
// front-loaded by the ingest pipeline's own ordering, so this is a
// representative sample, not an arbitrary truncation.
const MAX_TITLES = 250;
const MIN_MENTIONS = 3;

interface Candidate {
  name: string;
  sport: "football" | "cricket" | "american-football" | "unknown";
  mentionCount: number;
  exampleHeadline: string;
}

async function fetchRecentTitles(): Promise<string[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db.article.findMany({
    where: {
      createdAt: { gt: since },
      category: { in: ["football", "cricket", "american-football"] },
    },
    orderBy: { trendingScore: "desc" },
    take: MAX_TITLES,
    select: { title: true },
  });
  return rows.map((r) => r.title);
}

async function extractCandidates(titles: string[]): Promise<Candidate[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set — cannot run name extraction.");
    return [];
  }

  const prompt = `Here are ${titles.length} recent sports headlines (football/soccer, cricket, or American football):

${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

List every real PERSON (an athlete, manager, or coach — never a team, competition, or publication name) whose full name appears in at least ${MIN_MENTIONS} of these headlines. For each, give their full name as it would appear as a Wikipedia article title, your best guess at their sport (football/cricket/american-football), how many of the headlines above mention them, and one example headline. Do not include commentators or pundits who are just quoted about someone else unless the headline is centrally about them too.`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            people: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  sport: { type: "STRING" },
                  mentionCount: { type: "INTEGER" },
                  exampleHeadline: { type: "STRING" },
                },
                required: ["name", "sport", "mentionCount", "exampleHeadline"],
              },
            },
          },
          required: ["people"],
        },
      },
    }),
  });

  if (!res.ok) {
    console.error(`Gemini call failed: ${res.status}`);
    return [];
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed.people) ? parsed.people : [];
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

// A candidate counts as "already tracked" if their name contains any
// existing searchTerm, or vice versa — catches both directions (a
// candidate returned as "Bukayo Saka" against a tracked term "Saka", and a
// candidate returned as just "Saka" against a tracked full name).
function isAlreadyTracked(candidateName: string): boolean {
  const norm = normalize(candidateName);
  return TRACKED_PLAYERS.some((p) =>
    p.searchTerms.some((term) => {
      const t = normalize(term);
      return norm.includes(t) || t.includes(norm);
    })
  );
}

async function main() {
  const titles = await fetchRecentTitles();
  console.log(`Analyzing ${titles.length} headlines from the last ${LOOKBACK_DAYS} days...\n`);
  if (titles.length === 0) return;

  const candidates = await extractCandidates(titles);
  const gaps = candidates
    .filter((c) => c.mentionCount >= MIN_MENTIONS && !isAlreadyTracked(c.name))
    .sort((a, b) => b.mentionCount - a.mentionCount);

  if (gaps.length === 0) {
    console.log("No untracked names met the mention threshold this run.");
    return;
  }

  console.log(`Found ${gaps.length} untracked name(s) worth reviewing:\n`);
  for (const gap of gaps) {
    console.log(`${gap.mentionCount}x  ${gap.name}  (${gap.sport})`);
    console.log(`     e.g. "${gap.exampleHeadline}"`);
    console.log(
      `     Template: { slug: "${gap.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}", name: "${gap.name}", searchTerms: ["${gap.name}"], sport: "${gap.sport}" },  // cricinfoPlayerId: ??? — look up before adding`
    );
    console.log("");
  }
  console.log("Review each before adding to players.ts — verify the sport, check whether a shorter searchTerm is safe");
  console.log("(see the false-positive-avoidance comments throughout players.ts), and look up a real Cricinfo ID for cricketers.");
}

main().then(() => process.exit(0));
