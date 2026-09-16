import { db } from "../db";
import { submitToIndexNow, articleUrl } from "../indexNow";
import { isMatchDataSource } from "../matchDataSources";
import { isHighlightWorthy } from "../highlightWorthy";
import { postArticleToFacebook } from "../social/facebook";
import { postInstagramPoster } from "../social/postInstagramPoster";

// Runs as a follow-up step right after runIngest.ts in the same GitHub
// Actions job — everything reaching "pending_review" has already passed
// every automated quality gate (profanity, spam-ID, reference-page,
// non-news-filler, stale-age — see qualityCheck.ts/playerNewsFeeds.ts),
// so this adds one more bar on top rather than replacing human review with
// nothing: real substantive body content AND a real (non-generic) image.
// Deliberately conservative thresholds — this is a genuine policy change
// (some content now ships without a human looking at it first), so it
// should only fire for articles that are unambiguously "as good as this
// pipeline gets," not merely "technically has some text."
// Raised from 150 — confirmed live that a couple of thin sentences was
// clearing the old bar even for genuinely low-value articles (compounded
// by Gemini's now-fixed tendency to pad thin source material with
// content-free filler instead of writing less — see commentary.ts). 300
// gives real room for actual substance without being so strict that a
// genuinely short-but-real story (a brief injury update, a single
// confirmed transfer) gets unfairly rejected.
const MIN_BODY_LENGTH = 300;
// Match-data preview/result templates ("Team A face Team B in MLB. First
// pitch is...") are inherently terse, factual, and already fully vetted (no
// extraction/scrape risk the way an arbitrary RSS body has) — the same
// 150-char bar meant to catch a thin/garbled scrape was instead blocking
// genuinely complete MLB previews sitting at 135-149 chars. Confirmed live:
// every one of 16 pending MLB items was stuck on this alone.
const MIN_MATCH_DATA_BODY_LENGTH = 80;
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
// 199 — deliberately just under Instagram's own ~200/hour app-level rate
// limit ballpark (200 * Number_of_Users, see the Instagram rate-limit
// investigation; this app effectively has ~1 real "user"), so Facebook's
// volume stays aligned with what Instagram can realistically sustain too,
// since autoApprove.ts posts the same selection to both.
const MAX_FACEBOOK_POSTS_PER_DAY = 199;
// Instagram's Content Publishing API hard-caps at 25 successful publishes
// per rolling 24-hour period per IG Business Account — a real Meta platform
// limit (cumulative across every app on the account), not just a throttle
// we chose. 24 leaves one post of headroom instead of risking a 25th
// attempt tripping it. The old flat "2 attempts per run, stop at first
// success" cap left whole days silent (0 posts on 2026-09-15) whenever
// those particular runs had no eligible candidate or hit a transient
// failure — pacing this the same way as Facebook (below) fixes that.
const MAX_INSTAGRAM_POSTS_PER_DAY = 24;
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
// Cricket is the only reserved slot now — every other sport, football
// included, competes purely on trendingScore for the remaining 4 of each
// run's 5 slots.
const RESERVED_CATEGORIES: { category: string; slots: number }[] = [
  { category: "cricket", slots: 1 },
];

export function hasRealImage(article: { heroImageUrl: string | null; homeCrestUrl: string | null }): boolean {
  // A team crest pair is real by construction (never a stock photo).
  if (article.homeCrestUrl) return true;
  // A real photo — from the publisher's own RSS feed, a real player photo,
  // or a real match photo — as opposed to the generic category stock-photo
  // fallback (always served from Pexels; see stockImages.ts).
  if (article.heroImageUrl && !article.heroImageUrl.includes("pexels.com")) return true;
  return false;
}

export function isAutoApprovable(article: {
  body: string | null;
  heroImageUrl: string | null;
  homeCrestUrl: string | null;
  playerNewsSourced: boolean;
  sourceName: string;
}): boolean {
  if (!hasRealImage(article)) return false;
  // Player-news items (playerNewsFeeds.ts) used to be judged on image alone,
  // since a body was structurally impossible for them — Google News' own
  // RSS snippet for these is just the headline repeated. That's no longer
  // true: runIngest.ts now grounds their commentary call in the real
  // article page's text instead (articleTextExtractor.ts), so they're held
  // to the same real-body bar as everything else. An item where extraction
  // was blocked (robots.txt) or failed simply stays in pending_review for a
  // human to look at, same as any other budget/extraction miss.
  const minLength = isMatchDataSource(article.sourceName) ? MIN_MATCH_DATA_BODY_LENGTH : MIN_BODY_LENGTH;
  return Boolean(article.body && article.body.trim().length >= minLength);
}

