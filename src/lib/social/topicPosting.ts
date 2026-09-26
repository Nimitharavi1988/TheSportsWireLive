/**
 * Posts to the topic Facebook Pages (facebookDestinations.ts) — runs after
 * the main Page's posting in autoApprove.ts. Per Page: how many it may post
 * this run (its daily limit spread over its active hours), which recent
 * published stories fit its topic and haven't gone to it yet, and the same
 * same-story protection as the main Page (titleSimilarity.ts). Each Page
 * has its own history (SocialPost.destination), so a story can go to the
 * main Page and a topic Page independently.
 */
import { db } from "@/db";
import { article, socialPost } from "@/db/schema";
import { and, count, desc, eq, gte, inArray, like } from "drizzle-orm";
import { isMatchDataSource } from "../matchDataSources";
import { hasRealImage } from "../contentQuality";
import { isSimilarToAny } from "../titleSimilarity";
import { postArticleToFacebook } from "./facebook";
import { TOPIC_DESTINATIONS, destinationRunCap, localDayStart, type FacebookDestination } from "./facebookDestinations";

const POOL_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const SIMILARITY_WINDOW_MS = 24 * 60 * 60 * 1000;

// dryRun: select and report only — no token needed, nothing is posted.
async function postToDestination(d: FacebookDestination, now: Date, dryRun: boolean): Promise<{ id: string; title: string }[]> {
  if (!dryRun && !process.env[d.tokenEnv]) {
    console.log(`[facebook:${d.key}] skipped — ${d.tokenEnv} not set`);
    return [];
  }
  const dayStart = localDayStart(now, d.activeHours.timeZone);
  const [{ value: postedToday }] = await db.select({ value: count() }).from(socialPost)
    .where(and(eq(socialPost.platform, "facebook"), eq(socialPost.destination, d.key), gte(socialPost.createdAt, dayStart)));
  const runCap = destinationRunCap(d, postedToday, now);
  if (runCap === 0) {
    console.log(`[facebook:${d.key}] postedToday=${postedToday} runCap=0`);
    return [];
  }

  const [pool, postedRows, recentTitleRows] = await Promise.all([
    db.select({
      id: article.id, title: article.title, category: article.category, sourceName: article.sourceName,
      homeTeam: article.homeTeam, awayTeam: article.awayTeam, seriesLabel: article.seriesLabel, leagueLabel: article.leagueLabel,
      venue: article.venue, matchStatus: article.matchStatus, heroImageUrl: article.heroImageUrl, homeCrestUrl: article.homeCrestUrl,
      trendingScore: article.trendingScore,
    }).from(article)
      .where(and(eq(article.status, "published"), like(article.category, `${d.sport}%`), gte(article.publishedAt, new Date(now.getTime() - POOL_WINDOW_MS))))
      .orderBy(desc(article.trendingScore), desc(article.publishedAt))
      .limit(500),
    db.select({ articleId: socialPost.articleId }).from(socialPost)
      .where(and(eq(socialPost.platform, "facebook"), eq(socialPost.destination, d.key), inArray(socialPost.status, ["posted", "queued"]))),
    db.select({ title: article.title }).from(socialPost)
      .innerJoin(article, eq(socialPost.articleId, article.id))
      .where(and(eq(socialPost.platform, "facebook"), eq(socialPost.destination, d.key), eq(socialPost.status, "posted"), gte(socialPost.postedAt, new Date(now.getTime() - SIMILARITY_WINDOW_MS)))),
  ]);
  const posted = new Set(postedRows.map((r) => r.articleId));
  const chosenTitles = recentTitleRows.map((r) => r.title);

  const toPost: { id: string; title: string }[] = [];
  const limit = dryRun ? d.dailyCap : runCap;
  for (const a of pool) {
    if (toPost.length >= limit) break;
    if (posted.has(a.id) || !d.matches(a)) continue;
    const matchData = isMatchDataSource(a.sourceName);
    // Every post needs a real picture (match rows can publish without one —
    // see isAutoApprovable); match data only once there's a result (not
    // "Preview: ..." cards for games that haven't happened).
    if (!hasRealImage(a) || (matchData && a.matchStatus !== "finished")) continue;
    // Same-story protection, as on the main Page (not for match data: each
    // match row is already the one canonical story for that game).
    // Exact same headline too — the overlap check needs a few words, so a
    // one-word title ("Stumped") from two outlets would slip past it.
    const norm = a.title.trim().toLowerCase();
    if (chosenTitles.some((t) => t.trim().toLowerCase() === norm)) continue;
    if (!matchData && isSimilarToAny(a.title, chosenTitles)) continue;
    toPost.push(a);
    chosenTitles.push(a.title);
  }
  console.log(`[facebook:${d.key}] postedToday=${postedToday} runCap=${runCap} toPost=${toPost.length}`);

  if (dryRun) return toPost;
  for (const a of toPost) {
    try {
      const ok = await postArticleToFacebook(a.id, d);
      console.log(`[facebook:${d.key}] ${ok ? "posted" : "skipped (already posted)"} ${a.id} ("${a.title.slice(0, 60)}")`);
    } catch (err) {
      console.error(`[facebook:${d.key}] post failed for ${a.id}:`, err);
      // Same token/limit error would repeat for every story — stop this Page for this run.
      break;
    }
  }
  return toPost;
}

export async function postToTopicPages(now: Date = new Date(), opts: { dryRun?: boolean } = {}): Promise<Record<string, { id: string; title: string }[]>> {
  const picked: Record<string, { id: string; title: string }[]> = {};
  for (const d of TOPIC_DESTINATIONS) {
    try {
      picked[d.key] = await postToDestination(d, now, Boolean(opts.dryRun));
    } catch (err) {
      // One Page's failure never affects the others (or the main Page).
      console.error(`[facebook:${d.key}] failed:`, err);
    }
  }
  return picked;
}
