import { db } from "../db";
import { fetchFootballData, type RawMatchItem } from "./footballData";
import { fetchRssNews } from "./rssFeeds";
import { fetchCricketData } from "./cricketData";
import { computeDedupeHash } from "./dedupe";
import { runQualityChecks } from "./qualityCheck";
import { fetchTrendingKeywords, computeTrendingScore } from "./trending";
import { fetchStockImagePools, createStockImagePicker } from "./stockImages";
import { generateCommentary, generateMatchRecap } from "./commentary";
import { fetchPersonPhoto } from "./wikimediaImages";
import { competitionFromSummary } from "../teamNames";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Stay well under Gemini's free-tier rate limit.
const COMMENTARY_DELAY_MS = 4500;

// Cap real Gemini calls per ingestion run. Billing IS linked on this account
// (a card was added after Gemini's `generateContent` required one to work at
// all), so this is real, if small, money — at gemini-2.5-flash pricing
// (~$0.0009/call for a typical commentary request) a cap of 20 costs
// roughly $0.018/run. Raised from the original 10 (2026-09-06) once that
// cost was actually computed and accepted (2026-09-07) — was previously
// leaving the large majority of RSS articles in a given run (144 of 154 in
// one real run) with no generated body at all, just the generic fallback
// summary line. (Briefly lowered to 10/4 on 2026-09-09 to fit Cloudflare
// Workers Free's subrequest cap while ingestion ran inside the Worker —
// restored now that ingestion runs directly on the GitHub Actions runner
// instead, which has no such limit.) Revisit again once real billing data
// from a few runs comes back from the Google Cloud usage page.
// Match recaps get their own separate budget so a heavy match day (dozens of
// football-data.org fixtures, which come first in the processing order) can
// never starve the RSS commentary budget — the trending-sort prioritization
// above depends on RSS items actually getting a turn.
const MAX_COMMENTARY_PER_RUN = 20;
const MAX_MATCH_RECAP_PER_RUN = 6;

// football-data.org/CricketData.org items always arrive with `body` already
// set to a template built from real match facts (see footballData.ts /
// cricketData.ts) — that's the discriminator from RSS items, which only ever
// set `sourceSnippet`.
function isMatchDataSource(sourceName: string): boolean {
  return sourceName === "football-data.org" || sourceName === "CricketData.org";
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

  const [scoreItems, newsItems, cricketItems, trendingKeywords, stockImagePools] = await Promise.all([
    fetchFootballData(),
    fetchRssNews(),
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
  // not just whatever came first in feed order.
  const sortedNewsItems = [...newsItems].sort(
    (a, b) => computeTrendingScore(b.title, trendingKeywords) - computeTrendingScore(a.title, trendingKeywords)
  );
  const rawItems: RawMatchItem[] = [...scoreItems, ...sortedNewsItems, ...cricketItems];
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
  const allHashes = rawItems.map((item) => computeDedupeHash(item.title, item.publishedAt));
  const existingHashes = new Set(
    (
      await db.article.findMany({
        where: { dedupeHash: { in: allHashes } },
        select: { dedupeHash: true },
      })
    ).map((a) => a.dedupeHash)
  );

  let ingested = 0;
  let duplicates = 0;
  let flagged = 0;
  let commentaryCalls = 0;
  let matchRecapCalls = 0;

  for (const item of rawItems) {
    if (INGEST_LIMIT !== undefined && ingested >= INGEST_LIMIT) break;

    const dedupeHash = computeDedupeHash(item.title, item.publishedAt);

    if (existingHashes.has(dedupeHash)) {
      duplicates++;
      continue;
    }
    existingHashes.add(dedupeHash);

    const quality = runQualityChecks(item.title, item.summary);
    const trendingScore = computeTrendingScore(item.title, trendingKeywords);
    const slug = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    // Priority: a real, story-specific photo the publisher's own RSS feed
    // already provides (most specific/authentic) > a team crest (no stock
    // image needed at all) > the category stock-photo fallback. The person-
    // photo lookup below only runs when neither of the first two applies.
    let stockImage = item.heroImageUrl
      ? { url: item.heroImageUrl, credit: item.heroImageCredit ?? `Photo via ${item.sourceName}`, creditUrl: item.sourceUrl }
      : item.homeCrestUrl
        ? null
        : stockImagePicker.pick(item.category);

    let body = item.body;
    if (body && isMatchDataSource(item.sourceName) && matchRecapCalls < MAX_MATCH_RECAP_PER_RUN) {
      matchRecapCalls++;
      const competitionName =
        item.category === "cricket" ? "cricket" : competitionFromSummary(item.summary) ?? "football";
      const recap = await generateMatchRecap(item.title, body, competitionName);
      if (recap) body = recap;
      await sleep(COMMENTARY_DELAY_MS);
    } else if (!body && item.sourceSnippet && commentaryCalls < MAX_COMMENTARY_PER_RUN) {
      commentaryCalls++;
      const { commentary, personNames } = await generateCommentary(item.title, item.sourceSnippet, item.sourceName);
      if (commentary) body = commentary;
      await sleep(COMMENTARY_DELAY_MS);

      // Prefer a real photo of the actual person (or co-central people) the
      // story is about over the generic category stock photo — but only
      // when the RSS feed itself didn't already give us a real photo for
      // this exact story, which is even more specific than a generic
      // Wikimedia portrait of the person.
      if (!item.heroImageUrl) {
        for (const personName of personNames) {
          const personPhoto = await fetchPersonPhoto(personName);
          if (personPhoto) {
            stockImage = personPhoto;
            break;
          }
        }
      }
    }

    await db.article.create({
      data: {
        verticalId: vertical.id,
        title: item.title,
        slug,
        summary: item.summary,
        body,
        sourceUrl: item.sourceUrl,
        sourceName: item.sourceName,
        category: item.category,
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

    ingested++;
    if (!quality.passed) flagged++;
  }

  console.log(
    `Ingest run complete: ${ingested} new articles (${flagged} flagged), ${duplicates} duplicates skipped, ` +
    `${commentaryCalls} RSS commentary calls, ${matchRecapCalls} match recap calls. ` +
    `(${scoreItems.length} from football-data.org, ${newsItems.length} from RSS, ${cricketItems.length} from CricketData.org, ${trendingKeywords.length} trending keywords checked)`
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