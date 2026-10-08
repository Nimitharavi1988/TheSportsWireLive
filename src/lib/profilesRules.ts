/** Pure rules for player profiles (2026-10-08); no database here so they can be unit-tested. See profiles.ts. */

export interface PlayerProfile {
  text: string;
  sources: string[];
  reviewedBy: string;
  reviewedAt: string; // ISO
  asOf: string; // e.g. "October 2026"
}

export const profileKey = (slug: string) => `profile:player:${slug}`;
export const profileDraftKey = (slug: string) => `profile:draft:player:${slug}`;

export const MIN_PROFILE_WORDS = 230;
export const MAX_PROFILE_WORDS = 480;

export function buildProfileResearchBrief(name: string, sport: string, part: "history" | "now"): string {
  const sources = "Prefer official club, league and governing-body pages and major outlets.";
  return part === "history"
    ? `The background and career history of ${name} (${sport}): date and place of birth, early life and how they got into the sport, youth career and debut, each club or team in order with the years and notable moments, international career, and key turning points. ${sources}`
    : `${name} (${sport}) now: current club or team and role, main honours and records with dates, career totals, and anything notable in the last 12 months. ${sources}`;
}

// The search prompt for one part of a profile (pure). Unlike a news story's research, this is about a person's whole career.
export function buildProfileSearchPrompt(name: string, sport: string, part: "history" | "now", today: Date): string {
  const date = today.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return `Today is ${date}. You are the research desk for a sports news site preparing a profile page of ${name} (${sport}).

Use Google Search to find: ${buildProfileResearchBrief(name, sport, part)}

Rules:
- Only facts you found in search results. Nothing from memory, nothing inferred.
- Leave out anything uncertain, or where sources disagree.
- Give dates and years with each fact.
- Up to 20 facts, one per line, each line starting with "FACT: ".
- No commentary, no opinions, no introduction.`;
}

export function buildProfilePrompt(name: string, sport: string, facts: string[], asOf: string): string {
  return `Write a profile of ${name} (${sport}) for a sports news site's player page, using ONLY the FACTS below.

FACTS:
${facts.map((f) => `- ${f}`).join("\n")}

Rules:
- ${MIN_PROFILE_WORDS + 30} to ${MAX_PROFILE_WORDS - 60} words in four short paragraphs, plain neutral prose, in the third person: (1) who they are and where they come from, (2) how their career developed, club by club or step by step, with years, (3) international and major honours and records, (4) where they are now.
- Every sentence must be supported by the facts. No hype, no predictions, no opinions, no quotes unless a fact gives one with who said it.
- Date anything that can change ("As of ${asOf}, ...").
- Do not mention the facts, sources or this task. Output the profile text only, paragraphs separated by a blank line.`;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// Why a drafted profile can't be saved (pure, unit-tested); empty = fine.
export function profileProblems(name: string, text: string): string[] {
  const out: string[] = [];
  const n = wordCount(text);
  if (n < MIN_PROFILE_WORDS) out.push(`too short (${n} words)`);
  if (n > MAX_PROFILE_WORDS) out.push(`too long (${n} words)`);
  if (/\[[^\]]*\]|\b(?:TODO|TBD|CHECK)\b/.test(text)) out.push("has a note or gap in the text");
  const last = name.split(/\s+/).pop()!.toLowerCase();
  if (!text.toLowerCase().includes(last)) out.push("never names the player");
  return out;
}

