/**
 * Facebook Pages the site posts to. "main" is the Sports Wire Live Page
 * (all sports; its selection and pacing live in autoApprove.ts). Other
 * destinations are topic Pages: each has its own topic rule, daily limit,
 * posting hours and token, and its own posting history
 * (SocialPost.destination) — so one Page's posts never count against, or
 * block a story for, another. Added 2026-09-26 for an India cricket Page.
 *
 * Tokens come from GitHub Actions secrets (never stored here); Page ids
 * are public. A destination whose token isn't set is simply skipped.
 */
import { selectIndiaCricketHashtags } from "./hashtagRepertoire";

export interface FacebookDestination {
  key: string;
  label: string;
  pageId: string;
  // Name of the env var / GitHub secret holding the Page (or System User)
  // token — exchanged for a Page token before posting (resolvePageAccessToken).
  tokenEnv: string;
  dailyCap: number;
  // Most posts in one ingestion run (runs are every ~15 min).
  perRunCap: number;
  // Posts are spread over these local hours (the Page's audience's day).
  activeHours: { timeZone: string; start: number; end: number };
  // The sport this Page covers (category prefix) — candidates are chosen
  // within it, so busier sports can't crowd its stories out.
  sport: string;
  // Also draw candidates from other categories whose title contains one of
  // these phrases (case-insensitive) — e.g. Asian Games stories filed under
  // athletics.
  alsoTitleLike?: string[];
  matches: (a: DestinationCandidate) => boolean;
  // The post's hashtags, when this Page wants its own (default: the main
  // Page's topic tags + #SportsWireLive — hashtagRepertoire.ts).
  hashtags?: (title: string, category: string) => string[];
}

export interface DestinationCandidate {
  category: string;
  title: string;
  homeTeam: string | null;
  awayTeam: string | null;
  seriesLabel: string | null;
  leagueLabel: string | null;
  venue: string | null;
}

// India cricket: India's own teams (men, women, A, U19) in a match; India-
// specific competitions (IPL, WPL, Ranji, Duleep, Vijay Hazare, Syed
// Mushtaq Ali) and venues named in the story or its series/league; or
// India / BCCI / Team India in the headline. Deliberately not "any story
// mentioning a player": a player list with nationality comes with the
// tagging redesign (see project plan), not a hand-kept list here.
const INDIA_TEAM = /^india(n)?\b/i;
const INDIA_TERMS =
  /\b(india|indian|bcci|team india|ipl|wpl|ranji|duleep|vijay hazare|syed mushtaq ali|irani cup|greenfield|thiruvananthapuram|eden gardens|wankhede|chinnaswamy|chepauk|narendra modi stadium)\b/i;

const ASIAN_GAMES = /asian games/i;

export function isIndiaCricket(a: DestinationCandidate): boolean {
  // Asian Games stories in any sport — the Page's audience follows India's
  // whole Games campaign, not only its cricket.
  if (!a.category.startsWith("cricket")) return [a.title, a.seriesLabel].some((t) => t && ASIAN_GAMES.test(t));
  if ((a.homeTeam && INDIA_TEAM.test(a.homeTeam)) || (a.awayTeam && INDIA_TEAM.test(a.awayTeam))) return true;
  return [a.title, a.seriesLabel, a.leagueLabel, a.venue].some((t) => t && INDIA_TERMS.test(t));
}

export const INDIA_CRICKET_PAGE: FacebookDestination = {
  key: "india-cricket",
  label: "India cricket Page",
  pageId: "359420874511841",
  tokenEnv: "FACEBOOK_PAGE_2_ACCESS_TOKEN",
  dailyCap: 30,
  perRunCap: 3,
  activeHours: { timeZone: "Asia/Kolkata", start: 7, end: 23 },
  sport: "cricket",
  alsoTitleLike: ["asian games"],
  matches: isIndiaCricket,
  // #INDvWI, the player, #TeamIndia — not the main Page's brand tag.
  hashtags: (title) => selectIndiaCricketHashtags(title),
};

export const TOPIC_DESTINATIONS: FacebookDestination[] = [INDIA_CRICKET_PAGE];

// The hour (fractional) in a time zone, e.g. 13.5 for 1:30 PM.
function localHour(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") + get("minute") / 60;
}

// Start of the destination's local day, as a UTC instant — "posted today"
// is counted per the Page's own day, not UTC's.
export function localDayStart(now: Date, timeZone: string): Date {
  return new Date(now.getTime() - localHour(now, timeZone) * 3600_000 - now.getUTCSeconds() * 1000 - now.getUTCMilliseconds());
}

// How many posts this run may make: the daily limit spread evenly over the
// active hours, minus what's already gone out today, within the per-run
// cap. 0 outside the active hours (pure, unit-tested).
export function destinationRunCap(d: Pick<FacebookDestination, "dailyCap" | "perRunCap" | "activeHours">, postedToday: number, now: Date): number {
  const { timeZone, start, end } = d.activeHours;
  const hour = localHour(now, timeZone);
  if (hour < start || hour >= end) {
    // Overnight: low intensity — at most one post, only in the first run of
    // every second hour (~4 over the night), and still within the daily cap.
    return hour % 2 < 0.25 ? Math.max(0, Math.min(1, d.dailyCap - postedToday)) : 0;
  }
  // 25% head start so the Page isn't silent through the morning.
  const elapsed = Math.min(1, (hour - start) / (end - start) + 0.25);
  const expected = Math.ceil(d.dailyCap * elapsed) || 1;
  return Math.max(0, Math.min(d.perRunCap, expected - postedToday, d.dailyCap - postedToday));
}
