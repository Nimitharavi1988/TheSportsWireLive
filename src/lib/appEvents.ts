/**
 * Anonymous daily counters (AppEvent table: day, kind, count). No visitor id.
 * Client-sent kinds are whitelisted by /api/app-event; server-side kinds
 * (visit, prediction and badge counters) are written with bumpAppEvent only.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { appEvent } from "@/db/schema";

export const CLIENT_APP_EVENT_KINDS = new Set([
  "session", "standalone_launch", "install_banner_shown", "ios_banner_shown",
  "inapp_browser_tip_shown", "inapp_browser_tip_clicked", "install_clicked", "install_accepted", "install_declined", "app_installed",
  // Fan card: opened the page, tapped the header streak chip.
  "fan_card_opened", "fan_chip_clicked", "fan_chip_shown",
  // Favourites (follows) and For You: adds/removes by kind, sessions that have any follow,
  // the invitation strip shown / clicked, the For You page opened.
  "follow_added", "follow_removed",
  "follow_added_club", "follow_added_player", "follow_added_country", "follow_added_sport", "follow_added_series",
  "follows_active", "for_you_strip_shown", "for_you_strip_clicked", "for_you_page_opened",
  // One-tap favourite chips (strip and For You page): shown, and a first-time follow from a chip.
  "quick_picks_shown", "quick_pick_followed",
  // Follow chips under an article's team and player tags: on screen, and a first-time follow from them.
  "article_follow_shown", "article_follow_added",
  // Home page "Today's picks" row: shown, and a first-time pick made from it.
  "picks_row_shown", "picks_row_voted",
  // Cards on a match page: prediction / rating card on screen.
  "prediction_shown", "rating_shown",
]);

export async function bumpAppEvent(kind: string, now: Date = new Date()): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  await db.insert(appEvent).values({ day, kind, count: 1 })
    .onConflictDoUpdate({ target: [appEvent.day, appEvent.kind], set: { count: sql`${appEvent.count} + 1` } });
}

// Counting must never break the feature it measures.
export async function bumpAppEventQuietly(kind: string): Promise<void> {
  try {
    await bumpAppEvent(kind);
  } catch (err) {
    console.error(`app event ${kind} failed:`, err);
  }
}
