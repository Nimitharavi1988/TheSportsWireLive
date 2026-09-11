import { db } from "../db";
import { fetchFootballData, type RawMatchItem } from "./footballData";
import { fetchNflData } from "./nflData";
import { fetchRssNews } from "./rssFeeds";
import { fetchPlayerNews } from "./playerNewsFeeds";
import { fetchCricketData } from "./cricketData";
import { computeDedupeHash, computeStableDedupeHash } from "./dedupe";
import { runQualityChecks } from "./qualityCheck";
import { fetchTrendingKeywords, computeTrendingScore } from "./trending";
import { fetchStockImagePools, createStockImagePicker } from "./stockImages";
import { generateCommentary, generateMatchRecap } from "./commentary";
import { fetchPersonPhoto } from "./wikimediaImages";
import { competitionFromSummary } from "../teamNames";

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

// Stay well under Gemini's free-tier rate limit.
const COMMENTARY_DELAY_MS = 4500;

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
const MAX_COMMENTARY_PER_RUN = 60;
const MAX_MATCH_RECAP_PER_RUN = 6;

// Cricket gets a guaranteed floor of the shared RSS commentary budget above,
// rather than competing purely on trending score against everything else.
// Adding the India-specific Cricinfo feed (2026-09-10) roughly doubled
// cricket's raw RSS volume — cricket is now 4 of 7 RSS feeds — without any
// change to the shared budget, and cricket stories don't reliably win the
// US/GB Google Trends signal the way football/superstar stories do, so
// cricket's real body-coverage collapsed to near zero within a day (81% of
// the pending queue body-less, entirely ESPN Cricinfo). Kept at half of the
// (now larger) total budget each time MAX_COMMENTARY_PER_RUN was raised, so
// the extra room benefits both cricket and everything else, not just one
// side.
const CRICKET_COMMENTARY_RESERVED = 30;

// RSS items older than this are skipped outright rather than ingested —
// see the skip site below for why. 3 days comfortably covers a slow news
// day without letting genuinely stale (weeks-old) items through.
const MAX_RSS_ITEM_AGE_MS = 3 * 24 * 60 * 60 * 1000;

// football-data.org/CricketData.org/ESPN NFL items always arrive with `body`
// already set to a template built from real match facts (see footballData.ts
// / cricketData.ts / nflData.ts) — that's the discriminator from RSS items,
// which only ever set `sourceSnippet`.
function isMatchDataSource(sourceName: string): boolean {
  return sourceName === "football-data.org" || sourceName === "CricketData.org" || sourceName === "ESPN NFL";
}

// Optional cap on how many new (non-duplicate) items to ingest in this run —
// handy for a quick manual test without waiting through hundreds of
// already-seen duplicates. Unset (the normal cron path) means no limit.
const INGEST_LIMIT = process.env.INGEST_LIMIT ? parseInt(process.env.INGEST_LIMIT, 10) : undefined;

