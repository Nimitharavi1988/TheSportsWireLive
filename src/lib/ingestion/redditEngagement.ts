/**
 * Real community-engagement signal for trending scoring, as a companion to
 * Google Trends' search-volume signal (trending.ts) — pulls each
 * subreddit's current "hot" listing via Reddit's public read-only JSON API
 * (no auth needed) and matches post titles against the same tracked
 * club/player name lists the /club and /player pages already use, weighted
 * by each post's upvote score. This reflects what people are actually
 * discussing right now, which search-trend keyword matching alone misses.
 *
 * Best-effort like trending.ts: any failure (rate limit, network, Reddit
 * layout change) just means an empty map, same as no engagement data at
 * all — it should never break ingestion.
 */
import { TRACKED_CLUBS } from "../clubs";
import { TRACKED_PLAYERS } from "../players";

const SUBREDDITS = ["soccer", "cricket"];

// Reddit requires a descriptive User-Agent or it aggressively rate-limits
// anonymous requests — see https://github.com/reddit-archive/reddit/wiki/API
const USER_AGENT = "SportsWireLiveBot/1.0 (sports news aggregator; +https://sportswirelive.com)";

interface RedditPost {
  title: string;
  score: number;
}

async function fetchSubredditHot(subreddit: string): Promise<RedditPost[]> {
  try {
    const res = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=25`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) {
      console.error(`Reddit fetch failed for r/${subreddit}: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const children = data?.data?.children ?? [];
    return children
      .map((c: { data?: { title?: string; score?: number; stickied?: boolean } }) => c.data)
      .filter((p: { title?: string; score?: number; stickied?: boolean }) => p?.title && !p.stickied && (p.score ?? 0) > 0)
      .map((p: { title: string; score: number }) => ({ title: p.title, score: p.score }));
  } catch (err) {
    console.error(`Reddit fetch failed for r/${subreddit}:`, err);
    return [];
  }
}

// Log-scaled and capped — a single post with an outlier score (10k+
// upvotes) shouldn't be able to dwarf every other trending signal, it
// should just comfortably win the "hot right now" tiebreak.
export function weightForScore(score: number): number {
  return Math.min(15, Math.round(Math.log2(score + 1)));
}

// Returns a lowercased-term -> weight map (e.g. "manchester city" -> 8),
// the highest weight seen across all matching hot posts for that term.
export async function fetchRedditEngagement(): Promise<Map<string, number>> {
  const entityTerms = [
    ...TRACKED_CLUBS.flatMap((c) => c.searchTerms),
    ...TRACKED_PLAYERS.flatMap((p) => p.searchTerms),
  ];

  const postLists = await Promise.all(SUBREDDITS.map(fetchSubredditHot));
  const posts = postLists.flat();

  const engagement = new Map<string, number>();
  for (const post of posts) {
    const lowerTitle = post.title.toLowerCase();
    const weight = weightForScore(post.score);
    for (const term of entityTerms) {
      const lowerTerm = term.toLowerCase();
      if (lowerTitle.includes(lowerTerm)) {
        engagement.set(lowerTerm, Math.max(engagement.get(lowerTerm) ?? 0, weight));
      }
    }
  }
  return engagement;
}
