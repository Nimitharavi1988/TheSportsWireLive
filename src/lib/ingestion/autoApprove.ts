import { db } from "@/db";
import { article, socialPost } from "@/db/schema";
import { eq, and, inArray, gte, lt, count, desc } from "drizzle-orm";
import { submitToIndexNow, articleUrl } from "../indexNow";
import { isMatchDataSource } from "../matchDataSources";
import { isHighlightWorthy } from "../highlightWorthy";
import { postArticleToFacebook } from "../social/facebook";
import { postInstagramPoster } from "../social/postInstagramPoster";
import { isSimilarToAny } from "../titleSimilarity";
import { MIN_BODY_LENGTH, MIN_MATCH_DATA_BODY_LENGTH, hasRealImage, isAutoApprovable } from "../contentQuality";

// Runs as a follow-up step right after runIngest.ts in the same GitHub
// Actions job — everything reaching "pending_review" has already passed
// every automated quality gate (profanity, spam-ID, reference-page,
// non-news-filler, stale-age — see qualityCheck.ts/playerNewsFeeds.ts),
// so this adds one more bar on top rather than replacing human review with
// nothing: real substantive body content AND a real (non-generic) image.
// The actual bar (MIN_BODY_LENGTH, hasRealImage, isAutoApprovable) now
// lives in contentQuality.ts, shared with admin/actions.ts's bulk-approve
// paths — see that file's header for why.
// isHighlightWorthy alone isn't a real volume filter here — confirmed live:
// 412 of 592 pending items (70%) passed it, since SUPERSTAR_SEARCH_TERMS
// now spans ~150 players across 5 sports and EVENT_KEYWORDS catches common
// words ("record", "history"). Fine for a homepage sidebar module (one of
// several, generous inclusion is fine); posting 70% of a run's approvals to
// the Page would still flood it. Capped to the top N by trendingScore among
// the isHighlightWorthy set instead — a real per-run volume ceiling, not
// just a topical filter.
// Temporarily raised from 5 — Facebook's real-link fix (socialPoster.ts)
// needs a volume boost to help recover traffic while it takes effect. The
// daily total is still capped by MAX_FACEBOOK_POSTS_PER_DAY below, so this
// only lets a single run post more within that same overall budget, not
// exceed it. Revert to 5 once traffic recovers.
const MAX_FACEBOOK_POSTS_PER_RUN = 10;
// Temporary traffic-recovery boost (explicit request, 2026-09-16): guarantee
// at least 5 attempts per run instead of the usual paced-down floor of 1,
// so volume picks up noticeably for a while. Still bounded by
// MAX_FACEBOOK_POSTS_PER_DAY via remainingToday below — this can't exceed
// the daily budget, it just front-loads more of it into each run instead of
// spreading it evenly, so a day now gets ~10 hours of elevated posting
// before the daily cap runs out rather than a flat trickle all day. Revert
// to 1 once traffic recovers (see paceTarget below).
const MIN_FACEBOOK_POSTS_PER_RUN = 5;
// Raised 199 -> 260 (2026-09-19, explicit request): 199 was never a real
// Facebook-specific limit — it was borrowed defensively from Instagram's
// ~200/hour app-level ballpark back when this cap gated both platforms'
// shared selection; Facebook and Instagram now pick and pace independently
// (see fbPool/igPool below), and the Graph API has no published daily quota
// for Page posts the way Instagram's content_publishing_limit does. Actual
// usage was topping out around 149-150/day, well under the old cap, so this
// gives real headroom for a busier news day rather than raising a limit
// that was already binding. The real risk at higher frequency isn't an API
// block, it's Meta's own reach/spam throttling quietly reducing how far
// each post travels — a soft, unmeasurable-in-advance risk, which is why
// this is a modest bump rather than a much larger one.
const MAX_FACEBOOK_POSTS_PER_DAY = 260;
// Confirmed live against this account's own quota (GET
// /{ig-user-id}/content_publishing_limit on 2026-09-15): quota_total is 100
// posts per rolling 24-hour window, not the commonly-cited-but-outdated 25,
// and not the unrelated ~200/hour figure (that's the general Graph API call
// rate limit, not a content-publishing cap). 95 leaves a small buffer
// instead of risking a request that trips the real 100 cap. The old flat "2
// attempts per run, stop at first success" cap left whole days silent (0
// posts on 2026-09-15) whenever those particular runs had no eligible
// candidate or hit a transient failure — pacing this the same way as
// Facebook (below) fixes that.
const MAX_INSTAGRAM_POSTS_PER_DAY = 95;
// Ceiling on ATTEMPTS within a single run (not just successes) — each
// attempt is a full Gemini content-generation call plus a real git
// commit/push/deploy-wait cycle, far more expensive than Facebook's plain
// post, so this bounds cost even while a run is catching up to pace.
const MAX_INSTAGRAM_POSTS_PER_RUN = 3;
// Every ~15-min cron run in a day — used to PACE the daily budget evenly
// across all 24 hours instead of letting it front-load into whichever
// hours happen to have the most eligible content. Confirmed live: a flat
// per-run cap with only a total daily ceiling let 300 posts land by 16:54
// UTC some days, leaving the rest of the day silent even before the "floor
// of 1" fix — that's the opposite of "one per interval, all day."
const RUNS_PER_DAY = 96;
const RUNS_PER_HOUR = RUNS_PER_DAY / 24;
// Relative audience-activity weight per UTC hour. Re-centered 2026-09-20
// (explicit correction: most viewers are actually US-based, not the
// US+Europe+India blend this was originally built around) on the union of
// all four continental US time zones' waking hours (ET/CT/PT dominate by
// population, MT included), peaking where ET+CT+PT are simultaneously in
// their evening prime-time window (roughly 6pm-11pm local, which staggers
// across UTC 22:00-04:00 given the 3-hour ET-to-PT spread), troughing
// during the dead-of-night window with nobody awake in any US zone
// (roughly UTC 06:00-10:00, i.e. ET 2-6am through PT overnight). Still a
// heuristic, not measured against this Page's own Facebook Insights — the
// account doesn't have enough volume yet for that to be statistically
// meaningful. Replace with real "when our fans are online" data (with a
// real country breakdown) from Page Insights once it does.
// Confirmed real secondary audiences (2026-09-20): Sweden (UTC+2) and
// Ireland (UTC+1) both have real viewers, India confirmed LOW despite this
// site's heavy cricket coverage — no India-specific term needed here as a
// result (the curve below is pure US-timezone-derived). Sweden/Ireland's
// own evening hours (~18:00-23:00 local) land around UTC 16:00-22:00,
// which this curve already weights moderately-to-highly since that's the
// same window the US East/Central population is hitting midday-into-
// evening — no separate adjustment needed for them either.
// Index 0 = 00:00-00:59 UTC, ... index 23 = 23:00-23:59 UTC.
const HOURLY_ENGAGEMENT_WEIGHT: number[] = [
  0.95, 1.0, 1.0, 0.95, 0.85, 0.6, 0.4, 0.2, // 00-07 UTC (ET/CT/PT evening peak tapering into overnight)
  0.15, 0.15, 0.2, 0.3, 0.4, 0.45, 0.5, 0.55, // 08-15 UTC (dead of night across the US, then ET/CT/MT/PT waking in sequence)
  0.65, 0.7, 0.7, 0.72, 0.75, 0.8, 0.88, 0.95, // 16-23 UTC (US midday/lunch across zones rising into ET/CT evening)
];
// Bug fixed 2026-09-19: this must be the total across all RUNS_PER_DAY runs
// (each hour contributes RUNS_PER_HOUR times, not once), matching what
// weightedRunsElapsed(RUNS_PER_DAY) actually sums to below — using the raw
// 24-value sum here made expectedByNow race ~4x ahead of the real day
// fraction, correcting itself only because remainingToday/MAX_FACEBOOK_POSTS_PER_RUN
// still capped the actual runCap; harmless so far since the daily cap was
// never truly hit, but wrong and worth fixing before it does bite.
const TOTAL_HOURLY_WEIGHT = HOURLY_ENGAGEMENT_WEIGHT.reduce((sum, w) => sum + w, 0) * RUNS_PER_HOUR;
// Sum of weights for every run from the start of the day up through (not
// including) runIndex — same shape as the old flat "currentRunIndex /
// RUNS_PER_DAY" fraction, just weighted by how active the audience actually
// is in each of those hours instead of treating every hour as equal.
function weightedRunsElapsed(runIndex: number): number {
  let sum = 0;
  for (let i = 0; i < runIndex; i++) {
    sum += HOURLY_ENGAGEMENT_WEIGHT[Math.floor(i / RUNS_PER_HOUR) % 24];
  }
  return sum;
}
// Cricket's reserved slot, plus one each for hockey and formula-1 (added
// 2026-09-16). These needed a reserved slot for a different reason than
// cricket originally did: their titles ("Canada W 3-0 Nicaragua W", "Ferrari
// not yet switching...") essentially never contain a tracked
// SUPERSTAR_SEARCH_TERMS name or an EVENT_KEYWORDS trigger word
// (transfer/record/etc — see highlightWorthy.ts), so without a reserved slot
// they'd never once clear isHighlightWorthy and would never reach
// Facebook/Instagram at all, no matter how much real content ingestion
// produced for them. Domestic football leagues (Bundesliga/Serie A/etc,
// still category "football") aren't reserved here — they compete in the
// normal football pool, same as before; only genuinely new categories
// needed this.
//
// Volleyball deliberately NOT reserved (removed 2026-09-19, explicit
// request): its only remaining source is ESPN's US college feed
// (espnVolleyballData.ts, NCAA men's/women's volleyball) after the
// international API-Sports volleyball account was suspended, so a
// guaranteed slot here meant every volleyball post to the Page was
// specifically an NCAA score preview — low relevance for a global sports
// audience. Volleyball articles still publish to the site normally; they
// just no longer get a guaranteed Facebook/Instagram slot. The freed slot
// now falls through to `eligible` below like any non-reserved category, so
// it's naturally filled by whichever real, trending cricket/football/
// american-football/etc story ranks best instead.
const RESERVED_CATEGORIES: { category: string; slots: number }[] = [
  { category: "cricket", slots: 1 },
  { category: "hockey", slots: 1 },
  { category: "formula-1", slots: 1 },
];

