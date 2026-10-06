/**
 * Generate story drafts from this computer, for review and one-click approval
 * (2026-10-06). The workflow makes at most 3 drafts a day with paid web search.
 * This runs the same job (src/lib/stories/autoDraft.ts) here, on the free
 * providers only, and saves each draft CLEAN with a review pack beside it:
 *
 *   npx tsx scripts/draftLocal.ts                  up to 6 drafts
 *   options: --count N (6)  --rounds N (6)  --research N (10)  --max-waiting N (15)
 *            --no-paid-review  skip the paid steps (free providers only)
 *            --free-write      free models write the first draft (paid review only)
 *            --max-paid N (40)  most paid calls this run, writing + review (about 3 cents a draft)
 *            --env path/to/.dev.vars (default: .dev.vars, then the main checkout's)
 *
 * Then sign in to the admin and open Stories > Review drafts
 * (/admin/stories/review): read each story and its pack, then Approve & publish.
 *
 * Safety:
 *  - Drafts are saved UNPUBLISHED. Nothing goes live until someone clicks
 *    Approve on the review page; the approver's login is recorded and the
 *    byline is the name typed there (prefilled from DRAFT_BYLINE_NAME).
 *  - Writing and research use free keys only. The ONE paid step is the review
 *    pass (src/lib/stories/paidReview.ts): a stronger Gemini model checks each
 *    draft against the facts, rejects bad ones and corrects small slips. The
 *    paid GEMINI_API_KEY is given to that step alone (never to the router),
 *    and --max-paid caps its calls. With --no-paid-review nothing is paid.
 *  - Research comes from other outlets' stories already stored (the same method
 *    as the enrichment), not paid web search.
 *  - It stops adding drafts once --max-waiting are unreviewed, so the queue
 *    can't pile up. A draft with gaps or notes in the text is not saved.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ALLOWED_KEYS = ["DATABASE_URL", "GEMINI_FREE_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"];
const PAID_KEY_NAME = "GEMINI_API_KEY";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

function envFile(): string | null {
  const i = process.argv.indexOf("--env");
  const candidates = [i >= 0 ? process.argv[i + 1] : "", ".dev.vars", resolve("..", "TheSportsWireLive", ".dev.vars")].filter(Boolean);
  return candidates.map((p) => resolve(p)).find((p) => existsSync(p)) ?? null;
}

function loadFreeKeys(path: string): void {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!m) continue;
    const value = m[2].trim().replace(/^"|"$/g, "");
    if (ALLOWED_KEYS.includes(m[1])) process.env[m[1]] = value;
    // The paid key goes to the review step only, under its own name.
    if (m[1] === PAID_KEY_NAME && !process.argv.includes("--no-paid-review")) process.env.GEMINI_PAID_REVIEW_KEY = value;
  }
}

async function main() {
  const file = envFile();
  if (!file) { console.error("No .dev.vars found. Pass --env <path>."); process.exit(1); }
  loadFreeKeys(file);
  if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is missing from the env file."); process.exit(1); }

  process.env.LLM_ROUTER = "1";
  process.env.LLM_PAID_DAILY_CALLS = "0";
  delete process.env.GEMINI_API_KEY;
  process.env.SITE_URL ??= "https://www.sportswirelive.com";

  const target = arg("count", 6);
  const rounds = arg("rounds", 6);
  const researchPerRun = arg("research", 10);
  const maxWaiting = arg("max-waiting", 15);
  const maxPaid = arg("max-paid", 40);
  const paidWrite = !process.argv.includes("--free-write");
  const paidReview = Boolean(process.env.GEMINI_PAID_REVIEW_KEY);

  // Imported after the environment is set: the database client reads it on load.
  const { autoDraftStories } = await import("../src/lib/stories/autoDraft");
  console.log(`Local drafts (unpublished; free providers${paidReview ? (paidWrite ? " + paid writing and review" : " + paid review") + ", max " + maxPaid + " calls" : ", no paid steps"}), target ${target}, up to ${rounds} rounds, env ${file}`);

  let total = 0;
  for (let r = 1; r <= rounds && total < target; r++) {
    const { drafted, note } = await autoDraftStories(new Date(), {
      perRun: Math.min(2, target - total), perDay: 1000, researchPerRun, maxUnreviewed: maxWaiting, freeResearch: true, reviewPack: true, paidReview, paidWrite: paidReview && paidWrite, paidReviewMax: maxPaid,
    });
    total += drafted;
    console.log(`Round ${r}: ${drafted} saved (${note}).`);
    if (note !== "ok" && drafted === 0) break;
    if (drafted === 0 && r >= 2) break;
  }
  console.log(`Done: ${total} draft(s) waiting for review. Open Stories > Review drafts in the admin to read and approve.`);
  process.exit(0);
}

main().catch((err) => { console.error("Local drafts failed:", err); process.exit(1); });
