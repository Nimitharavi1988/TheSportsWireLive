/**
 * Run the story enrichment from this computer, in bursts (2026-10-06).
 *
 * The workflow enriches a few stories every 15 minutes within a daily limit.
 * This runs the SAME job (src/lib/stories/enrich.ts) here with higher limits,
 * for a burst of extra enriched reports. It draws on the same free provider
 * allowances as the site (the quota belongs to each key, not the machine), so
 * it only helps while the router still shows spare capacity: check first.
 *
 *   npx tsx scripts/enrichLocal.ts                 dry run: prints the reports, saves nothing
 *   npx tsx scripts/enrichLocal.ts --live          really enriches the stories on the site
 *   options: --rounds N (default 8)  --per-day N (60)  --per-run N (4)  --research N (12)
 *            --env path/to/.dev.vars (default: .dev.vars, then the main checkout's)
 *
 * Safety:
 *  - Dry run unless --live.
 *  - Only the free keys are loaded. The paid GEMINI_API_KEY is never read, and
 *    the paid slot is switched off, so a local run cannot spend money.
 *  - It shares the site's enrich log (stories already tried are skipped), and
 *    the log is merged on save, so running while the workflow runs is safe.
 *    Enriched stories count toward the same rolling daily total, so the
 *    workflow pauses until it drops below ITS limit again.
 *  - Stops when a round enriches nothing or the AI is unavailable.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ALLOWED_KEYS = ["DATABASE_URL", "GEMINI_FREE_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY", "INDEXNOW_KEY"];

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
    if (m && ALLOWED_KEYS.includes(m[1])) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
}

async function main() {
  const file = envFile();
  if (!file) { console.error("No .dev.vars found. Pass --env <path>."); process.exit(1); }
  loadFreeKeys(file);
  if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is missing from the env file."); process.exit(1); }

  const live = process.argv.includes("--live");
  const rounds = arg("rounds", 8);
  process.env.LLM_ROUTER = "1";
  process.env.LLM_PAID_DAILY_CALLS = "0";
  delete process.env.GEMINI_API_KEY;
  process.env.SITE_URL ??= "https://www.sportswirelive.com";
  process.env.ENRICH_MAX_PER_DAY = String(arg("per-day", 60));
  process.env.ENRICH_MAX_PER_RUN = String(arg("per-run", 4));
  process.env.ENRICH_MAX_RESEARCH_PER_RUN = String(arg("research", 12));

  // Imported after the environment is set: the database client reads it on load.
  const { enrichTopStories } = await import("../src/lib/stories/enrich");
  console.log(`Local enrichment (${live ? "LIVE: saving to the site" : "dry run: nothing saved"}), up to ${rounds} rounds, limits ${process.env.ENRICH_MAX_PER_DAY}/day ${process.env.ENRICH_MAX_PER_RUN}/round, env ${file}`);

  let total = 0;
  for (let r = 1; r <= rounds; r++) {
    const { enriched, note } = await enrichTopStories(new Date(), { dryRun: !live });
    total += enriched;
    console.log(`Round ${r}: ${enriched} enriched (${note}).`);
    if (enriched === 0 || note !== "ok") break;
    // A dry run saves nothing, so the same stories would come up again.
    if (!live) break;
  }
  console.log(`Done: ${total} ${live ? "enriched and saved" : "drafted (not saved)"}.`);
  process.exit(0);
}

main().catch((err) => { console.error("Local enrichment failed:", err); process.exit(1); });