// How far back the social-posting candidate pool looks for published,
// not-yet-posted articles — see the pool-building comment below for why
// this exists at all. 3 days matches runIngest.ts's own staleness window
// for the same reasoning: old enough to give a real backlog to draw from,
// not so old that a week-old story starts appearing as "new" on the Page.
const SOCIAL_BACKLOG_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;


export async function autoApproveValidArticles(): Promise<{ checked: number; approved: number }> {
  const candidates = await db.select({
    id: article.id, slug: article.slug, title: article.title, body: article.body,
    heroImageUrl: article.heroImageUrl, homeCrestUrl: article.homeCrestUrl,
    playerNewsSourced: article.playerNewsSourced, sourceName: article.sourceName,
    trendingScore: article.trendingScore, category: article.category,
  }).from(article).where(eq(article.status, "pending_review"));

  const toApprove = candidates.filter(isAutoApprovable);

  if (toApprove.length > 0) {
    await db.update(article)
      // publishedAt deliberately NOT set — it already holds the article's
      // real-world publish date from ingestion. See approveArticle in
      // admin/actions.ts for the full reasoning (same bug this once was).
      .set({ status: "published", updatedAt: new Date() })
      .where(inArray(article.id, toApprove.map((a) => a.id)));

    // Best-effort, same isolation principle as the Facebook post below —
    // a failed ping here should never affect publishing.
    await submitToIndexNow(toApprove.map((a) => articleUrl(a.slug)));
  }

  // Social-posting candidate pool: NOT scoped to just-approved toApprove
  // articles above. Confirmed live: several runs auto-approve only 1-3 new
  // articles, so even with runCap allowing 5-10 posts, there was structurally
  // never more than 1-3 candidates to pick from — "1 post per run" was the
  // real ceiling, not a bug in the pacing math. This pool instead covers
  // every published article from the last SOCIAL_BACKLOG_WINDOW_MS that
  // doesn't already have a posted/queued row for that platform, so the
  // pacing logic below actually has enough real candidates to hit its
  // per-run target most runs. Runs even when toApprove is empty.
  type SocialCandidate = { id: string; slug: string; title: string; trendingScore: number; category: string; sourceName: string };
  const backlogCutoff = new Date(Date.now() - SOCIAL_BACKLOG_WINDOW_MS);
  // Separate, much shorter window than the already-posted exclusion above —
  // "don't post the same real-world event twice" is a same-day problem (a
  // Salah hat-trick recap from 4 different outlets all landing within
  // hours), not something that should keep suppressing a candidate for 3
  // full days the way a genuine repost would.
  const SIMILARITY_WINDOW_MS = 24 * 60 * 60 * 1000;
  const similarityCutoff = new Date(Date.now() - SIMILARITY_WINDOW_MS);
  const [backlogPool, fbPostedRows, igPostedRows, fbRecentTitleRows, igRecentTitleRows] = await Promise.all([
    db.select({
      id: article.id, slug: article.slug, title: article.title,
      trendingScore: article.trendingScore, category: article.category, sourceName: article.sourceName,
    }).from(article)
      .where(and(eq(article.status, "published"), gte(article.publishedAt, backlogCutoff)))
      .orderBy(desc(article.trendingScore))
      .limit(300),
    // Deliberately NO backlogCutoff here (unlike backlogPool above) — a real
    // bug found live 2026-09-20: this used to be windowed to the same 3-day
    // cutoff, so an article posted to Facebook/Instagram MORE than 3 days
    // ago fell out of this exclusion set and became "eligible" again,
    // getting picked as a candidate, silently no-op'd by
    // postArticleToFacebook's own permanent (unwindowed) idempotency guard,
    // then logged as a fresh "posted" success even though nothing new
    // actually reached the Page. Confirmed live: exactly this happened to a
    // manual run's hockey reserved-category pick (a real post from 4 days
    // earlier, re-selected and silently skipped). A post, once made, should
    // never be re-selected as a candidate — no reason to time-bound this.
    db.select({ articleId: socialPost.articleId }).from(socialPost)
      .where(and(eq(socialPost.platform, "facebook"), inArray(socialPost.status, ["posted", "queued"]))),
    db.select({ articleId: socialPost.articleId }).from(socialPost)
      .where(and(eq(socialPost.platform, "instagram"), inArray(socialPost.status, ["posted", "queued"]))),
    // Same-event dedup: titles of everything actually posted in the last 24h,
    // used to keep a same-day near-duplicate (different source, same real
    // story) from also reaching the Page — see titleSimilarity.ts.
    db.select({ title: article.title }).from(socialPost)
      .innerJoin(article, eq(socialPost.articleId, article.id))
      .where(and(eq(socialPost.platform, "facebook"), eq(socialPost.status, "posted"), gte(socialPost.postedAt, similarityCutoff))),
    db.select({ title: article.title }).from(socialPost)
      .innerJoin(article, eq(socialPost.articleId, article.id))
      .where(and(eq(socialPost.platform, "instagram"), eq(socialPost.status, "posted"), gte(socialPost.postedAt, similarityCutoff))),
  ]);
  const fbPostedIds = new Set(fbPostedRows.map((r) => r.articleId));
  const igPostedIds = new Set(igPostedRows.map((r) => r.articleId));
  const fbRecentTitles = fbRecentTitleRows.map((r) => r.title);
  const igRecentTitles = igRecentTitleRows.map((r) => r.title);

  const freshCandidates: SocialCandidate[] = toApprove.map((a) => ({
    id: a.id, slug: a.slug, title: a.title, trendingScore: a.trendingScore, category: a.category, sourceName: a.sourceName,
  }));
  const freshIds = new Set(freshCandidates.map((a) => a.id));
  const backlogExcludingFresh = backlogPool.filter((a) => !freshIds.has(a.id));

  // Picks the top N respecting RESERVED_CATEGORIES, same ranking both
  // platforms use. Takes its candidate pool as a parameter (not closed
  // over) so Facebook and Instagram — which now have independent
  // already-posted exclusions, not just independent pace targets — each
  // get their own pool instead of silently sharing one.
  //
  // Reserved-category picks are pulled from `byTrending` (every candidate),
  // NOT `eligible` (the isHighlightWorthy-filtered subset) — confirmed live
  // that hockey/volleyball/formula-1 content essentially never clears
  // isHighlightWorthy on its own (see RESERVED_CATEGORIES comment above),
  // so sourcing reserved slots from `eligible` would make the "reservation"
  // meaningless for them: a guaranteed slot that never actually gets
  // filled. Cricket's reserved slot picks up the same change, which only
  // widens what can fill it — matches the "reserved" name's own intent (a
  // guarantee, not a conditional one).
  // recentTitles seeds the same-event dedup (see titleSimilarity.ts) — a
  // candidate whose title significantly overlaps with something already
  // posted in the last 24h, OR with something this very call already picked
  // (chosenTitles grows as slots fill), is skipped. Growing the seed list
  // as picks happen matters just as much as the historical seed: two
  // near-duplicate FRESH candidates can both show up as "new" in the same
  // run (e.g. two outlets' recaps of the same match ingested minutes apart).
  function selectTopN(n: number, byTrending: SocialCandidate[], eligible: SocialCandidate[], recentTitles: string[]): SocialCandidate[] {
    const selected: SocialCandidate[] = [];
    const chosenTitles = [...recentTitles];
    function tryAdd(a: SocialCandidate): boolean {
      if (selected.length >= n || selected.includes(a)) return false;
      // Real bug found live 2026-09-20, hours after this shipped: a bare
      // match-data template ("Colorado Rockies 4-5 Seattle Mariners") has
      // only 3-4 significant words total, so sharing just the 2 team names
      // with ANY other headline mentioning either team that day (extremely
      // common — a team plays many games/gets many mentions) produced a
      // >=0.5 overlap coefficient and got wrongly skipped as a "duplicate."
      // Confirmed live: every one of 96 fresh candidates in one run was
      // blocked this way, a full Facebook posting stall. Match-data
      // articles don't have the problem this check exists for in the first
      // place — the "same real event covered by many outlets" scenario
      // (isSimilarToAny's actual target) can't happen for them, since each
      // is already a single canonical article for a unique real match
      // (deduped at ingestion by the match's own stable id, see dedupe.ts)
      // rather than independently-written editorial coverage. Skip the
      // check entirely for them instead of trying to tune the threshold —
      // short-title false positives are a structural mismatch with this
      // heuristic, not a threshold calibration issue.
      if (!isMatchDataSource(a.sourceName) && isSimilarToAny(a.title, chosenTitles)) return false;
      selected.push(a);
      chosenTitles.push(a.title);
      return true;
    }
    for (const { category, slots } of RESERVED_CATEGORIES) {
      const matches = byTrending.filter((a) => a.category === category);
      let added = 0;
      for (const article of matches) {
        if (added >= slots) break;
        if (tryAdd(article)) added++;
      }
    }
    for (const article of eligible) {
      if (selected.length >= n) break;
      tryAdd(article);
    }
    // Fallback for categories that structurally almost never clear
    // isHighlightWorthy — the same fix already shipped for page.tsx's
    // "Transfers & Big News" section (see highlightFallbackPicks there):
    // confirmed live 2026-09-20 that rugby/athletics sit at near-zero daily
    // volume specifically because isHighlightWorthy only matches
    // EVENT_KEYWORDS or a TRACKED_PLAYERS name, and those categories have
    // neither. RESERVED_CATEGORIES above already guarantees a slot for
    // cricket/hockey/formula-1, but that's a fixed list — this instead
    // falls back to the best remaining fresh candidates by trending score,
    // regardless of category, whenever the eligible set alone doesn't fill
    // the run's slots. A no-op for football/cricket, which already have
    // plenty of eligible matches; the only real effect is that a
    // low-volume category's real content can now reach a run's remaining
    // slots instead of the run simply posting fewer than its own cap.
    for (const article of byTrending) {
      if (selected.length >= n) break;
      tryAdd(article);
    }
    return selected;
  }

  // Unlike the admin UI's bulk approveArticles/approveAllMatching (which
  // skip Facebook entirely — a human selecting dozens of items at once
  // isn't asking for dozens of Page posts), this IS the dominant approval
  // path now, so skipping it here meant most published content never
  // reached Facebook at all. isHighlightWorthy narrows to topically
  // notable stories, then trendingScore picks the real best of that set,
  // capped at MAX_FACEBOOK_POSTS_PER_RUN — the actual volume ceiling.
  // Sequential + best-effort per article: one failed/rate-limited post
  // must never affect another.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const [{ value: postedToday }] = await db.select({ value: count() }).from(socialPost)
    .where(and(eq(socialPost.platform, "facebook"), gte(socialPost.createdAt, todayStart)));
  const remainingToday = Math.max(0, MAX_FACEBOOK_POSTS_PER_DAY - postedToday);

  // Paced allocation: how many posts SHOULD have gone out by this point in
  // the day, proportional to how many of today's 96 runs have elapsed —
  // e.g. 2 hours (8 runs) into the day, ~8/96ths of 199 (~17) is the
  // target, not the full 199 all at once. Without this, a burst of
  // eligible content early in the day front-loads the whole daily budget
  // and leaves the rest of the day silent — confirmed live with the old
  // flat-cap approach (300 posts landed by 16:54 UTC some days). Floored
  // at 1 so a run always attempts at least one post even when already on
  // or ahead of pace, matching the earlier "never go fully silent" fix.
  const now = new Date();
  const minutesSinceMidnight = (now.getTime() - todayStart.getTime()) / 60000;
  const currentRunIndex = Math.min(RUNS_PER_DAY, Math.floor(minutesSinceMidnight / 15) + 1);
  const currentHourWeight = HOURLY_ENGAGEMENT_WEIGHT[now.getUTCHours()];
  const expectedByNow = Math.round(
    (MAX_FACEBOOK_POSTS_PER_DAY * weightedRunsElapsed(currentRunIndex)) / TOTAL_HOURLY_WEIGHT
  );
  // The per-run floor scales with the current hour's weight too — peak
  // hours keep the full MIN_FACEBOOK_POSTS_PER_RUN floor, low-activity
  // hours (e.g. ~03:00-07:00 UTC) taper down to as little as 1-2, instead of
  // guaranteeing the same 5-per-run floor around the clock regardless of
  // whether anyone's actually likely to see it.
  const runFloor = Math.max(1, Math.round(MIN_FACEBOOK_POSTS_PER_RUN * currentHourWeight));
  const paceTarget = Math.max(runFloor, expectedByNow - postedToday);

  const runCap = Math.max(1, Math.min(MAX_FACEBOOK_POSTS_PER_RUN, remainingToday, paceTarget));

  const fbPool = [...freshCandidates, ...backlogExcludingFresh.filter((a) => !fbPostedIds.has(a.id))]
    .filter((a) => a.category !== "volleyball");
  const fbByTrending = [...fbPool].sort((a, b) => b.trendingScore - a.trendingScore);
  const fbEligible = fbByTrending.filter((a) => isHighlightWorthy(a.title));
  const toPost = selectTopN(runCap, fbByTrending, fbEligible, fbRecentTitles);

  // Diagnostic logging — added 2026-09-20 after repeated reports of
  // multi-run Facebook posting silence (0 posts across several consecutive
  // "success" GitHub Actions runs) that DB-side inspection alone couldn't
  // explain: the candidate pool, daily cap, and pacing numbers all looked
  // healthy every time this was checked after the fact. This makes the
  // actual decision inputs visible in the GitHub Actions run log itself
  // (Settings -> Actions -> this workflow run's "autoApprove.ts" step),
  // viewable directly without needing API/log-download access.
  console.log(
    `[facebook] postedToday=${postedToday} remainingToday=${remainingToday} runFloor=${runFloor} paceTarget=${paceTarget} runCap=${runCap} fbPool=${fbPool.length} fbEligible=${fbEligible.length} toPost=${toPost.length}`
  );

  // Same pacing model as Facebook's runCap above, but budgeted against
  // Instagram's own daily cap and counting only actual successful
  // publishes (status "posted") — a failed/rate-limited attempt doesn't
  // consume Meta's real 100/day limit, so it shouldn't consume ours either.
  const [{ value: instagramPostedToday }] = await db.select({ value: count() }).from(socialPost)
    .where(and(eq(socialPost.platform, "instagram"), eq(socialPost.status, "posted"), gte(socialPost.postedAt, todayStart)));
  const instagramRemainingToday = Math.max(0, MAX_INSTAGRAM_POSTS_PER_DAY - instagramPostedToday);
  const instagramExpectedByNow = Math.round(
    (MAX_INSTAGRAM_POSTS_PER_DAY * weightedRunsElapsed(currentRunIndex)) / TOTAL_HOURLY_WEIGHT
  );
  // Same temporary traffic-recovery boost as Facebook (2026-09-16), but a
  // lower base floor (2, not 5) — confirmed live that Instagram's real
  // 100/day cap means a 5/run floor would burn the whole daily budget in ~5
  // hours then go fully silent the rest of the day. Same peak-hour weighting
  // as Facebook's runFloor above: full floor of 2 at peak hours, tapering to
  // 1 in low-activity hours. Still hard-bounded by instagramRemainingToday
  // below, same safety property as Facebook. Revert to 1 once traffic
  // recovers.
  const instagramRunFloor = Math.max(1, Math.round(2 * currentHourWeight));
  const instagramPaceTarget = Math.max(instagramRunFloor, instagramExpectedByNow - instagramPostedToday);
  const instagramRunCap = Math.max(
    0,
    Math.min(MAX_INSTAGRAM_POSTS_PER_RUN, instagramRemainingToday, instagramPaceTarget)
  );
  const igPool = [...freshCandidates, ...backlogExcludingFresh.filter((a) => !igPostedIds.has(a.id))]
    .filter((a) => a.category !== "volleyball");
  const igByTrending = [...igPool].sort((a, b) => b.trendingScore - a.trendingScore);
  const igEligible = igByTrending.filter((a) => isHighlightWorthy(a.title));
  const instagramCandidates = selectTopN(instagramRunCap, igByTrending, igEligible, igRecentTitles);

  // Facebook is back to its original plain format (the old auto-link-card
  // post, not the generated poster) per explicit request - the comment-
  // link permission it would have unlocked isn't needed after all, and a
  // single plain API call is cheap enough to attempt for every candidate
  // here, same as before the poster work started.
  for (const article of toPost) {
    try {
      const posted = await postArticleToFacebook(article.id);
      console.log(
        posted
          ? `[facebook] posted article ${article.id} ("${article.title.slice(0, 60)}")`
          : `[facebook] skipped article ${article.id} (already posted previously)`
      );
    } catch (err) {
      console.error("Facebook post failed for article", article.id, err);
    }
  }

  // Instagram still uses the generated poster (socialPoster.ts) - a
  // Gemini call plus a real git commit/push/deploy-poll per attempt, far
  // more expensive than Facebook's plain post above. Paced against its
  // own daily budget (instagramRunCap, above) rather than the old flat
  // "2 attempts" cap, and stops as soon as one succeeds within the run —
  // no need to spend more of this run's already-paced budget once that
  // run's slot is filled.
  let instagramAttempts = 0;
  let instagramDone = false;
  for (const article of instagramCandidates) {
    if (instagramDone || instagramAttempts >= instagramRunCap) break;
    instagramAttempts++;
    try {
      const posted = await postInstagramPoster(article.id);
      if (posted) instagramDone = true;
    } catch (err) {
      console.error("Instagram post failed for article", article.id, err);
      // A persistent app-level rate-limit error fails identically for
      // every article — stop immediately rather than spending the
      // remaining attempt on the same guaranteed failure.
      if (err instanceof Error && err.message.includes("Application request limit reached")) {
        instagramDone = true;
      }
    }
  }

  return { checked: candidates.length, approved: toApprove.length };
}

