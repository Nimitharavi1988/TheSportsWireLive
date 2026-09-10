// @ts-expect-error - text-readability has no bundled types
import rs from "text-readability";

/**
 * Lightweight built-in profanity filter — replaces the `bad-words` package,
 * which had a broken/corrupted install on this machine. Zero dependencies.
 *
 * Add to this list any time you spot something it missed in the "Flagged"
 * section of the admin queue — treat it as a living config, not a finished
 * list.
 */
const PROFANITY_LIST = [
  "fuck", "fucking", "fucker", "motherfucker", "shit", "bullshit", "horseshit",
  "bitch", "asshole", "arsehole", "bastard", "dick", "dickhead",
  "piss", "pissed", "cunt", "whore", "slut", "damn", "goddamn", "crap",
  "twat", "wanker", "bollocks", "bugger", "prick", "douche",
  "douchebag", "cock", "cocksucker", "pussy",
  "jackass", "dumbass", "dipshit", "nigger", "nigga", "faggot", "fag",
  "retard", "retarded", "spastic", "tranny", "chink", "spic", "wetback",
  "gook", "kike", "paki", "raghead", "shithead", "shitty",
  "asswipe", "dumbfuck", "motherfucking", "goddamned",
];

// Common evasion patterns, all handled without ever letting two separate
// words merge into an accidental match (each check works within a single
// token/word, never across whitespace):
//   1. Digit/symbol-for-letter substitution ("sh1t", "a$$hole")
//   2. A censor symbol standing in for one letter ("f*ck", "f#*k")
//   3. Punctuation splitting up the letters ("f-u-c-k", "f.u.c.k")
//   4. Letter-spam ("fuuuuuck")
const LEET_MAP: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i",
};

function applyLeetSubstitution(text: string): string {
  let result = text.toLowerCase();
  for (const [from, to] of Object.entries(LEET_MAP)) {
    result = result.split(from).join(to);
  }
  return result;
}

const obfuscationPatternCache = new Map<string, RegExp>();

// Builds a regex where each letter of the word may repeat (letter-spam) or
// be stood in for by exactly one arbitrary punctuation/symbol character
// (a censor mark), with optional filler punctuation between letters. A
// clean English token can only match this if its letters already spell the
// word — the wildcard branch only ever fires on tokens that contain
// non-alphanumeric characters in the first place, which is the obfuscation
// signal itself.
function obfuscationPattern(word: string): RegExp {
  let cached = obfuscationPatternCache.get(word);
  if (cached) return cached;

  const letters = word.split("");
  const body = letters.map((l) => `(?:${l}+|[^a-z0-9\\s])`).join("[^a-z0-9\\s]*");
  cached = new RegExp(`^${body}$`);
  obfuscationPatternCache.set(word, cached);
  return cached;
}

function containsProfanity(text: string): { flagged: boolean; matched: string[] } {
  const matched = new Set<string>();

  const plainLower = text.toLowerCase();
  const leetLower = applyLeetSubstitution(text);

  for (const word of PROFANITY_LIST) {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    if (pattern.test(plainLower) || pattern.test(leetLower)) matched.add(word);
  }

  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    for (const word of PROFANITY_LIST) {
      if (obfuscationPattern(word).test(token)) matched.add(word);
    }
  }

  return { flagged: matched.size > 0, matched: [...matched] };
}

// General-purpose RSS feeds (BBC Sport, etc.) mix in self-promotional filler
// alongside real reporting — quizzes, polls, "sign up" prompts — that isn't
// news at all. A general sports/news reader shouldn't have to see "Flex your
// football brain with our daily quizzes" presented as if it were a match
// report. Title-pattern based since these items are structurally different
// from news headlines (an interactive feature, not an event that happened),
// not a topic filter — living config, extend as new filler shapes turn up
// in the review queue.
const NON_NEWS_PATTERNS = [
  /\bquiz(zes)?\b/i,
  /\bcrossword\b/i,
  // Deliberately NOT a standalone /\bpuzzle\b/ — real tactical-analysis
  // headlines use "puzzle" metaphorically ("Guardiola solves the puzzle of
  // his front three"), the same class of false-positive trap as the
  // profanity list's "Scunthorpe problem" above. No real filler example has
  // used "puzzle" alone so far — leaving it out rather than guessing at a
  // narrower phrasing with no observed case to justify it.
  /how (well|much) do you know/i,
  /test your (football|cricket|sports)? ?knowledge/i,
  /guess the (player|score|team)/i,
  /^vote:/i,
  /^poll:/i,
  /sign up (for|to) our newsletter/i,
];

function isNonNewsFiller(title: string): boolean {
  return NON_NEWS_PATTERNS.some((pattern) => pattern.test(title));
}

// Low-quality content-farm sites append a random bot/video-ID string in
// parentheses to game search rankings — real example caught live: "Pakistan
// Vs Australia 2nd T20 Live Match Today | PAK Vs AUS 2nd T20 Live Scores &
// Commentary Lewandowski (PdBBl3l0s4)". Deliberately narrow and keyed to
// that exact shape (trailing parenthetical, 6+ chars, mixes uppercase,
// lowercase AND a digit, no spaces inside) rather than a broad "any
// parenthetical" rule — same false-positive-avoidance reasoning as the
// profanity list's "Scunthorpe problem": a real headline's parenthetical is
// almost always a readable word/abbreviation ("(video)", "(2026)", "(AUS)"),
// never a random string mixing all three character classes with no spaces.
function looksLikeSpamId(title: string): boolean {
  const match = title.match(/\(([A-Za-z0-9]{6,})\)\s*$/);
  if (!match) return false;
  const id = match[1];
  return /[a-z]/.test(id) && /[A-Z]/.test(id) && /[0-9]/.test(id);
}

export interface QualityCheckResult {
  passed: boolean;
  profanityFlag: boolean;
  profanityDetail: string | null;
  readabilityScore: number;
}

export function runQualityChecks(title: string, summary: string): QualityCheckResult {
  const combinedText = `${title} ${summary}`;

  const { flagged: profanityFlag, matched } = containsProfanity(combinedText);
  const nonNewsFlag = isNonNewsFiller(title);
  const spamIdFlag = looksLikeSpamId(title);
  const profanityDetail = profanityFlag
    ? `Profanity detected: ${matched.join(", ")}`
    : nonNewsFlag
      ? "Not a news article (quiz/poll/filler content)"
      : spamIdFlag
        ? "Looks like content-farm spam (bot-generated ID in title)"
        : null;

  // Stored for visibility in the admin queue, but NOT used as a pass/fail gate:
  // Flesch Reading Ease penalizes long/foreign proper nouns (team names like
  // "Internazionale") the same way it penalizes genuinely garbled text, which
  // made short, perfectly valid match-result sentences fail this check. The
  // `looksBroken` check below is the actual detector for garbled/broken scrapes.
  const readabilityScore = rs.fleschReadingEase(summary);

  // Catch obviously broken scrapes: leftover HTML tags, or a summary that's
  // suspiciously short (likely a truncated/garbled pull from source).
  const looksBroken = /<[^>]+>/.test(summary) || summary.trim().length < 20;

  const passed = !profanityFlag && !looksBroken && !nonNewsFlag && !spamIdFlag;

  return { passed, profanityFlag: profanityFlag || nonNewsFlag || spamIdFlag, profanityDetail, readabilityScore };
}
