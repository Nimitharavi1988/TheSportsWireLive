import { db } from "../db";
import { fetchFootballData, type RawMatchItem } from "./footballData";
import { fetchRssNews } from "./rssFeeds";
import { fetchCricketData } from "./cricketData";
import { computeDedupeHash } from "./dedupe";
import { runQualityChecks } from "./qualityCheck";
import { fetchTrendingKeywords, computeTrendingScore } from "./trending";

export async function runIngest() {
  const vertical = await db.vertical.upsert({
    where: { name: "sports" },
    update: {},
    create: { name: "sports" },
  });

  const [scoreItems, newsItems, cricketItems, trendingKeywords] = await Promise.all([
    fetchFootballData(),
    fetchRssNews(),
    fetchCricketData(),
    fetchTrendingKeywords(),
  ]);
  const rawItems: RawMatchItem[] = [...scoreItems, ...newsItems, ...cricketItems];

  let ingested = 0;
  let duplicates = 0;
  let flagged = 0;

  for (const item of rawItems) {
    const dedupeHash = computeDedupeHash(item.title, item.publishedAt);

    const existing = await db.article.findUnique({ where: { dedupeHash } });
    if (existing) {
      duplicates++;
      continue;
    }

    const quality = runQualityChecks(item.title, item.summary);
    const trendingScore = computeTrendingScore(item.title, trendingKeywords);
    const slug = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    await db.article.create({
      data: {
        verticalId: vertical.id,
        title: item.title,
        slug,
        summary: item.summary,
        sourceUrl: item.sourceUrl,
        sourceName: item.sourceName,
        category: item.category,
        dedupeHash,
        profanityFlag: quality.profanityFlag,
        profanityDetail: quality.profanityDetail,
        readabilityScore: quality.readabilityScore,
        trendingScore,
        homeCrestUrl: item.homeCrestUrl,
        awayCrestUrl: item.awayCrestUrl,
        status: quality.passed ? "pending_review" : "flagged",
      },
    });

    ingested++;
    if (!quality.passed) flagged++;
  }

  console.log(
    `Ingest run complete: ${ingested} new articles (${flagged} flagged), ${duplicates} duplicates skipped. ` +
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