// A pending_review article missing a real image isn't necessarily dead on
// arrival the way a genuinely-failed commentary attempt is — a later
// duplicate-refresh could still find one (see runIngest.ts), so this can't
// be caught definitively at ingestion time the way the thin-body case was.
// Confirmed live: 1,036 of 1,059 pending articles (98%) were stuck purely
// on this, with the oldest over 5 days old and no sign of ever resolving
// — real content, just permanently short a real photo for most of these
// (many tracked athletes simply have no freely-licensed photo available).
// Giving every item a real window to still get one, then rejecting what
// hasn't, keeps the queue from growing unbounded while still giving
// genuine retries a fair chance first.
// Shortened 3 days -> 12 hours (explicit request, 2026-09-20): the queue
// was accumulating too much dead weight for too long. 12 hours is still
// ~48 ingestion cron cycles (every 15 min) — real retry room for an item
// that's genuinely still in flight — without leaving unqualified content
// sitting in the review queue for days. Not shortened further/to zero:
// most pending_review items without a body yet haven't had a commentary
// attempt AT ALL (MAX_COMMENTARY_PER_RUN budget-limited, see runIngest.ts)
// rather than having failed one — a genuinely failed attempt is already
// rejected same-run by runIngest.ts itself, so this window exists purely
// to give budget-queued items their turn, not to protect bad content.
export const STALE_NO_IMAGE_HOURS = 12;

