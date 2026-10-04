/**
 * Daily cap on AI write-ups of other outlets' news (2026-10-04).
 *
 * Every ingested news story got a Gemini write-up plus a second substance
 * check, about 1,300 stories (2,600+ calls) a day, and almost all of them end
 * up noindex (thinContent.ts) because a write-up can only be as long as the
 * source snippet. Until the site earns from ads, the spend is capped: a daily
 * total spread evenly over the day's runs, so each run writes up only its
 * few highest-trending stories and the evening's big news isn't starved by
 * the morning's. Stories past the cap stay unwritten (pending) as before
 * when the per-run budget ran out. Raise DAILY_NEWS_COMMENTARY_CAP (env) to
 * spend more.
 */

export const DEFAULT_DAILY_NEWS_COMMENTARY_CAP = 400;
// The ingest workflow runs every 15 minutes (cron-job.org).
export const RUNS_PER_DAY = 96;
// A run may use up to 1.5x its even share, to catch up after a quiet spell
// or a missed run, but never past what's left of the day's total.
const CATCH_UP = 1.5;

// Write-ups this run may make (pure, unit-tested).
export function commentaryRunBudget(dailyCap: number, usedToday: number, perRunMax: number): number {
  const left = Math.max(0, dailyCap - usedToday);
  const share = Math.ceil((dailyCap / RUNS_PER_DAY) * CATCH_UP);
  return Math.min(perRunMax, left, share);
}

// The reserved floors (cricket, the newer minor sports) scaled to this run's
// budget, keeping their share of the old 150-per-run budget (35 and 25):
// never more than the budget between them (pure, unit-tested).
export function scaledReserve(reserve: number, oldTotal: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.max(1, Math.round((reserve / oldTotal) * budget));
}
