// @ts-expect-error - text-readability has no bundled types
import rs from "text-readability";

/**
 * Lightweight built-in profanity filter — replaces the `bad-words` package,
 * which had a broken/corrupted install on this machine. This avoids any
 * further import/packaging issues since it has zero dependencies.
 *
 * Word-boundary matching against a starter list. Add to this list any time
 * you spot something it missed in the "Flagged" section of the admin queue —
 * treat it as a living config, not a finished list.
 */
const PROFANITY_LIST = [
  "fuck", "shit", "bitch", "asshole", "bastard", "dick", "piss",
  "cunt", "whore", "slut", "damn", "crap",
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return PROFANITY_LIST.some((word) => {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    return pattern.test(lower);
  });
}

// Sports commentary/quotes trip profanity filters more than other verticals,
// so thresholds live here as constants you can tune per vertical later
// (per the plan's note on configurable thresholds).
const MIN_READABILITY_SCORE = 30; // Flesch Reading Ease: below this = hard to read / likely garbled

export interface QualityCheckResult {
  passed: boolean;
  profanityFlag: boolean;
  profanityDetail: string | null;
  readabilityScore: number;
}

export function runQualityChecks(title: string, summary: string): QualityCheckResult {
  const combinedText = `${title} ${summary}`;

  const profanityFlag = containsProfanity(combinedText);
  const profanityDetail = profanityFlag
    ? "Profanity detected in title or summary text"
    : null;

  const readabilityScore = rs.fleschReadingEase(summary);

  // Also catch obviously broken scrapes: leftover HTML tags, or a summary
  // that's suspiciously short (likely a truncated/garbled pull from source).
  const looksBroken = /<[^>]+>/.test(summary) || summary.trim().length < 20;

  const passed = !profanityFlag && readabilityScore >= MIN_READABILITY_SCORE && !looksBroken;

  return { passed, profanityFlag, profanityDetail, readabilityScore };
}