export async function rejectStaleNoImageArticles(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_NO_IMAGE_HOURS * 60 * 60 * 1000);
  const candidates = await db.select({ id: article.id, heroImageUrl: article.heroImageUrl, homeCrestUrl: article.homeCrestUrl })
    .from(article).where(and(eq(article.status, "pending_review"), lt(article.createdAt, cutoff)));
  const staleIds = candidates.filter((a) => !hasRealImage(a)).map((a) => a.id);
  if (staleIds.length === 0) return 0;

  await db.update(article).set({ status: "rejected", updatedAt: new Date() }).where(inArray(article.id, staleIds));
  return staleIds.length;
}

// Mirror of rejectStaleNoImageArticles above, for the other half of
// isAutoApprovable's bar — added 2026-09-20 (explicit request, confirmed
// live: 1,222 of 2,139 pending articles were stuck purely on a missing/
// too-short body, oldest over 4 days, no automatic disposition existed for
// this case the way the image side already had one). Same reasoning and
// same shortened window (3 days -> 12 hours, 2026-09-20): budget-starved
// items (never got a real commentary attempt at all — see runIngest.ts's
// per-run Gemini budget) vs. genuinely failed attempts (already rejected
// immediately by runIngest.ts's own retry-path check) are indistinguishable
// from outside, so this still gives every item a real window (~48 cron
// cycles) before concluding it's not going to get a body, rather than
// rejecting on the very run it was ingested.
export const STALE_NO_BODY_HOURS = 12;

