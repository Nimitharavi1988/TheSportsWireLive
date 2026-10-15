import { NextResponse } from "next/server";
import { and, asc, count, eq, gt, inArray, isNull, like, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { article, poll, pollOption, pollVote } from "@/db/schema";
import { getOrCreateVoterId } from "@/lib/voterCookie";
import { PICKS_ROW_SIZE, PICKS_WINDOW_MS, pickRowOrder } from "@/lib/picksRow";

// The home page's "Today's picks": the biggest open match predictions starting
// in the next ~30 hours, with this visitor's own pick. Per visitor (the voter
// cookie), so never cached. Picks themselves go through the normal vote route.
export const dynamic = "force-dynamic";

const OUTCOME_ORDER: Record<string, number> = { home: 0, draw: 1, away: 2 };

// Optional ?sport=football (that sport only, sub-categories included) and ?exclude=<articleId> (the match the
// reader is already looking at). A sport slug is lowercase letters and dashes; anything else is ignored.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sportParam = searchParams.get("sport");
  const sport = sportParam && /^[a-z-]{1,40}$/.test(sportParam) ? sportParam : null;
  const exclude = searchParams.get("exclude");
  const voterId = await getOrCreateVoterId();
  const now = new Date();
  const rows = await db
    .select({
      pollId: poll.id,
      articleId: article.id,
      slug: article.slug,
      homeTeam: article.homeTeam,
      awayTeam: article.awayTeam,
      leagueLabel: article.leagueLabel,
      category: article.category,
      kickoffAt: article.kickoffAt,
      homeCrest: article.homeCrestUrl,
      awayCrest: article.awayCrestUrl,
    })
    .from(poll)
    .innerJoin(article, eq(article.id, poll.articleId))
    .where(and(
      eq(poll.kind, "prediction"),
      isNull(poll.resolvedAt),
      eq(article.status, "published"),
      gt(article.kickoffAt, now),
      lt(article.kickoffAt, new Date(now.getTime() + PICKS_WINDOW_MS)),
      sport ? or(eq(article.category, sport), like(article.category, `${sport}/%`)) : undefined,
      exclude ? ne(article.id, exclude) : undefined,
    ))
    .orderBy(asc(article.kickoffAt))
    .limit(40);

  const chosen = pickRowOrder(rows.filter((r): r is typeof r & { kickoffAt: Date } => r.kickoffAt !== null), PICKS_ROW_SIZE);
  if (chosen.length === 0) return NextResponse.json({ matches: [] });

  const pollIds = chosen.map((c) => c.pollId);
  const [options, mine] = await Promise.all([
    db.select({ id: pollOption.id, pollId: pollOption.pollId, text: pollOption.text, outcome: pollOption.outcome, votes: count(pollVote.id) })
      .from(pollOption)
      .leftJoin(pollVote, eq(pollVote.optionId, pollOption.id))
      .where(inArray(pollOption.pollId, pollIds))
      .groupBy(pollOption.id, pollOption.pollId, pollOption.text, pollOption.outcome),
    db.select({ pollId: pollVote.pollId, optionId: pollVote.optionId }).from(pollVote)
      .where(and(inArray(pollVote.pollId, pollIds), eq(pollVote.cookieId, voterId))),
  ]);

  return NextResponse.json({
    matches: chosen.map((c) => ({
      articleId: c.articleId,
      slug: c.slug,
      home: c.homeTeam,
      away: c.awayTeam,
      league: c.leagueLabel,
      kickoffAt: c.kickoffAt.toISOString(),
      homeCrest: c.homeCrest,
      awayCrest: c.awayCrest,
      votedOptionId: mine.find((m) => m.pollId === c.pollId)?.optionId ?? null,
      options: options
        .filter((o) => o.pollId === c.pollId)
        .sort((a, b) => (OUTCOME_ORDER[a.outcome ?? ""] ?? 3) - (OUTCOME_ORDER[b.outcome ?? ""] ?? 3))
        .map((o) => ({ id: o.id, text: o.text, outcome: o.outcome, votes: Number(o.votes) })),
    })),
  });
}
