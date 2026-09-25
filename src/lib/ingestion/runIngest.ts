import { db } from "@/db";
import { article, vertical } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { fetchFootballData, type RawMatchItem } from "./footballData";
import { fetchNflData } from "./nflData";
import { fetchMlbData } from "./mlbData";
import { fetchNbaData } from "./nbaData";
import { fetchDomesticFootballData } from "./domesticFootballData";
import { fetchNhlData } from "./nhlData";
import { fetchVolleyballData } from "./volleyballData";
import { fetchEspnVolleyballData } from "./espnVolleyballData";
import { fetchRssNews } from "./rssFeeds";
import { fetchPlayerNews } from "./playerNewsFeeds";
import { fetchCricinfoPlayerNews } from "./cricinfoPlayerFeeds";
import { fetchAsianGamesNews } from "./asianGamesFeeds";
import { fetchCricketData } from "./cricketData";
import { detectSeriesFromTitle } from "./cricketSeries";
import { buildMatchKey } from "../scores/matchKey";
import { detectEventSeries, detectEventSeriesNear, detectIplTeamMention } from "./eventTagging";
import { computeDedupeHash, computeStableDedupeHash } from "./dedupe";
import { runQualityChecks } from "./qualityCheck";
import { fetchTrendingKeywords, computeTrendingScore } from "./trending";
import { fetchStockImagePools, createStockImagePicker } from "./stockImages";
import { generateCommentary, generateMatchRecap, verifyCommentaryHasSubstance } from "./commentary";
import { extractArticleContent } from "./articleTextExtractor";
import { fetchPersonPhoto, sportSearchHint } from "./wikimediaImages";
import { isExcludedSource } from "../excludedSources";
import { competitionFromSummary } from "../teamNames";
import { isMatchDataSource } from "../matchDataSources";
import { resolvePrimaryPlayerName } from "../players";

