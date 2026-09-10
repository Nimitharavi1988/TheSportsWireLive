import { db } from "./db";
import { TRACKED_PLAYERS } from "./players";
import { TRACKED_CLUBS } from "./clubs";

export interface SentimentEntry {
  name: string;
  href: string;
  hype: number;
  panic: number;
  neutral: number;
  total: number;
  dominant: "hype" | "panic" | "neutral";
}

const DOMINANT_EMOJI: Record<SentimentEntry["dominant"], string> = { hype: "🔥", panic: "🚨", neutral: "🥶" };
export { DOMINANT_EMOJI };

// Top 5 players/clubs by reaction volume over the last 24h — reuses the
// same title-substring matching every other "which entity is this article
// about" feature on the site already relies on (Player News, tagged-club
// chips, etc.), rather than inventing a new tagging mechanism just for
// this. An article can match more than one entity (e.g. a transfer story
// naming both a player and a club) — its reactions count toward each.
export async function getSentimentLeaderboard(limit = 5): Promise<SentimentEntry[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const reactions = await db.articleReaction.findMany({
    where: { createdAt: { gte: since } },
    select: { type: true, article: { select: { title: true } } },
  });
  if (reactions.length === 0) return [];

  const totals = new Map<string, { name: string; href: string; hype: number; panic: number; neutral: number }>();

  function bump(key: string, name: string, href: string, type: "hype" | "panic" | "neutral") {
    const entry = totals.get(key) ?? { name, href, hype: 0, panic: 0, neutral: 0 };
    entry[type]++;
    totals.set(key, entry);
  }

  for (const reaction of reactions) {
    const title = reaction.article.title.toLowerCase();
    for (const player of TRACKED_PLAYERS) {
      if (player.searchTerms.some((t) => title.includes(t.toLowerCase()))) {
        bump(`player:${player.slug}`, player.name, `/player/${player.slug}`, reaction.type);
      }
    }
    for (const club of TRACKED_CLUBS) {
      if (club.searchTerms.some((t) => title.includes(t.toLowerCase()))) {
        bump(`club:${club.slug}`, club.name, `/club/${club.slug}`, reaction.type);
      }
    }
  }

  return [...totals.values()]
    .map((e) => {
      const total = e.hype + e.panic + e.neutral;
      const dominant: SentimentEntry["dominant"] =
        e.hype >= e.panic && e.hype >= e.neutral ? "hype" : e.panic >= e.neutral ? "panic" : "neutral";
      return { ...e, total, dominant };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
