/**
 * Draft written profiles for player pages, from this computer (2026-10-08).
 *
 *   npx tsx scripts/profileLocal.ts --slug messi --slug ronaldo      draft these players
 *   npx tsx scripts/profileLocal.ts --sport football --count 10      the first 10 football players without a profile
 *   npx tsx scripts/profileLocal.ts --publish messi --reviewer "Full Name"
 *                                                                    show an approved draft on the player page
 *   options: --env path/to/.dev.vars (default: .dev.vars, then the main checkout's)
 *
 * Each profile costs about 3 paid Gemini calls (web-search research, writing, a
 * fact-check against the research); about 5 cents. Drafts are saved beside the
 * site data but NOT shown, and also written to ./profiles-drafts/<slug>.md for
 * reading. A draft is shown on the page only by --publish, which records the
 * reviewer's name (shown on the page as "Reviewed by ..."): publish only what a
 * person has read and checked.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function values(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => { if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]); });
  return out;
}

async function main() {
  const file = [values("env")[0] ?? "", ".dev.vars", resolve("..", "TheSportsWireLive", ".dev.vars")].filter(Boolean).map((p) => resolve(p)).find((p) => existsSync(p));
  if (!file) { console.error("No .dev.vars found. Pass --env <path>."); process.exit(1); }
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!m) continue;
    const v = m[2].trim().replace(/^"|"$/g, "");
    if (m[1] === "DATABASE_URL" || m[1] === "GEMINI_API_KEY") process.env[m[1]] = v;
    if (m[1] === "GEMINI_API_KEY") process.env.GEMINI_PAID_REVIEW_KEY = v;
  }
  delete process.env.LLM_ROUTER; // research goes straight to the paid key, with web search

  const { db } = await import("../src/db");
  const { dataSnapshot } = await import("../src/db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { TRACKED_PLAYERS } = await import("../src/lib/players");
  const P = await import("../src/lib/profilesRules");

  // ---- publish an approved draft ----
  const toPublish = values("publish");
  if (toPublish.length > 0) {
    const reviewer = values("reviewer")[0]?.trim();
    if (!reviewer) { console.error("--publish needs --reviewer \"Name\" (the person who read and approved it)."); process.exit(1); }
    for (const slug of toPublish) {
      const [d] = await db.select({ data: dataSnapshot.data }).from(dataSnapshot).where(eq(dataSnapshot.key, P.profileDraftKey(slug))).limit(1);
      const draft = d?.data as { text: string; sources: string[]; asOf: string } | undefined;
      if (!draft?.text) { console.log(`No draft for ${slug}.`); continue; }
      const profile = { text: draft.text, sources: draft.sources, asOf: draft.asOf, reviewedBy: reviewer, reviewedAt: new Date().toISOString() };
      await db.insert(dataSnapshot).values({ key: P.profileKey(slug), data: profile, sourceUrl: "profile", fetchedAt: new Date() })
        .onConflictDoUpdate({ target: dataSnapshot.key, set: { data: profile, fetchedAt: new Date() } });
      console.log(`Published the profile for ${slug} (reviewed by ${reviewer}).`);
    }
    process.exit(0);
  }

  // ---- draft ----
  if (!process.env.GEMINI_API_KEY) { console.error("GEMINI_API_KEY (paid) is not in .dev.vars; needed for research and the fact-check."); process.exit(1); }
  const { researchStory, RESEARCH_MODEL } = await import("../src/lib/stories/research");
  const { paidReviewDraft, applyReview } = await import("../src/lib/stories/paidReview");

  let players = values("slug").map((s) => TRACKED_PLAYERS.find((p) => p.slug === s)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  if (values("slug").length > players.length) console.log("Some slugs are not tracked players and were skipped.");
  if (players.length === 0) {
    const sport = values("sport")[0] ?? "football";
    const count = Number(values("count")[0] ?? 10);
    const have = new Set((await db.select({ k: dataSnapshot.key }).from(dataSnapshot).where(inArray(dataSnapshot.key, TRACKED_PLAYERS.flatMap((p) => [P.profileKey(p.slug), P.profileDraftKey(p.slug)])))).map((r) => r.k));
    players = TRACKED_PLAYERS.filter((p) => p.sport === sport && p.role !== "coach" && !have.has(P.profileKey(p.slug)) && !have.has(P.profileDraftKey(p.slug))).slice(0, count);
  }
  if (players.length === 0) { console.log("Nothing to draft."); process.exit(0); }

  mkdirSync("profiles-drafts", { recursive: true });
  const asOf = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  for (const p of players) {
    console.log(`\n=== ${p.name}`);
    const research = await researchStory(`${p.name} profile`, P.buildProfileResearchBrief(p.name, p.sport));
    if (!research || research.facts.length < 6) { console.log(`Skipped: only ${research?.facts.length ?? 0} researched facts.`); continue; }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${RESEARCH_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ parts: [{ text: P.buildProfilePrompt(p.name, p.sport, research.facts, asOf) }] }],
        generationConfig: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.3, maxOutputTokens: 2048 },
      }),
    });
    const data = await res.json().catch(() => null);
    let text: string = (data?.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? "").join("").trim();
    if (!text) { console.log("Skipped: the writing call returned nothing."); continue; }

    const review = await paidReviewDraft({ title: p.name, summary: p.name, body: text }, research.facts);
    if (!review) { console.log("Skipped: the fact-check could not run."); continue; }
    const outcome = applyReview({ title: p.name, summary: p.name, body: text }, review);
    if (!outcome.ok) { console.log(`Skipped: ${outcome.reason}`); continue; }
    text = outcome.text.body.trim();

    const problems = P.profileProblems(p.name, text);
    if (problems.length > 0) { console.log(`Skipped: ${problems.join("; ")}`); continue; }

    const draft = { text, sources: research.sources.slice(0, 6), facts: research.facts, notes: outcome.notes, asOf, createdAt: new Date().toISOString() };
    await db.insert(dataSnapshot).values({ key: P.profileDraftKey(p.slug), data: draft, sourceUrl: "profile", fetchedAt: new Date() })
      .onConflictDoUpdate({ target: dataSnapshot.key, set: { data: draft, fetchedAt: new Date() } });
    writeFileSync(`profiles-drafts/${p.slug}.md`, `# ${p.name}\n\n${text}\n\n---\nAs of ${asOf}. Sources searched: ${draft.sources.join(", ")}\n\nFact-check: ${outcome.notes.join(" ")}\n\nResearched facts:\n${research.facts.map((f) => `- ${f}`).join("\n")}\n`);
    console.log(`Drafted ${P.wordCount(text)} words -> profiles-drafts/${p.slug}.md`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
