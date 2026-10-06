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
import { selectIndiaCricketHashtags, selectSpanishHashtags } from "./hashtagRepertoire";
import { LOCALES } from "../i18n/locales";

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
  // Several sports at once (category prefixes), for a Page that covers more than
  // one: used instead of `sport` when set.
  categories?: string[];
  // A language edition's Page: only stories with a live translation are posted,
  // with the translated text and the edition's own article address (see
  // postArticleToFacebook).
  locale?: string;
  // Also draw candidates from other categories whose title contains one of
  // these phrases (case-insensitive) — e.g. Asian Games stories filed under
  // athletics.
  alsoTitleLike?: string[];
  // Oldest story (hours since it was published) this Page posts, links and reels.
  // Default: 48 hours. Without a limit, a slow stretch drops to day-old stories
  // (a quarter of Greenfield's reels used stories over 24 hours old).
  maxAgeHours?: number;
  // Key of a sibling Page (its post history key): stories already posted there are
  // skipped here, so two Pages under one owner don't carry the same stories and
  // videos (repeated content gets less reach). The sibling should run first.
  notAlsoOn?: string;
  // Post format. Default: a link post. "photo-question": the story's photo with
  // a caption that ends in a question, and the article link in the first comment
  // (postArticleToFacebook) — a test of whether that earns more reach than a link.
  style?: "photo-question";
  // Higher limits until a date (a Page's first day), after which the normal
  // limits above apply again by themselves — see effectiveDestination.
  boost?: { until: Date; dailyCap: number; reels?: { dailyCap: number; perRunCap: number } };
  // Automatic Reels for this Page (topicReels.ts): own daily limit, daytime only.
  // minTrending: skip stories scoring below this (Article.trendingScore) — the bottom of
  // the queue made weak reels (Greenfield's average score was 38 vs 55 on the main Page).
  // activeHours: reels only go out in these local hours (default: the Page's own).
  reels?: { dailyCap: number; perRunCap: number; minTrending?: number; activeHours?: { timeZone: string; start: number; end: number } };
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

const ASIAN_GAMES = /\basian games\b/i;

export function isIndiaCricket(a: DestinationCandidate): boolean {
  // Asian Games stories in any sport — the Page's audience follows India's
  // whole Games campaign, not only its cricket.
  if (!a.category.startsWith("cricket")) return [a.title, a.seriesLabel].some((t) => t && ASIAN_GAMES.test(t));
  if ((a.homeTeam && INDIA_TEAM.test(a.homeTeam)) || (a.awayTeam && INDIA_TEAM.test(a.awayTeam))) return true;
  return [a.title, a.seriesLabel, a.leagueLabel, a.venue].some((t) => t && INDIA_TERMS.test(t));
}

// The Page's topic rule: all cricket (not only India's) plus Asian Games
// stories in any sport.
export function isCricketOrAsianGames(a: DestinationCandidate): boolean {
  return a.category.startsWith("cricket") || [a.title, a.seriesLabel].some((t) => t && ASIAN_GAMES.test(t));
}

// India v West Indies ODI series (2nd ODI 30 Sep 2026 IST): its stories go to
// the front of the India cricket Page's queue until the series is over.
const INDIA_WI_TERMS = /\b(west indies|windies|indvwi|ind vs wi|india vs wi)\b/i;
const INDIA_WI_UNTIL = new Date("2026-10-03T00:00:00Z");

export function isIndiaWestIndies(a: DestinationCandidate, now: Date): boolean {
  if (now >= INDIA_WI_UNTIL) return false;
  return isIndiaCricket(a) && [a.title, a.seriesLabel, a.homeTeam, a.awayTeam].some((t) => t && INDIA_WI_TERMS.test(t));
}

const FRESH_MS = 12 * 3600_000;

// Queue order for a Page: focus stories first, then stories under 12 hours
// old, then the rest — each group keeps its incoming (trending) order.
export function prioritise<T extends DestinationCandidate & { publishedAt: Date | null }>(pool: T[], now: Date): T[] {
  const tier = (a: T) => (isIndiaWestIndies(a, now) ? 0 : a.publishedAt && now.getTime() - a.publishedAt.getTime() < FRESH_MS ? 1 : 2);
  return pool.map((a, i) => ({ a, i, t: tier(a) })).sort((x, y) => x.t - y.t || x.i - y.i).map((x) => x.a);
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
  // News only: nothing older than a day (Sportswirecricketlive inherits this).
  maxAgeHours: 24,
  reels: { dailyCap: 24, perRunCap: 1, minTrending: 35 },
  matches: isCricketOrAsianGames,
  // #INDvWI, the player, #TeamIndia — not the main Page's brand tag.
  hashtags: (title) => selectIndiaCricketHashtags(title),
};