export async function runIngest() {
  const vertical = await db.vertical.upsert({
    where: { name: "sports" },
    update: {},
    create: { name: "sports" },
  });

  const [scoreItems, nflItems, newsItems, playerNewsItems, cricketItems, trendingKeywords, stockImagePools] =
    await Promise.all([
      fetchFootballData(),
      fetchNflData(),
      fetchRssNews(),
      // Actively searches Google News per tracked player (players.ts) —
      // unlike the fixed feeds above, which only ever surface whatever a
      // handful of outlets' latest items happen to include. Built after
      // confirming a real gap: a newly-tracked player (Sanju Samson) had
      // zero mentions across all 4 cricket feeds at the time this was
      // added, even though real coverage of him existed elsewhere.
      fetchPlayerNews(),
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
  const sortedNewsItems = [...newsItems, ...playerNewsItems].sort(
    (a, b) => computeTrendingScore(b.title, trendingKeywords) - computeTrendingScore(a.title, trendingKeywords)
  );
  const rawItems: RawMatchItem[] = [...scoreItems, ...nflItems, ...sortedNewsItems, ...cricketItems];
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
      await db.article.findMany({
        where: { dedupeHash: { in: allHashes } },
        select: { id: true, dedupeHash: true, body: true, heroImageUrl: true },
      })
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

  // Cricket draws from its own reserved floor first; everything else shares
  // the remainder of MAX_COMMENTARY_PER_RUN by trending priority, same as
  // before. Total spend is unchanged — this only changes which items the
  // existing budget goes to.
  function canAffordCommentary(category: string): boolean {
    return category === "cricket"
      ? cricketCommentaryCalls < CRICKET_COMMENTARY_RESERVED
      : otherCommentaryCalls < MAX_COMMENTARY_PER_RUN - CRICKET_COMMENTARY_RESERVED;
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
      // Only RSS items can be missing a body this way — match-data items
      // (football-data.org/CricketData.org) always get one at creation.
      // Player-news items (knownPersonName set — see playerNewsFeeds.ts)
      // are excluded here: confirmed directly that Google News' RSS
      // "snippet" is always just the headline repeated verbatim (100% word
      // overlap across every real example checked), so a commentary call
      // for these has no real facts to expand on and can only produce a
      // reworded headline — not worth spending scarce Gemini budget on
      // when genuine-snippet RSS sources (BBC/Guardian/Sky) are competing
      // for the same budget and can actually be enriched.
      if (
        existing.body === null &&
        item.sourceSnippet &&
        !isMatchDataSource(item.sourceName) &&
        !item.knownPersonName &&
        canAffordCommentary(item.category)
      ) {
        recordCommentaryCall(item.category);
        const { commentary, personNames } = await generateCommentary(item.title, item.sourceSnippet, item.sourceName);
        await sleep(COMMENTARY_DELAY_MS);

        if (commentary) {
          let heroImageUpdate = {};
          if (!existing.heroImageUrl && !item.heroImageUrl) {
            for (const personName of personNames) {
              const personPhoto = await fetchPersonPhoto(personName);
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
          await db.article.update({ where: { id: existing.id }, data: { body: commentary, ...heroImageUpdate } });
          existing.body = commentary; // avoid reprocessing if the same story appears twice in this run
          backfilled++;
        }
      }
      // Independent of whether commentary ran/succeeded above — a
      // known-person image (see RawMatchItem.knownPersonName) doesn't need
      // Gemini's personNames extraction at all, so a budget-exhausted item
      // can still get a real photo even with no body yet.
      if (!existing.heroImageUrl && !item.heroImageUrl && item.knownPersonName) {
        const personPhoto = await fetchPersonPhoto(item.knownPersonName);
        if (personPhoto) {
          await db.article.update({
            where: { id: existing.id },
            data: { heroImageUrl: personPhoto.url, heroImageCredit: personPhoto.credit, heroImageCreditUrl: personPhoto.creditUrl },
          });
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
    const trendingScore = computeTrendingScore(item.title, trendingKeywords);
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
      stockImage = (await fetchPersonPhoto(item.knownPersonName)) ?? stockImagePicker.pick(item.category);
    } else {
      stockImage = stockImagePicker.pick(item.category);
    }

    let body = item.body;
    if (body && isMatchDataSource(item.sourceName) && matchRecapCalls < MAX_MATCH_RECAP_PER_RUN) {
      matchRecapCalls++;
      const competitionName =
        item.category === "cricket" ? "cricket"
        : item.category === "american-football" ? "the NFL"
        : competitionFromSummary(item.summary) ?? "football";
      const recap = await generateMatchRecap(item.title, body, competitionName);
      if (recap) body = recap;
      await sleep(COMMENTARY_DELAY_MS);
    } else if (!body && item.sourceSnippet && !item.knownPersonName && canAffordCommentary(item.category)) {
      // knownPersonName (player-news items) excluded — see the matching
      // comment on the duplicate-backfill path above for why.
      recordCommentaryCall(item.category);
      const { commentary, personNames } = await generateCommentary(item.title, item.sourceSnippet, item.sourceName);
      if (commentary) body = commentary;
      await sleep(COMMENTARY_DELAY_MS);

      // Prefer a real photo of the actual person (or co-central people) the
      // story is about over the generic category stock photo — but only
      // when the RSS feed itself didn't already give us a real photo for
      // this exact story, which is even more specific than a generic
      // Wikimedia portrait of the person, AND only when knownPersonName
      // didn't already resolve this above — re-running with Gemini's
      // extracted names here would risk replacing a known-correct photo
      // with a less certain guess (Gemini can name a quoted journalist or
      // someone else mentioned in passing, not just the story's subject).
      if (!item.heroImageUrl && !item.knownPersonName) {
        for (const personName of personNames) {
          const personPhoto = await fetchPersonPhoto(personName);
          if (personPhoto) {
            stockImage = personPhoto;
            break;
          }
        }
      }
    }

    const created = await db.article.create({
      data: {
        verticalId: vertical.id,
        title: item.title,
        slug,
        summary: item.summary,
        body,
        sourceUrl: item.sourceUrl,
        sourceName: item.sourceName,
        category: item.category,
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
        status: quality.passed ? "pending_review" : "flagged",
      },
    });
    // Registers this hash as no longer "new" — guards against the same
    // story appearing twice in one run (two sources reporting it) trying
    // to create it a second time.
    existingArticles.set(dedupeHash, { id: created.id, dedupeHash, body: created.body, heroImageUrl: created.heroImageUrl });

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