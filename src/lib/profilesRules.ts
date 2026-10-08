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

export const MIN_PROFILE_WORDS = 90;
export const MAX_PROFILE_WORDS = 230;

export function buildProfileResearchBrief(name: string, sport: string): string {
  return `A short factual profile of ${name} (${sport}): current club or team and role, career path, main honours and records with dates, and anything notable in the last 12 months. Prefer official club, league and governing-body pages and major outlets.`;
}

export function buildProfilePrompt(name: string, sport: string, facts: string[], asOf: string): string {
  return `Write a profile of ${name} (${sport}) for a sports news site's player page, using ONLY the FACTS below.

FACTS:
${facts.map((f) => `- ${f}`).join("\n")}

Rules:
- ${MIN_PROFILE_WORDS + 20} to ${MAX_PROFILE_WORDS - 50} words, two short paragraphs, plain neutral prose, in the third person.
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

