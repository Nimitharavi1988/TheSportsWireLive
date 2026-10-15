// Fan engagement report: are fans using predictions and the fan card, and are they coming back?
// Usage: npx tsx --env-file=.env scripts/fanReport.ts [days=14]
// Reads only: anonymous daily counters (AppEvent), FanVisit days, PollVote picks.
import { neon } from "@neondatabase/serverless";

const sql = neon((process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL)!);
const DAYS = Number(process.argv[2] ?? 14);
const since = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10);

async function q<T = Record<string, string>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await sql.query(text, params)) as T[];
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "n/a");

async function main() {
  console.log(`\n=== Fan report, last ${DAYS} days (since ${since}) ===\n`);

  // 1. Anonymous counters, one column per day.
  const kinds = ["session", "article_follow_shown", "article_follow_added", "quick_picks_shown", "quick_pick_followed", "follow_added", "follow_removed", "follows_active", "for_you_strip_shown", "for_you_strip_clicked", "for_you_page_opened", "prediction_shown", "prediction_vote", "rating_shown", "fan_new_visitor", "fan_return_visit", "poll_vote", "fan_chip_clicked", "fan_card_opened", "match_rating", "rating_shown", "feedback_up", "feedback_down", "fan_voice_submitted", "fan_voice_approved"];
  const counters = await q<{ day: string; kind: string; count: number }>(
    `select day, kind, count from "AppEvent" where day >= $1 and (kind = any($2) or kind like 'badge\\_%') order by day`,
    [since, kinds],
  );
  const days = [...new Set(counters.map((c) => c.day))];
  console.log("Daily counters");
  const allKinds = [...new Set([...kinds, ...counters.map((c) => c.kind).filter((k) => k.startsWith("badge_"))])];
  for (const kind of allKinds) {
    const row = days.map((d) => counters.find((c) => c.day === d && c.kind === kind)?.count ?? 0);
    console.log(`  ${kind.padEnd(22)} ${row.join(" ")}   total ${row.reduce((a, b) => a + Number(b), 0)}`);
  }
  console.log(`  days:                  ${days.map((d) => d.slice(5)).join(" ")}\n`);

  // Derived rates over the same window (anonymous counters, so these are rates of sessions and cards, not of people).
  const total = (kind: string) => counters.filter((c) => c.kind === kind).reduce((a, c) => a + Number(c.count), 0);
  console.log("Rates");
  console.log(`  sessions with a favourite: ${total("follows_active")} of ${total("session")} (${pct(total("follows_active"), total("session"))})`);
  console.log(`  For You strip click rate:  ${total("for_you_strip_clicked")} of ${total("for_you_strip_shown")} (${pct(total("for_you_strip_clicked"), total("for_you_strip_shown"))})`);
  console.log(`  one-tap follow rate:       ${total("quick_pick_followed")} follows from ${total("quick_picks_shown")} chip views (${pct(total("quick_pick_followed"), total("quick_picks_shown"))})`);
  console.log(`  article follow rate:       ${total("article_follow_added")} follows from ${total("article_follow_shown")} article sessions (${pct(total("article_follow_added"), total("article_follow_shown"))})`);
  console.log(`  prediction pick rate:    ${total("prediction_vote")} picks of ${total("prediction_shown")} cards shown (${pct(total("prediction_vote"), total("prediction_shown"))})`);
  console.log(`  rating rate:               ${total("match_rating")} ratings of ${total("rating_shown")} cards shown (${pct(total("match_rating"), total("rating_shown"))})\n`);

  // 2. Return rates from FanVisit: of visitors first seen on day X, how many came back.
  const [{ visitors }] = await q<{ visitors: string }>(`select count(distinct "voterId") visitors from "FanVisit" where day >= $1`, [since]);
  const cohort = await q<{ d1: string; d7: string; total: string }>(
    `with first as (select "voterId", min(day) first_day from "FanVisit" group by 1 having min(day) >= $1)
     select count(*) total,
       count(*) filter (where exists (select 1 from "FanVisit" v where v."voterId" = f."voterId" and v.day::date = f.first_day::date + 1)) d1,
       count(*) filter (where exists (select 1 from "FanVisit" v where v."voterId" = f."voterId" and v.day::date between f.first_day::date + 1 and f.first_day::date + 7)) d7
     from first f where first_day::date <= current_date - 7`,
    [since],
  );
  console.log("Visitors (counted fans)");
  console.log(`  distinct visitors: ${visitors}`);
  const c = cohort[0];
  console.log(`  cohort first seen >=7 days ago: ${c.total}  came back next day: ${c.d1} (${pct(Number(c.d1), Number(c.total))})  within 7 days: ${c.d7} (${pct(Number(c.d7), Number(c.total))})`);
  const dist = await q<{ days: string; n: string }>(
    `select days, count(*) n from (select "voterId", count(*) days from "FanVisit" where day >= $1 group by 1) t group by 1 order by 1`,
    [since],
  );
  console.log(`  visitors by days active: ${dist.map((r) => `${r.days}d:${r.n}`).join("  ") || "none yet"}\n`);

  // 3. Predictions: participation, repeat players, hit rate.
  const [pred] = await q<{ polls: string; resolved: string; voided: string }>(
    `select count(*) polls, count(*) filter (where "resolvedOptionId" is not null) resolved,
            count(*) filter (where "resolvedAt" is not null and "resolvedOptionId" is null) voided
     from "Poll" where kind = 'prediction' and "createdAt" >= $1`,
    [since],
  );
  const [picks] = await q<{ picks: string; players: string; correct: string; decided: string }>(
    `select count(*) picks, count(distinct v."cookieId") players,
            count(*) filter (where p."resolvedOptionId" = v."optionId") correct,
            count(*) filter (where p."resolvedOptionId" is not null) decided
     from "PollVote" v join "Poll" p on p.id = v."pollId" where p.kind = 'prediction' and v."createdAt" >= $1`,
    [since],
  );
  const repeat = await q<{ players: string; repeat_days: string; repeat_polls: string }>(
    `select count(*) players,
            count(*) filter (where d >= 2) repeat_days,
            count(*) filter (where n >= 2) repeat_polls
     from (select v."cookieId", count(distinct v."createdAt"::date) d, count(*) n
           from "PollVote" v join "Poll" p on p.id = v."pollId"
           where p.kind = 'prediction' and v."createdAt" >= $1 group by 1) t`,
    [since],
  );
  console.log("Predictions");
  console.log(`  polls opened: ${pred.polls}  resolved: ${pred.resolved}  voided: ${pred.voided}`);
  console.log(`  picks: ${picks.picks}  distinct players: ${picks.players}  hit rate on decided picks: ${pct(Number(picks.correct), Number(picks.decided))}`);
  console.log(`  repeat players: on 2+ different days ${repeat[0].repeat_days} (${pct(Number(repeat[0].repeat_days), Number(repeat[0].players))}), on 2+ matches ${repeat[0].repeat_polls}`);

  const [poll] = await q<{ avg: string }>(
    `select round(avg(n)::numeric, 1) avg from (select count(*) n from "PollVote" v join "Poll" p on p.id = v."pollId" where p.kind = 'prediction' and v."createdAt" >= $1 group by v."pollId") t`,
    [since],
  );
  console.log(`  average picks per predicted match: ${poll?.avg ?? "0"}\n`);

  // 4. Feedback: match ratings, private notes, Fan Voices queue.
  const [rate] = await q<{ n: string; raters: string; avg: string | null }>(
    `select count(*) n, count(distinct "voterId") raters, round(avg(rating)::numeric, 2) avg from "MatchRating" where "createdAt" >= $1`,
    [since],
  );
  const [rated] = await q<{ matches: string }>(`select count(distinct "articleId") matches from "MatchRating" where "createdAt" >= $1`, [since]);
  console.log("Ratings");
  console.log(`  ratings: ${rate.n} from ${rate.raters} fans on ${rated.matches} matches, average ${rate.avg ?? "n/a"}\n`);

  const [fb] = await q<{ up: string; down: string; notes: string; unread: string }>(
    `select count(*) filter (where sentiment = 'up') up, count(*) filter (where sentiment = 'down') down,
            count(*) filter (where note is not null) notes, count(*) filter (where not handled) unread
     from "SiteFeedback" where "createdAt" >= $1`,
    [since],
  );
  console.log("Site feedback");
  console.log(`  thumbs up: ${fb.up}  thumbs down: ${fb.down}  with a note: ${fb.notes}  unread: ${fb.unread}\n`);

  const [fv] = await q<{ pending: string; approved: string; rejected: string }>(
    `select count(*) filter (where status = 'pending') pending, count(*) filter (where status = 'approved') approved,
            count(*) filter (where status = 'rejected') rejected from "FanVoice" where "createdAt" >= $1`,
    [since],
  );
  console.log("Fan Voices");
  console.log(`  pending review: ${fv.pending}  approved: ${fv.approved}  rejected: ${fv.rejected}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