// Sportswirecricketlive: the same stories, pacing, hashtags and reels as the
// India cricket Page — same stories, hours and hashtags, under the main
// Business umbrella — so it posts with the main FACEBOOK_PAGE_ACCESS_TOKEN
// (exchanged for its own Page token). Its own key means its posting history is
// separate: a story can go to both Pages. This is the TEST Page for the new
// approach (2026-10): far fewer posts (10 a day, 4 reels) and the photo +
// question + link-in-comment format; the India cricket Page stays the control.
export const CRICKETLIVE_PAGE: FacebookDestination = {
  ...INDIA_CRICKET_PAGE,
  key: "cricketlive",
  label: "Sportswirecricketlive Page",
  pageId: "1389324964254541",
  tokenEnv: "FACEBOOK_PAGE_ACCESS_TOKEN",
  dailyCap: 10,
  perRunCap: 1,
  style: "photo-question",
  // Own stories, not Greenfield's; reels at midday IST only (11:00-16:00) — its
  // reels got 72-179 plays at 12-15h IST against 1-48 early morning and evening.
  notAlsoOn: "india-cricket",
  reels: { dailyCap: 10, perRunCap: 1, activeHours: { timeZone: "Asia/Kolkata", start: 11, end: 16 } },
  // First day of posting (4 Oct IST): 30 posts and 30 reels, still one of each per run.
  boost: { until: new Date("2026-10-04T18:30:00Z"), dailyCap: 30, reels: { dailyCap: 30, perRunCap: 1 } },
};

// ---- Spanish Page (language edition "es") -------------------------------
// Posts translated stories, in Spanish, linking to es.sportswirelive.com.
// OFF until the Page exists: set FACEBOOK_ES_ENABLED=1 together with
// FACEBOOK_PAGE_ES_ID (variable) and FACEBOOK_PAGE_ES_ACCESS_TOKEN (secret).
// Audience: US Hispanic, Latin America and Spain — so the posting day runs 8:00-23:00
// Mexico City time (mid-day for the Americas; late evening in Spain).
export function spanishPageEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FACEBOOK_ES_ENABLED === "1" && Boolean(env.FACEBOOK_PAGE_ES_ID);
}

export const SPANISH_PAGE: FacebookDestination = {
  key: "es",
  label: "Spanish Page",
  pageId: process.env.FACEBOOK_PAGE_ES_ID ?? "",
  tokenEnv: "FACEBOOK_PAGE_ES_ACCESS_TOKEN",
  dailyCap: 24,
  perRunCap: 2,
  activeHours: { timeZone: "America/Mexico_City", start: 8, end: 23 },
  sport: "football",
  categories: LOCALES.es.categories,
  locale: "es",
  matches: () => true,
  hashtags: (title, category) => selectSpanishHashtags(title, category),
};

export const TOPIC_DESTINATIONS: FacebookDestination[] = [INDIA_CRICKET_PAGE, CRICKETLIVE_PAGE, ...(spanishPageEnabled() ? [SPANISH_PAGE] : [])];

// The destination with its boost limits applied while the boost is active
// (otherwise unchanged).
export function effectiveDestination(d: FacebookDestination, now: Date): FacebookDestination {
  if (!d.boost || now >= d.boost.until) return d;
  return { ...d, dailyCap: d.boost.dailyCap, reels: d.boost.reels ?? d.reels };
}

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
export function destinationRunCap(d: Pick<FacebookDestination, "dailyCap" | "perRunCap" | "activeHours"> & { overnight?: boolean }, postedToday: number, now: Date): number {
  const { timeZone, start, end } = d.activeHours;
  const hour = localHour(now, timeZone);
  if (hour < start || hour >= end) {
    // Overnight: low intensity — at most one post, only in the first run of
    // every second hour (~4 over the night), and still within the daily cap.
    if (d.overnight === false) return 0;
    return hour % 2 < 0.25 ? Math.max(0, Math.min(1, d.dailyCap - postedToday)) : 0;
  }
  // 25% head start so the Page isn't silent through the morning.
  const elapsed = Math.min(1, (hour - start) / (end - start) + 0.25);
  const expected = Math.ceil(d.dailyCap * elapsed) || 1;
  return Math.max(0, Math.min(d.perRunCap, expected - postedToday, d.dailyCap - postedToday));
}
