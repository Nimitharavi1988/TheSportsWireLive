/**
 * Automatic Reels for the topic Facebook Pages (facebookDestinations.ts,
 * `reels` setting). Own history (SocialPost.destination "<key>-reel"), own
 * daily limit, daytime hours only. Only stories whose photo gets the
 * big-photo reel layout are picked (photoGetsBigLayout) so every Reel comes
 * out in the current look. Runs in the ingestion job (plain Node).
 */
import { db } from "@/db";
import { article, socialPost } from "@/db/schema";
import { and, count, desc, eq, gte, like, ilike, or } from "drizzle-orm";
import { isMatchDataSource } from "../matchDataSources";
import { hasRealImage } from "../contentQuality";
import { isSimilarToAny } from "../titleSimilarity";
import { TOPIC_DESTINATIONS, destinationRunCap, localDayStart } from "./facebookDestinations";
import { postReel } from "./postReel";
import { photoGetsBigLayout } from "./reel";

const POOL_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const SIMILARITY_WINDOW_MS = 24 * 60 * 60 * 1000;
// A story is only tried while the Page has had fewer failed attempts today
// than this — a token/permission problem must not burn a render and AI
// calls every run.
const MAX_FAILED_PER_DAY = 2;
// Photos checked per run, and reels attempted per run.
const MAX_PHOTO_CHECKS = 15;
const MAX_ATTEMPTS = 2;

export async function postTopicReels(now: Date = new Date()): Promise<void> {
  for (const d of TOPIC_DESTINATIONS) {
    if (!d.reels || !process.env[d.tokenEnv]) continue;
    try {
      const key = `${d.key}-reel`;
      const dayStart = localDayStart(now, d.activeHours.timeZone);
      const today = await db.select({ status: socialPost.status }).from(socialPost)
        .where(and(eq(socialPost.platform, "facebook"), eq(socialPost.destination, key), gte(socialPost.createdAt, dayStart)));
      const posted = today.filter((r) => r.status === "posted").length;
      const failed = today.filter((r) => r.status === "failed").length;
      const runCap = destinationRunCap({ ...d.reels, activeHours: d.activeHours, overnight: false }, posted, now);
      if (runCap === 0 || failed >= MAX_FAILED_PER_DAY) {
        console.log(`[reel:${d.key}] posted=${posted} failed=${failed} runCap=${runCap} — skipping`);
        continue;
      }

      const [pool, doneRows, recentTitles] = await Promise.all([
        db.select({
          id: article.id, title: article.title, category: article.category, sourceName: article.sourceName,
          homeTeam: article.homeTeam, awayTeam: article.awayTeam, seriesLabel: article.seriesLabel, leagueLabel: article.leagueLabel,
          venue: article.venue, body: article.body, heroImageUrl: article.heroImageUrl, homeCrestUrl: article.homeCrestUrl,
        }).from(article)
          .where(and(
            eq(article.status, "published"),
            or(like(article.category, `${d.sport}%`), ...(d.alsoTitleLike ?? []).map((t) => ilike(article.title, `%${t}%`))),
            gte(article.publishedAt, new Date(now.getTime() - POOL_WINDOW_MS)),
          ))
          .orderBy(desc(article.trendingScore), desc(article.publishedAt))
          .limit(300),
        db.select({ articleId: socialPost.articleId }).from(socialPost)
          .where(and(eq(socialPost.platform, "facebook"), eq(socialPost.destination, key))),
        db.select({ title: article.title }).from(socialPost)
          .innerJoin(article, eq(socialPost.articleId, article.id))
          .where(and(eq(socialPost.platform, "facebook"), eq(socialPost.destination, key), eq(socialPost.status, "posted"), gte(socialPost.postedAt, new Date(now.getTime() - SIMILARITY_WINDOW_MS)))),
      ]);
      const done = new Set(doneRows.map((r) => r.articleId));
      const titles = recentTitles.map((r) => r.title);

      let checked = 0;
      let attempts = 0;
      let postedNow = 0;
      for (const a of pool) {
        if (postedNow >= runCap || attempts >= MAX_ATTEMPTS || checked >= MAX_PHOTO_CHECKS) break;
        if (done.has(a.id) || !a.body || !hasRealImage(a) || !d.matches(a)) continue;
        // Match rows are scorecards, not stories to narrate.
        if (isMatchDataSource(a.sourceName)) continue;
        if (isSimilarToAny(a.title, titles)) continue;
        checked++;
        if (!a.heroImageUrl || !(await photoGetsBigLayout(a.heroImageUrl))) continue;
        attempts++;
        try {
          const r = await postReel(a.id, { instagram: false, facebook: true, topicPage: d });
          console.log(`[reel:${d.key}] ${r.facebookPosted ? "posted" : "not posted"} ${a.id} ("${a.title.slice(0, 60)}")`);
          if (r.facebookPosted) {
            postedNow++;
            titles.push(a.title);
          }
        } catch (err) {
          console.error(`[reel:${d.key}] failed for ${a.id}:`, err);
        }
      }
      console.log(`[reel:${d.key}] posted=${posted}+${postedNow} runCap=${runCap} photosChecked=${checked} attempts=${attempts}`);
    } catch (err) {
      console.error(`[reel:${d.key}] failed:`, err);
    }
  }
}