export async function rejectStaleNoBodyArticles(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_NO_BODY_HOURS * 60 * 60 * 1000);
  const candidates = await db.select({ id: article.id, body: article.body, sourceName: article.sourceName })
    .from(article).where(and(eq(article.status, "pending_review"), lt(article.createdAt, cutoff)));
  const staleIds = candidates
    .filter((a) => {
      const minLength = isMatchDataSource(a.sourceName) ? MIN_MATCH_DATA_BODY_LENGTH : MIN_BODY_LENGTH;
      return !(a.body && a.body.trim().length >= minLength);
    })
    .map((a) => a.id);
  if (staleIds.length === 0) return 0;

  await db.update(article).set({ status: "rejected", updatedAt: new Date() }).where(inArray(article.id, staleIds));
  return staleIds.length;
}

if (require.main === module) {
  autoApproveValidArticles()
    .then(async ({ checked, approved }) => {
      console.log(`Auto-approve: ${approved} of ${checked} pending articles met the bar (real image + body >= ${MIN_BODY_LENGTH} chars, or >= ${MIN_MATCH_DATA_BODY_LENGTH} for match-data sources).`);
      const rejectedNoImage = await rejectStaleNoImageArticles();
      console.log(`Rejected ${rejectedNoImage} pending articles still with no real image after ${STALE_NO_IMAGE_HOURS}+ hours.`);
      const rejectedNoBody = await rejectStaleNoBodyArticles();
      console.log(`Rejected ${rejectedNoBody} pending articles still with no real body after ${STALE_NO_BODY_HOURS}+ hours.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Auto-approve run failed:", err);
      process.exit(1);
    });
}