export async function autoApproveValidArticles(): Promise<{ checked: number; approved: number }> {
  const candidates = await db.article.findMany({
    where: { status: "pending_review" },
    select: { id: true, slug: true, title: true, body: true, heroImageUrl: true, homeCrestUrl: true, playerNewsSourced: true, sourceName: true, trendingScore: true, category: true },
  });

  const toApprove = candidates.filter(isAutoApprovable);

  if (toApprove.length > 0) {
    await db.article.updateMany({
      where: { id: { in: toApprove.map((a) => a.id) } },
      data: {
        status: "published",
        // publishedAt deliberately NOT set — it already holds the article's
        // real-world publish date from ingestion. See approveArticle in
        // admin/actions.ts for the full reasoning (same bug this once was).
      },
    });

    // Best-effort, same isolation principle as the Facebook post below —
    // a failed ping here should never affect publishing.
    await submitToIndexNow(toApprove.map((a) => articleUrl(a.slug)));

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
    const postedToday = await db.socialPost.count({
      where: { platform: "facebook", createdAt: { gte: todayStart } },
    });
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
    const expectedByNow = Math.round((MAX_FACEBOOK_POSTS_PER_DAY * currentRunIndex) / RUNS_PER_DAY);
    const paceTarget = Math.max(1, expectedByNow - postedToday);

    const runCap = Math.max(1, Math.min(MAX_FACEBOOK_POSTS_PER_RUN, remainingToday, paceTarget));

    const eligible = toApprove
      .filter((a) => isHighlightWorthy(a.title))
      .sort((a, b) => b.trendingScore - a.trendingScore);

    // Picks the top N from `eligible` respecting RESERVED_CATEGORIES, same
    // ranking both platforms use. Called once per platform with that
    // platform's own paced cap — Facebook and Instagram now have
    // independent budgets, so Instagram's candidate pool is no longer
    // silently bottlenecked by however small Facebook's pace target happens
    // to be for a given run (they used to share one `toPost` list sized to
    // Facebook's cap alone).
    function selectTopN(n: number): typeof eligible {
      const selected: typeof eligible = [];
      for (const { category, slots } of RESERVED_CATEGORIES) {
        const matches = eligible.filter((a) => a.category === category && !selected.includes(a));
        for (const article of matches.slice(0, slots)) {
          if (selected.length >= n) break;
          selected.push(article);
        }
      }
      for (const article of eligible) {
        if (selected.length >= n) break;
        if (!selected.includes(article)) selected.push(article);
      }
      return selected;
    }

    const toPost = selectTopN(runCap);

    // Same pacing model as Facebook's runCap above, but budgeted against
    // Instagram's own daily cap and counting only actual successful
    // publishes (status "posted") — a failed/rate-limited attempt doesn't
    // consume Meta's real 25/day limit, so it shouldn't consume ours either.
    const instagramPostedToday = await db.socialPost.count({
      where: { platform: "instagram", status: "posted", postedAt: { gte: todayStart } },
    });
    const instagramRemainingToday = Math.max(0, MAX_INSTAGRAM_POSTS_PER_DAY - instagramPostedToday);
    const instagramExpectedByNow = Math.round((MAX_INSTAGRAM_POSTS_PER_DAY * currentRunIndex) / RUNS_PER_DAY);
    const instagramPaceTarget = Math.max(1, instagramExpectedByNow - instagramPostedToday);
    const instagramRunCap = Math.max(
      0,
      Math.min(MAX_INSTAGRAM_POSTS_PER_RUN, instagramRemainingToday, instagramPaceTarget)
    );
    const instagramCandidates = selectTopN(instagramRunCap);

    // Facebook is back to its original plain format (the old auto-link-card
    // post, not the generated poster) per explicit request - the comment-
    // link permission it would have unlocked isn't needed after all, and a
    // single plain API call is cheap enough to attempt for every candidate
    // here, same as before the poster work started.
    for (const article of toPost) {
      try {
        await postArticleToFacebook(article.id);
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
// Giving every item a real multi-day window to still get one, then
// rejecting what hasn't, keeps the queue from growing unbounded while
// still giving genuine retries a fair chance first.
const STALE_NO_IMAGE_DAYS = 3;

export async function rejectStaleNoImageArticles(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_NO_IMAGE_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await db.article.findMany({
    where: { status: "pending_review", createdAt: { lt: cutoff } },
    select: { id: true, heroImageUrl: true, homeCrestUrl: true },
  });
  const staleIds = candidates.filter((a) => !hasRealImage(a)).map((a) => a.id);
  if (staleIds.length === 0) return 0;

  await db.article.updateMany({
    where: { id: { in: staleIds } },
    data: { status: "rejected" },
  });
  return staleIds.length;
}

if (require.main === module) {
  autoApproveValidArticles()
    .then(async ({ checked, approved }) => {
      console.log(`Auto-approve: ${approved} of ${checked} pending articles met the bar (real image + body >= ${MIN_BODY_LENGTH} chars, or >= ${MIN_MATCH_DATA_BODY_LENGTH} for match-data sources).`);
      const rejected = await rejectStaleNoImageArticles();
      console.log(`Rejected ${rejected} pending articles still with no real image after ${STALE_NO_IMAGE_DAYS}+ days.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Auto-approve run failed:", err);
      process.exit(1);
    });
}