// Prefers a source-provided stable id (see RawMatchItem.dedupeKey) over the
// title+date hash, since a title embedding a mutable date (e.g. NFL preview
// kickoff dates ESPN can revise) would otherwise hash differently every time
// that date changes, defeating dedup for the same underlying event.
function dedupeHashFor(item: RawMatchItem): string {
  return item.dedupeKey ? computeStableDedupeHash(item.dedupeKey) : computeDedupeHash(item.title, item.publishedAt);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Confirmed live (2026-09-20) against the account's own AI Studio rate-limit
// dashboard for gemini-flash-lite-latest: 4,000 RPM / 4M TPM / 150,000 RPD,
// with real peak usage sitting at just 6 RPM / 21 RPD — nowhere close. The
// old 4500ms value was tuned for the previous model's free-tier ~15 RPM
// ceiling and never revisited after the paid Flash-Lite switch. 400ms keeps
// us at a max of 150 calls/min, still comfortably under 4% of the real 4,000
// RPM ceiling, while letting a run actually get through far more of the
// pending backlog in the same wall-clock window.
const COMMENTARY_DELAY_MS = 400;

// Cap real Gemini calls per ingestion run. Billing IS linked on this account
// (a card was added after Gemini's `generateContent` required one to work at
// all), so this is real, if small, money — at gemini-2.5-flash pricing
// (~$0.0009/call for a typical commentary request) a cap of 60 costs
// roughly $0.054/run, ~$77.76/month at the current 30-min cron interval (48
// runs/day). Raised 10 -> 20 (2026-09-07), then 20 -> 30 (2026-09-10) for
// the India-feed-driven cricket volume, then 30 -> 60 (2026-09-10, same
// day, +~$39/month) after playerNewsFeeds.ts (per-player Google News
// search, up to ~300 extra RSS-shaped candidates/run across 63 tracked
// players) pushed the generic-fallback rate on newly-published articles
// from a 31% baseline to 89.6% within 24h of shipping it — confirmed via a
// direct DB check, not assumed. (Briefly lowered to 10/4 on 2026-09-09 to
// fit Cloudflare Workers Free's subrequest cap while ingestion ran inside
// the Worker — restored/raised now that ingestion runs directly on the
// GitHub Actions runner instead, which has no such limit.) Revisit again
// once real billing data from a few runs comes back from the Google Cloud
// usage page, and re-check the fallback rate after this change lands.
// Match recaps get their own separate budget so a heavy match day (dozens of
// football-data.org fixtures, which come first in the processing order) can
// never starve the RSS commentary budget — the trending-sort prioritization
// above depends on RSS items actually getting a turn.
// Raised 60 -> 150 / 6 -> 20 (2026-09-20) after confirming the real
// constraint isn't Gemini's rate limit at all (see COMMENTARY_DELAY_MS
// above — real usage was 6 RPM against a 4,000 RPM ceiling) and after
// switching to the far cheaper Flash-Lite tier (commentary.ts) — the old 60
// cap was sized for a pricier model's free-tier RPM, not real cost or
// throughput headroom. At 150/run x 96 runs/day this stays well under the
// 150,000 RPD ceiling (14,400/day), and directly targets the pending-queue
// finding that most thin-body backlog items were never even getting a
// commentary attempt within the old budget, not that Gemini declined them.
const MAX_COMMENTARY_PER_RUN = 150;
const MAX_MATCH_RECAP_PER_RUN = 20;

// Cricket gets a guaranteed floor of the shared RSS commentary budget above,
// rather than competing purely on trending score against everything else.
// Adding the India-specific Cricinfo feed (2026-09-10) roughly doubled
// cricket's raw RSS volume — cricket is now 4 of 7 RSS feeds — without any
// change to the shared budget, and cricket stories don't reliably win the
// US/GB Google Trends signal the way football/superstar stories do, so
// cricket's real body-coverage collapsed to near zero within a day (81% of
// the pending queue body-less, entirely ESPN Cricinfo). Was 30 (half of
// MAX_COMMENTARY_PER_RUN); trimmed to 20 (2026-09-12) to redistribute 10
// slots to everything else — 4 new sections (Athletics, Rugby, MLB, NBA)
// and 2 new RSS feeds now compete for the same shared budget cricket
// doesn't touch, and the pending queue was growing largely because of that,
// not because cricket's own floor was too low. Deliberately a rebalance,
// not a raise — MAX_COMMENTARY_PER_RUN (real Gemini spend) is unchanged.
// Trimmed 20 -> 15 (2026-09-19, explicit request) once the pending queue
// was found to be dominated by non-cricket volume (american-football alone
// had 775 of 1,876 pending, cricket only 322) — this is now a genuine
// ceiling, not always fully used; see the spillover logic below it.
// Raised 15 -> 35 (2026-09-20) alongside MAX_COMMENTARY_PER_RUN's 60 -> 150
// increase, restoring roughly the same ~23-25% share of the total budget
// rather than leaving cricket's floor flat while everyone else's pool
// tripled — still leaves 115 of 150 slots (nearly 2x the entire old total
// budget) for the now much larger non-cricket backlog, and any of this 35
// cricket doesn't actually need still spills over via the pre-pass below.
const CRICKET_COMMENTARY_RESERVED = 35;

// RSS items older than this are skipped outright rather than ingested —
// see the skip site below for why. 3 days comfortably covers a slow news
// day without letting genuinely stale (weeks-old) items through.
const MAX_RSS_ITEM_AGE_MS = 3 * 24 * 60 * 60 * 1000;

// football-data.org/CricketData.org/ESPN NFL items always arrive with `body`
// already set to a template built from real match facts (see footballData.ts
// / cricketData.ts / nflData.ts) — that's the discriminator from RSS items,
// which only ever set `sourceSnippet`. Shared with the admin highlight
// action — see matchDataSources.ts.

// Below this, a feed's own snippet is too thin to write a real piece from —
// confirmed pattern across BBC/Guardian/Sky-style feeds, whose descriptions
// are sometimes a single clause. Worth trying the richer article-page
// extraction fallback rather than accepting a near-empty grounding input.
const THIN_SNIPPET_THRESHOLD = 200;

// Google News' own redirect pages (news.google.com/rss/articles/...) are
// blocked by Google's own robots.txt for every article, every time —
// confirmed live, not assumed: a sample of real recent items across
// cricket/NFL/football all came back robotsAllowed=false. extractArticleContent
// already fails safely on these (robotsAllows returns false, no fetch even
// attempted), so this doesn't change behavior on its own — it exists so the
// thin-grounding check right below it can treat "Google News link + thin
// snippet" as a known dead end instead of spending a real Gemini call
// finding that out empirically. fetchPlayerNews() (playerNewsFeeds.ts) is
// the only source whose sourceUrl is ever shaped like this — every other
// feed (rssFeeds.ts, cricinfoPlayerFeeds.ts, the match-data APIs) already
// links directly to the publisher, which robots.txt generally allows.
function isGoogleNewsRedirect(url: string): boolean {
  try {
    return new URL(url).hostname === "news.google.com";
  } catch {
    return false;
  }
}

interface Grounding {
  text: string;
  // Real, story-specific photo pulled from the article page's own og:image
  // (see articleTextExtractor.ts) — only present when page extraction ran
  // at all, i.e. only for the thin-snippet path below.
  imageUrl?: string;
}

// Resolves the best available grounding text (and, incidentally, a real
// per-story image) for a Gemini commentary call. The text is never stored,
// only ever used in-memory for that one call (see articleTextExtractor.ts's
// header comment for the full reasoning) — the image, by contrast, IS meant
// to be stored/shown, same as any other publisher-provided image.
//
// Driven purely by snippet quality, not by source — Google News search
// results (playerNewsFeeds.ts) always fall through to page extraction
// because their snippet is confirmed to be just the headline repeated, but
// a per-player Cricinfo feed item (cricinfoPlayerFeeds.ts) has a knownPersonName
// too AND a real snippet, so it should use that directly rather than making
// an unnecessary extra fetch. Every other feed's own snippet is used when
// substantive, and only falls back to page extraction when it's too thin.
async function resolveGrounding(item: RawMatchItem): Promise<Grounding | null> {
  const snippet = item.sourceSnippet?.trim();
  if (snippet && snippet.length >= THIN_SNIPPET_THRESHOLD) return { text: snippet };
  // A Google News redirect link can never be extracted (see
  // isGoogleNewsRedirect above), so when its own snippet is also under the
  // thin threshold there's no path to real grounding at all -- skip the
  // extraction attempt (guaranteed to fail) and the Gemini call that would
  // follow it (real spend on a real API), rather than discovering the same
  // dead end empirically. Confirmed live: this exact combination converts
  // to a publishable article only ~3% of the time across a real 24h sample
  // (cricket), because Gemini correctly declines to pad a genuinely thin
  // fact set past the ~300-char approval bar rather than inventing filler
  // (see commentary.ts's own instruction). Every other source still gets
  // the full extraction attempt below -- this only short-circuits the one
  // case already known to be a dead end before spending anything on it.
  if (isGoogleNewsRedirect(item.sourceUrl)) return null;
  const extracted = await extractArticleContent(item.sourceUrl);
  if (extracted) return { text: extracted.text, imageUrl: extracted.imageUrl };
  return snippet ? { text: snippet } : null;
}

// Optional cap on how many new (non-duplicate) items to ingest in this run —
// handy for a quick manual test without waiting through hundreds of
// already-seen duplicates. Unset (the normal cron path) means no limit.
const INGEST_LIMIT = process.env.INGEST_LIMIT ? parseInt(process.env.INGEST_LIMIT, 10) : undefined;

export async function runIngest() {
  let [verticalRow] = await db.select().from(vertical).where(eq(vertical.name, "sports")).limit(1);
  if (!verticalRow) {
    [verticalRow] = await db.insert(vertical).values({ id: createId(), name: "sports" }).returning();
  }

  const [scoreItems, nflItems, mlbItems, nbaItems, domesticFootballItems, nhlItems, volleyballItems, espnVolleyballItems, newsItems, playerNewsItems, cricinfoPlayerItems, asianGamesItems, cricketItems, trendingKeywords, stockImagePools] =
    await Promise.all([
      fetchFootballData(),
      fetchNflData(),
      fetchMlbData(),
      fetchNbaData(),
      // Domestic leagues (Bundesliga/Serie A/Ligue 1/MLS/Indian Super
      // League) and NHL/volleyball — see domesticFootballData.ts/
      // nhlData.ts/volleyballData.ts for source details.
      fetchDomesticFootballData(),
      fetchNhlData(),
      fetchVolleyballData(),
      // Second volleyball source (US college, not international) — added
      // after the API-Sports.io account behind volleyballData.ts got
      // suspended, so real volleyball coverage keeps flowing regardless of
      // that account's status. See espnVolleyballData.ts.
      fetchEspnVolleyballData(),
      fetchRssNews(),
      // Actively searches Google News per tracked player (players.ts) —
      // unlike the fixed feeds above, which only ever surface whatever a
      // handful of outlets' latest items happen to include. Built after
      // confirming a real gap: a newly-tracked player (Sanju Samson) had
      // zero mentions across all 4 cricket feeds at the time this was
      // added, even though real coverage of him existed elsewhere.
      fetchPlayerNews(),
      // Each tracked cricket player's own official Cricinfo RSS feed — real
      // article snippets and direct URLs, unlike the Google News search
      // above (see cricinfoPlayerFeeds.ts). Primary source for cricket
      // player coverage now; Google News search stays as the breadth
      // fallback for whoever/whatever Cricinfo doesn't carry.
      fetchCricinfoPlayerNews(),
      // General (multi-sport) Indian news feeds, filtered down to just
      // "Asian Games" titles — see asianGamesFeeds.ts's own header comment
      // for why this exists as a separate fetcher rather than a plain
      // rssFeeds.ts entry (those feeds carry unrelated sports too, so they
      // can't be assigned one fixed category the way every other feed
      // there is).
      fetchAsianGamesNews(),
      fetchCricketData(),
      fetchTrendingKeywords(),
      // Reddit engagement (redditEngagement.ts) is intentionally not called
      // here — Reddit's no-auth JSON endpoint now 403s anonymous/datacenter
      // traffic (confirmed 2026-09-09), so it would just burn 2 of the free
      // Workers plan's scarce 50-subrequest budget for zero benefit. The
      // module and its tests are still in place, ready to wire back in once
      // real OAuth app credentials are added.
      fetchStockImagePools(),
    ]);
  // Prioritize RSS items by trending relevance so the limited commentary
  // budget (MAX_COMMENTARY_PER_RUN) goes to the most important stories first,
  // not just whatever came first in feed order. Player-search results are
  // folded in here too — they're about a tracked superstar by construction,
  // so computeTrendingScore's own superstar-name detection already tends to
  // rank them highly rather than needing a separate carve-out.
  const sortedNewsItems = [...newsItems, ...playerNewsItems, ...cricinfoPlayerItems, ...asianGamesItems].sort(
    (a, b) =>
      computeTrendingScore(b.title, trendingKeywords, undefined, b.category) -
      computeTrendingScore(a.title, trendingKeywords, undefined, a.category)
  );
  const rawItems: RawMatchItem[] = [...scoreItems, ...nflItems, ...mlbItems, ...nbaItems, ...domesticFootballItems, ...nhlItems, ...volleyballItems, ...espnVolleyballItems, ...sortedNewsItems, ...cricketItems]
    // Checked against every source regardless of which fetcher it came
    // through (most reach here via the per-player Google News search,
    // playerNewsFeeds.ts, not a fixed feed) — see excludedSources.ts for
    // why a source lands here instead of being caught by a content check.
    .filter((item) => !isExcludedSource(item.sourceName));
  const stockImagePicker = createStockImagePicker(stockImagePools);

  // Cloudflare Workers caps outbound subrequests per invocation, and every
  // Prisma call here goes over HTTPS via Accelerate — so a per-item
  // db.article.findUnique() dedupe check (one subrequest per raw item, and
  // the RSS/football-data/cricket feeds return hundreds on every run, not
  // just new ones) reliably blew that cap and failed the cron on every
  // single run. One batched lookup up front replaces all of those with a
  // single subrequest; the set is updated in-memory as items are ingested
  // so within-run duplicates (two sources reporting the same story) are
  // still caught without a query each.
  const allHashes = rawItems.map(dedupeHashFor);
  // Keyed on id/body/heroImageUrl (not just the hash) so a duplicate that
  // was created in an earlier run without a body — because that run's
  // Gemini budget ran out before reaching it — can be opportunistically
  // backfilled here instead of staying stuck on the generic summary
  // forever. RSS feeds return mostly the same items on every 30-min run,
  // so without this, an item that missed the budget once would never get
  // another chance: it's a duplicate on every subsequent run and skipped
  // outright.
  const existingArticles = new Map(
    (
      allHashes.length === 0
        ? []
        : await db.select({
            id: article.id, dedupeHash: article.dedupeHash, body: article.body, heroImageUrl: article.heroImageUrl,
            matchStatus: article.matchStatus, status: article.status, slug: article.slug,
          }).from(article).where(inArray(article.dedupeHash, allHashes))
    ).map((a) => [a.dedupeHash, a])
  );

  let ingested = 0;
  let duplicates = 0;
  let backfilled = 0;
  let staleSkipped = 0;
  let flagged = 0;
  let cricketCommentaryCalls = 0;
  let otherCommentaryCalls = 0;
  let matchRecapCalls = 0;

  // Spillover: cricket's reserve is a ceiling, not a guarantee it'll all get
  // used — on a run with genuinely little fresh cricket editorial news, the
  // unused portion should go to the much larger non-cricket backlog instead
  // of sitting idle while football/basketball/baseball starve. Estimated via
  // a cheap pre-pass (no network calls) over rawItems counting real cricket
  // commentary CANDIDATES — a still-pending existing article with no body
  // yet, or a genuinely new item — same eligibility rawItems items are
  // actually filtered on below. This is a deliberate upper bound (it doesn't
  // replicate the quality-gate check new items still have to pass), so it
  // can occasionally overestimate real demand and leave a slot unused, but
  // never underestimates cricket's real need and steals a slot it would
  // have used — the common, important case this fixes is "today just has
  // fewer real cricket stories than 15," not quality-gate edge cases.
  const cricketCandidateCount = rawItems.filter((item) => {
    if (item.category !== "cricket" || isMatchDataSource(item.sourceName)) return false;
    const existing = existingArticles.get(dedupeHashFor(item));
    return existing
      ? existing.body === null && existing.status !== "flagged" && existing.status !== "rejected"
      : true;
  }).length;
  const cricketCommentaryCap = Math.min(CRICKET_COMMENTARY_RESERVED, cricketCandidateCount);
  const otherCommentaryCap = MAX_COMMENTARY_PER_RUN - cricketCommentaryCap;

  // Cricket draws from its own reserved floor first; everything else shares
  // the remainder of MAX_COMMENTARY_PER_RUN by trending priority, same as
  // before. Total spend is unchanged — this only changes which items the
  // existing budget goes to.
  function canAffordCommentary(category: string): boolean {
    return category === "cricket"
      ? cricketCommentaryCalls < cricketCommentaryCap
      : otherCommentaryCalls < otherCommentaryCap;
  }
  function recordCommentaryCall(category: string): void {
    if (category === "cricket") cricketCommentaryCalls++;
    else otherCommentaryCalls++;
  }

  for (const item of rawItems) {
    if (INGEST_LIMIT !== undefined && ingested >= INGEST_LIMIT) break;

    const dedupeHash = dedupeHashFor(item);
    const existing = existingArticles.get(dedupeHash);

    if (existing) {
      duplicates++;

      // A match-data source's dedupeKey is stable per real-world event
      // (e.g. espn-nfl-${event.id}), deliberately the SAME whether the
      // match is scheduled, in progress, or finished — so once an article
      // exists for it, every later poll matches it as a duplicate here,
      // not a new article. Until 2026-09-17 only CricketData.org had any
      // handling for that: every other match-data source just fell through
      // this branch doing nothing, meaning its score/status/result were
      // written ONCE at creation and never touched again. Confirmed live:
      // NFL/MLB/ESPN-Volleyball games from days earlier were still sitting
      // at matchStatus "scheduled" with a null score — a live or finished
      // game was structurally unable to ever show its real result through
      // this row, since the only source that ever refreshed an existing
      // duplicate was CricketData.org. (football-data.org's own title
      // changes shape at the finished transition, so it accidentally
      // dodged this by hashing to a brand-new article instead — its own,
      // separate problem, real duplicate-content clutter, fixed by giving
      // it a stable dedupeKey too — see footballData.ts.)
      //
      // Score/status/venue refresh every poll, same reasoning as cricket's
      // live-score fix above it. title/summary/body only refresh right at
      // the scheduled->finished transition here, not every poll — unlike
      // CricketData.org's title (which never encodes the score and so
      // never needed refreshing), every other source's title/summary/body
      // format IS the score/result ("Preview: X vs Y" vs "X 2-1 Y"), and
      // these sources never emit a genuine in-progress "live" state at all
      // (see e.g. nflData.ts's `state !== "post" && state !== "pre"`
      // skip) — so there's no intermediate text to keep in sync with, only
      // one real transition to catch.
      if (isMatchDataSource(item.sourceName)) {
        const justFinished = existing.matchStatus !== "finished" && item.matchStatus === "finished";
        const isCricketData = item.sourceName === "CricketData.org";
        await db.update(article)
          .set({
            matchStatus: item.matchStatus,
            homeScore: item.homeScore,
            awayScore: item.awayScore,
            homeScoreText: item.homeScoreText,
            awayScoreText: item.awayScoreText,
            venue: item.venue,
            // Standard scoreboard fields (src/lib/scores/). undefined = source
            // doesn't provide it (Drizzle leaves the column alone); null = clear it.
            leagueLabel: item.leagueLabel,
            matchClock: item.matchClock,
            matchNote: item.matchNote,
            homeRecord: item.homeRecord,
            awayRecord: item.awayRecord,
            broadcast: item.broadcast,
            matchKey: buildMatchKey(item.category, item.kickoffAt, item.homeTeam, item.awayTeam),
            ...(isCricketData || justFinished ? { summary: item.summary, body: item.body } : {}),
            ...(justFinished && !isCricketData ? { title: item.title } : {}),
            updatedAt: new Date(),
          })
          .where(eq(article.id, existing.id));
        existing.matchStatus = item.matchStatus ?? null;
      }

      // Only RSS items can be missing a body this way — match-data items
      // (football-data.org/CricketData.org) always get one at creation.
      // Player-news items (knownPersonName set — see playerNewsFeeds.ts)
      // used to be excluded here outright, since Google News' RSS snippet
      // for these is just the headline repeated verbatim — now handled by
      // resolveGrounding falling back to a real page-text (and image)
      // extraction (articleTextExtractor.ts) instead of skipping them.
      //
      // "rejected" excluded alongside "flagged" (2026-09-17) — confirmed
      // live this was retrying commentary for the SAME already-rejected
      // article on every ~15-min ingestion run indefinitely whenever its
      // headline kept resurfacing in RSS/Google News results (very common
      // for player-search items): 665 rejected articles sat in this retry
      // pool, real Gemini spend with zero possible benefit even on success,
      // since nothing here ever un-rejects an article — the write below
      // only ever touches body/image/venue, never status. A rejected
      // article's fate is already decided; retrying its commentary forever
      // was pure waste, a meaningful share of the cost increase after
      // Gemini billing was restored.
      if (existing.body === null && existing.status !== "flagged" && existing.status !== "rejected" && !isMatchDataSource(item.sourceName) && canAffordCommentary(item.category)) {
        const grounding = await resolveGrounding(item);
        if (grounding) {
          recordCommentaryCall(item.category);
          const { commentary: rawCommentary, personNames, venue: extractedVenue } = await generateCommentary(item.title, grounding.text, item.sourceName);
          // Second-pass vagueness check (see verifyCommentaryHasSubstance's
          // own comment) — a commentary that comes back non-empty but reads
          // as pure headline-paraphrase is treated the same as an empty one
          // below, not silently accepted.
          const commentary = rawCommentary && (await verifyCommentaryHasSubstance(item.title, rawCommentary)) ? rawCommentary : null;
          await sleep(COMMENTARY_DELAY_MS);

          // A real generation attempt just failed on retry — same rule the
          // creation-time path already applies (commentaryAttemptFailed
          // below), which this retry path never had. Confirmed live
          // (2026-09-18): 53 published articles had this exact shape — a
          // player-news item (playerNewsFeeds.ts's sourceUrl is always a
          // Google News redirect, never extractable) whose Google-supplied
          // RSS snippet was too thin for Gemini to write anything real
          // from. Each one sat in pending_review with a null body after
          // its first attempt (deferred, not rejected, because the
          // commentary budget was exhausted that run) — but every retry
          // after that also failed for the same structural reason and
          // never marked it rejected either, since this branch only ever
          // wrote body/image/venue. Left to accumulate, eventually
          // reachable by a bulk-approve or a reviewer skimming past it.
          // Only touches still-pending items — an already-published
          // article isn't silently pulled by a later failed retry.
          if (!commentary && existing.status === "pending_review") {
            await db.update(article).set({ status: "rejected", updatedAt: new Date() }).where(eq(article.id, existing.id));
            existing.status = "rejected";
          }

          if (commentary) {
            let heroImageUpdate: { heroImageUrl?: string; heroImageCredit?: string; heroImageCreditUrl?: string } = {};
            if (!existing.heroImageUrl && !item.heroImageUrl) {
              // Real per-story image from the article page itself takes
              // priority over the generic per-person Wikipedia photo — the
              // exact fix for every article about the same person
              // otherwise showing the identical photo (see
              // articleTextExtractor.ts's header comment).
              if (grounding.imageUrl) {
                heroImageUpdate = { heroImageUrl: grounding.imageUrl, heroImageCredit: `Photo via ${item.sourceName}` };
              } else {
                for (const personName of personNames) {
                  const personPhoto = await fetchPersonPhoto(personName, sportSearchHint(item.category), existing.slug);
                  if (personPhoto) {
                    heroImageUpdate = {
                      heroImageUrl: personPhoto.url,
                      heroImageCredit: personPhoto.credit,
                      heroImageCreditUrl: personPhoto.creditUrl,
                    };
                    break;
                  }
                }
              }
            }
            await db.update(article)
              .set({ body: commentary, ...heroImageUpdate, ...(extractedVenue ? { venue: extractedVenue } : {}), updatedAt: new Date() })
              .where(eq(article.id, existing.id));
            existing.body = commentary; // avoid reprocessing if the same story appears twice in this run
            existing.heroImageUrl = heroImageUpdate.heroImageUrl ?? existing.heroImageUrl;
            backfilled++;
          }
        } else if (existing.status === "pending_review") {
          // resolveGrounding itself found nothing to work from at all
          // (extraction blocked, RSS snippet too thin/missing) — same
          // "real attempt failed" rejection as the commentary-came-back-
          // empty case above.
          await db.update(article).set({ status: "rejected", updatedAt: new Date() }).where(eq(article.id, existing.id));
          existing.status = "rejected";
        }
      }
      // Independent of whether commentary ran/succeeded above — a
      // known-person image (see RawMatchItem.knownPersonName) doesn't need
      // Gemini's personNames extraction at all, so a budget-exhausted item
      // can still get a real photo even with no body yet.
      if (!existing.heroImageUrl && !item.heroImageUrl && item.knownPersonName) {
        const primaryPlayerName = resolvePrimaryPlayerName(item.title, item.knownPersonName);
        const personPhoto = await fetchPersonPhoto(primaryPlayerName, sportSearchHint(item.category), existing.slug);
        if (personPhoto) {
          await db.update(article)
            .set({ heroImageUrl: personPhoto.url, heroImageCredit: personPhoto.credit, heroImageCreditUrl: personPhoto.creditUrl, updatedAt: new Date() })
            .where(eq(article.id, existing.id));
          existing.heroImageUrl = personPhoto.url;
        }
      }
      continue;
    }

    // RSS feeds aren't reliably reverse-chronological "latest only" lists —
    // confirmed directly: ESPN Cricinfo's India feed returns items up to
    // ~54 days old mixed in with today's news, with nothing upstream
    // distinguishing them. Without this check they'd be ingested and shown
    // exactly like fresh news (same "Sep X" date chip styling, competing
    // in the same trending sort), misrepresenting stale content as current
    // — a real accuracy problem for a "Live" news site. Only applies to
    // RSS items; match-data sources (football-data.org/CricketData.org/
    // ESPN NFL) already have their own intentional date-range windows
    // (e.g. football-data.org's ±14 days for finished/scheduled matches),
    // which this would otherwise incorrectly clip.
    if (item.sourceSnippet && !isMatchDataSource(item.sourceName) && Date.now() - item.publishedAt.getTime() > MAX_RSS_ITEM_AGE_MS) {
      staleSkipped++;
      continue;
    }

    const quality = runQualityChecks(item.title, item.summary);
    const trendingScore = computeTrendingScore(item.title, trendingKeywords, undefined, item.category);
    const slug = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    // Priority: a real, story-specific photo the publisher's own RSS feed
    // already provides (most specific/authentic) > a team crest (no stock
    // image needed at all) > a known person's real Wikimedia photo (the
    // source already told us who this is about — see
    // RawMatchItem.knownPersonName — so this doesn't need Gemini's
    // personNames extraction, or its budget, to run at all) > the category
    // stock-photo fallback.
    let stockImage: { url: string; credit?: string; creditUrl?: string } | null;
    if (item.heroImageUrl) {
      stockImage = { url: item.heroImageUrl, credit: item.heroImageCredit ?? `Photo via ${item.sourceName}`, creditUrl: item.sourceUrl };
    } else if (item.homeCrestUrl) {
      stockImage = null;
    } else if (item.knownPersonName) {
      const primaryPlayerName = resolvePrimaryPlayerName(item.title, item.knownPersonName);
      stockImage = (await fetchPersonPhoto(primaryPlayerName, sportSearchHint(item.category), slug)) ?? stockImagePicker.pick(item.category);
    } else {
      stockImage = stockImagePicker.pick(item.category);
    }

    let body = item.body;
    // Structured match-data sources (cricketData.ts/nflData.ts) already set
    // this directly; generateCommentary below can also fill it in for
    // editorial/RSS match reports when the source text genuinely states a
    // venue — see commentary.ts's CommentaryResult.venue.
    let venue = item.venue ?? null;
    // Items that already failed the quality gate (profanity, quiz/poll
    // filler, content-farm spam) get status "flagged" below regardless —
    // they're essentially never going to be approved. Spending a real
    // Gemini call (and eating into the small per-run commentary/recap
    // budget) writing prose for something that's about to be discarded was
    // pure waste; skip straight past both generation branches for these.
    if (body && quality.passed && isMatchDataSource(item.sourceName) && matchRecapCalls < MAX_MATCH_RECAP_PER_RUN) {
      matchRecapCalls++;
      const competitionName =
        item.category === "cricket" ? "cricket"
        : item.category === "american-football" ? "the NFL"
        : item.category === "baseball" ? "MLB"
        : item.category === "basketball" ? "the NBA"
        : competitionFromSummary(item.summary) ?? "football";
      const recap = await generateMatchRecap(item.title, body, competitionName);
      if (recap) body = recap;
      await sleep(COMMENTARY_DELAY_MS);
    }
    // Tracks whether a real grounding+Gemini attempt happened this run and
    // still came back with no usable text — as opposed to simply not being
    // tried yet because the per-run commentary budget was exhausted (that
    // case is left as "pending_review" so a later run's duplicate-refresh
    // retry, see below, gets a real shot at it). Confirmed live: 340
    // pending_review articles had accumulated with no body at all, some
    // over a week old — items whose one real generation attempt already
    // failed (extraction blocked, thin snippet, Gemini returned nothing)
    // but whose exact story never resurfaced in the feed to trigger a
    // retry, so they just sat in the review queue forever with nothing for
    // a human to even read. Catching this at ingestion time instead of
    // waiting for a separate cleanup pass.
    let commentaryAttemptFailed = false;
    if (!body && quality.passed && canAffordCommentary(item.category)) {
      // knownPersonName (player-news) items used to be excluded here
      // outright — see resolveGrounding's comment for why they're now
      // routed through page-text extraction instead of being skipped.
      const grounding = await resolveGrounding(item);
      if (grounding) {
        recordCommentaryCall(item.category);
        const { commentary: rawCommentary, personNames, venue: extractedVenue } = await generateCommentary(item.title, grounding.text, item.sourceName);
        // Second-pass vagueness check — see verifyCommentaryHasSubstance's
        // own comment and the retry-path branch above for why this can't
        // just be folded into generateCommentary's own response.
        const commentary = rawCommentary && (await verifyCommentaryHasSubstance(item.title, rawCommentary)) ? rawCommentary : null;
        if (commentary) body = commentary;
        else commentaryAttemptFailed = true;
        if (extractedVenue) venue = extractedVenue;
        await sleep(COMMENTARY_DELAY_MS);

        // Real per-story image from the article page itself takes priority
        // over the generic per-person Wikipedia photo already set in
        // stockImage above (the fetchPersonPhoto call near the top of this
        // loop) — the exact fix for every player-news article about the
        // same person otherwise showing the identical photo. Only when the
        // RSS feed itself didn't already give us a real photo for this
        // exact story, which is even more specific than either.
        if (!item.heroImageUrl && grounding.imageUrl) {
          stockImage = { url: grounding.imageUrl, credit: `Photo via ${item.sourceName}`, creditUrl: item.sourceUrl };
        } else if (!item.heroImageUrl && item.knownPersonName && personNames.length > 0) {
          // Gemini's personNames is a stronger signal than the title-text
          // heuristic used for the initial stockImage above — it's ranked
          // by actual prominence in the full grounded article text, not
          // just which tracked name appears earliest in the headline. Only
          // worth a second lookup when it actually disagrees with what we
          // already used.
          const primaryPlayerName = resolvePrimaryPlayerName(item.title, item.knownPersonName);
          if (personNames[0] !== primaryPlayerName) {
            const betterPhoto = await fetchPersonPhoto(personNames[0], sportSearchHint(item.category), slug);
            if (betterPhoto) stockImage = betterPhoto;
          }
        } else if (!item.heroImageUrl && !item.knownPersonName) {
          for (const personName of personNames) {
            const personPhoto = await fetchPersonPhoto(personName, sportSearchHint(item.category), slug);
            if (personPhoto) {
              stockImage = personPhoto;
              break;
            }
          }
        }
      } else {
        // resolveGrounding itself found nothing to work from (extraction
        // blocked, RSS snippet too thin) — a real attempt that failed, same
        // as commentary generation coming back empty above.
        commentaryAttemptFailed = true;
      }
    }

    // Match-data items already have their own seriesKey/seriesLabel (set
    // directly in cricketData.ts, from the two teams it already knows) —
    // that takes priority when present. Otherwise, a real dated multi-sport
    // event (eventTagging.ts — cross-category, e.g. the 2026 Asian Games)
    // is checked before falling back to cricket's own bilateral-series
    // detection (cricketSeries.ts — cricket-only, since it requires two
    // recognized cricket teams and a match format in the title, a shape
    // that doesn't generalize past cricket). Cricket's bilateral check is
    // gated on seriesLabel alone (not "both seriesKey and seriesLabel") —
    // confirmed live that requiring both was silently discarding
    // domesticFootballData.ts's seriesLabel (Bundesliga/Serie A/etc.),
    // which is deliberately seriesKey-less (see that file's comment: the
    // /series/[seriesKey] grouping page didn't need it before this, but
    // organizer JSON-LD still wants the real competition name).
    //
    // item.seriesKey ?? detectEventSeries(item.seriesLabel)?.key — added
    // 2026-09-23 after a real gap: volleyballData.ts sets seriesLabel
    // directly from the upstream API's own league name (game.league.name)
    // for every league, with no seriesKey ever derived from it. Most of the
    // time that's fine and unchanged (a domestic Russian league label still
    // has no matching EVENTS entry, so this stays null exactly as before) —
    // but when that raw label happens to BE a known cross-sport event
    // ("Asian Games Women", confirmed live in the DB), the label alone was
    // silently orphaning the article from /series entirely (that page
    // requires a non-null seriesKey), even though eventTagging.ts already
    // had the matching key. Checking the label text (not just the title)
    // against the same EVENTS list catches this without a volleyball-
    // specific special case — any future match-data source with the same
    // "real label, no key" shape gets the same fix for free.
    // detectEventSeries(body.slice(0, EVENT_LEAD_CHARS)) — added 2026-09-23,
    // real gap reported live: a Hindustan Times retrospective feature
    // ("Harmanpreet Kaur and the making of a winning habit...") whose
    // headline never says "Asian Games" was missing the tag, even though
    // its generated body opens with "...secured an Asian Games gold medal
    // in Nagoya..." — the event IS the lead fact, just not in the
    // headline's own wording. Checked real data before picking a threshold
    // rather than guessing one: of 46 real cricket articles whose body
    // mentions "Asian Games" but whose title doesn't, checking only the
    // first 100 characters catches exactly the ones that are genuinely
    // ABOUT the Games (this one, an India-Japan match report, a Smriti
    // Mandhana record set at the Games) while excluding the ones where it's
    // just background context deeper in the piece (a West Indies ODI squad
    // story, a coaching-hire story, a personal-life story) — those mention
    // "Asian Games" past character ~140-150, well outside this window.
    // Body-only (title still checked first, unchanged) because a title
    // naming an event is a much stronger signal than a body mention can
    // ever be — this is deliberately a narrow, late-arriving fallback, not
    // a replacement for the title check above it.
    const EVENT_LEAD_CHARS = 100;
    // detectIplTeamMention(title/body) — added 2026-09-23, real gap
    // reported live: 23 real Chennai Super Kings head-coach (Zaheer Khan)
    // articles had no seriesKey, because IPL team news is almost always
    // written around the TEAM (full name or, very commonly in headlines,
    // its official abbreviation "CSK"), not the league name -- \bIPL\b
    // alone can never catch this whole class of story. See
    // eventTagging.ts's detectIplTeamMention for why this is its own
    // cricket-gated check rather than folded into the generic EVENTS list
    // above (team abbreviations are genuinely ambiguous outside cricket
    // context, unlike "Asian Games"/"IPL" themselves). Checks the title
    // first, then the body -- same lead-signal priority as the Asian Games
    // checks above, not unconditionally scanning the whole body for a team
    // abbreviation as thin a signal as e.g. "MI" or "DC".
    const iplTeamSeries = item.category === "cricket"
      ? (detectIplTeamMention(item.title) ?? (body ? detectIplTeamMention(body) : null))
      : null;
    const series =
      item.seriesLabel
        ? { key: item.seriesKey ?? detectEventSeries(item.seriesLabel)?.key, label: item.seriesLabel }
        : (detectEventSeries(item.title) ??
          (body ? detectEventSeriesNear(body, EVENT_LEAD_CHARS) : null) ??
          iplTeamSeries ??
          (item.category.startsWith("cricket") ? detectSeriesFromTitle(item.title) : null));

    const [created] = await db.insert(article).values({
        id: createId(),
        verticalId: verticalRow.id,
        title: item.title,
        slug,
        summary: item.summary,
        body,
        sourceUrl: item.sourceUrl,
        sourceName: item.sourceName,
        category: item.category,
        seriesKey: series?.key,
        seriesLabel: series?.label,
        // The article's real-world publish date (RSS pubDate, or match
        // date for structured sources) — was never actually persisted
        // here before, silently discarded until approveArticle overwrote
        // it with the approval timestamp instead. That made every
        // article's displayed/sorted date "when an admin clicked
        // Approve," not "when the story actually happened" — the root
        // cause of old news displaying with a fresh-looking date.
        publishedAt: item.publishedAt,
        dedupeHash,
        homeCrestUrl: item.homeCrestUrl,
        awayCrestUrl: item.awayCrestUrl,
        heroImageUrl: stockImage?.url,
        heroImageCredit: stockImage?.credit,
        heroImageCreditUrl: stockImage?.creditUrl,
        profanityFlag: quality.profanityFlag,
        profanityDetail: quality.profanityDetail,
        readabilityScore: quality.readabilityScore,
        trendingScore,
        // A real generation attempt already failed this run for a
        // non-match-data item that still has no body — rejecting it
        // immediately instead of letting it sit in pending_review
        // indefinitely with nothing for a human to read (see
        // commentaryAttemptFailed above). Doesn't apply to match-data
        // items — a thin/templated recap still has real factual content,
        // unlike a genuinely empty body.
        status: !quality.passed
          ? "flagged"
          : commentaryAttemptFailed && !body
            ? "rejected"
            : "pending_review",
        // Marks this as a player-news item so autoApprove.ts knows a null
        // body here is the finished state (summary + real photo + source
        // link), not "not yet enriched" — see the field's schema comment.
        playerNewsSourced: Boolean(item.knownPersonName),
        // Structured match data, when the source provided it (see the
        // schema comment on Article.homeTeam) — powers /scores and the
        // multi-sport MatchTicker without regex-parsing the title.
        homeTeam: item.homeTeam,
        awayTeam: item.awayTeam,
        homeScore: item.homeScore,
        awayScore: item.awayScore,
        matchStatus: item.matchStatus,
        kickoffAt: item.kickoffAt,
        homeScoreText: item.homeScoreText,
        awayScoreText: item.awayScoreText,
        venue,
        // Standard scoreboard fields (src/lib/scores/). undefined = source
        // doesn't provide it (Drizzle leaves the column alone); null = clear it.
        leagueLabel: item.leagueLabel,
        matchClock: item.matchClock,
        matchNote: item.matchNote,
        homeRecord: item.homeRecord,
        awayRecord: item.awayRecord,
        broadcast: item.broadcast,
        matchKey: buildMatchKey(item.category, item.kickoffAt, item.homeTeam, item.awayTeam),
        updatedAt: new Date(),
      }).returning();
    // Registers this hash as no longer "new" — guards against the same
    // story appearing twice in one run (two sources reporting it) trying
    // to create it a second time.
    existingArticles.set(dedupeHash, { id: created.id, dedupeHash, body: created.body, heroImageUrl: created.heroImageUrl, matchStatus: created.matchStatus, status: created.status, slug: created.slug });

    ingested++;
    if (!quality.passed) flagged++;
  }

  console.log(
    `Ingest run complete: ${ingested} new articles (${flagged} flagged), ${staleSkipped} stale RSS items skipped (older than ${MAX_RSS_ITEM_AGE_MS / 86400000}d), ` +
    `${duplicates} duplicates skipped (${backfilled} of those backfilled with a body they missed on a previous run), ` +
    `${cricketCommentaryCalls + otherCommentaryCalls} RSS commentary calls (${cricketCommentaryCalls} cricket, ${otherCommentaryCalls} other), ${matchRecapCalls} match recap calls. ` +
    `(${scoreItems.length} from football-data.org, ${nflItems.length} from ESPN NFL, ${newsItems.length} from RSS, ${playerNewsItems.length} from per-player Google News search, ${cricketItems.length} from CricketData.org, ${trendingKeywords.length} trending keywords checked)`
  );
}

if (require.main === module) {
  runIngest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Ingest run failed:", err);
      process.exit(1);
    });
}