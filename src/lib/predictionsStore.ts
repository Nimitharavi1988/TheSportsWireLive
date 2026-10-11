/**
 * Database side of match predictions (rules in predictions.ts). Run from the
 * live-refresh workflow (predictionsRun.ts), which is single-writer by its
 * concurrency group, so the create step needs no extra locking.
 */
import { and, eq, gt, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/db";
import { article, poll, pollOption } from "@/db/schema";
import {
  MAX_NEW_PREDICTIONS_PER_RUN,
  PREDICTION_WINDOW_MS,
  VOID_AFTER_MS,
  isPredictable,
  matchOutcome,
  predictionOptions,
  predictionQuestion,
} from "./predictions";

// Adds a "Who will win?" poll to upcoming big matches that have none.
export async function createMissingPredictions(now: Date = new Date(), dryRun = false): Promise<number> {
  const rows = await db
    .select({
      id: article.id,
      category: article.category,
      homeTeam: article.homeTeam,
      awayTeam: article.awayTeam,
      leagueLabel: article.leagueLabel,
      seriesLabel: article.seriesLabel,
    })
    .from(article)
    .leftJoin(poll, eq(poll.articleId, article.id))
    .where(and(
      eq(article.status, "published"),
      eq(article.language, "en"),
      isNull(poll.id),
      gt(article.kickoffAt, now),
      lt(article.kickoffAt, new Date(now.getTime() + PREDICTION_WINDOW_MS)),
      or(isNull(article.matchStatus), ne(article.matchStatus, "finished")),
    ))
    .orderBy(article.kickoffAt)
    .limit(500);

  let created = 0;
  for (const row of rows) {
    if (created >= MAX_NEW_PREDICTIONS_PER_RUN) break;
    if (!isPredictable(row)) continue;
    if (dryRun) {
      console.log(`[predictions] would open: ${row.homeTeam} v ${row.awayTeam} (${row.leagueLabel ?? row.seriesLabel ?? row.category})`);
      created++;
      continue;
    }
    const pollId = createId();
    // One atomic request (the Neon HTTP driver has no transactions), so a
    // failure cannot leave a poll without options.
    await db.batch([
      db.insert(poll).values({ id: pollId, articleId: row.id, question: predictionQuestion(), kind: "prediction" }),
      db.insert(pollOption).values(
        predictionOptions(row.homeTeam!, row.awayTeam!, row.category).map((o) => ({
          id: createId(),
          pollId,
          text: o.text,
          outcome: o.outcome,
        })),
      ),
    ]);
    created++;
  }
  return created;
}

// Marks finished matches' predictions right/wrong (winning option), or void
// (no winner or unreadable result). Also voids ones that never finished.
export async function resolveFinishedPredictions(now: Date = new Date()): Promise<{ resolved: number; voided: number }> {
  const open = await db
    .select({
      pollId: poll.id,
      category: article.category,
      homeTeam: article.homeTeam,
      awayTeam: article.awayTeam,
      homeScore: article.homeScore,
      awayScore: article.awayScore,
      matchNote: article.matchNote,
      matchStatus: article.matchStatus,
      kickoffAt: article.kickoffAt,
    })
    .from(poll)
    .innerJoin(article, eq(article.id, poll.articleId))
    .where(and(eq(poll.kind, "prediction"), isNull(poll.resolvedAt)))
    .limit(500);

  const due = open.filter(
    (r) => r.matchStatus === "finished" || (r.kickoffAt !== null && now.getTime() - r.kickoffAt.getTime() > VOID_AFTER_MS),
  );
  if (due.length === 0) return { resolved: 0, voided: 0 };

  const options = await db
    .select({ id: pollOption.id, pollId: pollOption.pollId, outcome: pollOption.outcome })
    .from(pollOption)
    .where(inArray(pollOption.pollId, due.map((r) => r.pollId)));

  let resolved = 0;
  let voided = 0;
  for (const r of due) {
    const outcome = r.matchStatus === "finished" ? matchOutcome(r) : null;
    const winner = outcome ? options.find((o) => o.pollId === r.pollId && o.outcome === outcome) : undefined;
    await db.update(poll).set({ resolvedAt: now, resolvedOptionId: winner?.id ?? null }).where(eq(poll.id, r.pollId));
    if (winner) resolved++;
    else voided++;
  }
  return { resolved, voided };
}
