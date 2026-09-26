// Drizzle schema, hand-translated from prisma/schema.prisma (2026-09-19
// Prisma -> Drizzle migration). Table/column names match Prisma's defaults
// exactly (no @@map/@map anywhere in the Prisma schema, so table names are
// the model names as-written and column names are the field names
// as-written) -- confirmed directly against the real database via a raw
// SQL query during the migration's own feasibility test.
import { pgTable, pgEnum, text, boolean, doublePrecision, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const articleStatusEnum = pgEnum("ArticleStatus", [
  "ingested", "auto_checked", "flagged", "pending_review", "approved", "published", "rejected",
]);
// "push" added 2026-09-24 for automated breaking-news push notifications
// (see autoApprove.ts's sendAutomatedPushNotifications) -- reuses this
// table/enum rather than a bespoke Article column so idempotency (has this
// article already been pushed) and the daily cap both use the exact same
// query shape already established here for Facebook/Instagram.
export const socialPlatformEnum = pgEnum("SocialPlatform", ["facebook", "x", "instagram", "push"]);
export const socialPostStatusEnum = pgEnum("SocialPostStatus", ["queued", "posted", "failed"]);
export const reactionTypeEnum = pgEnum("ReactionType", ["hype", "panic", "neutral"]);

export type ReactionType = (typeof reactionTypeEnum.enumValues)[number];
export type ArticleStatus = (typeof articleStatusEnum.enumValues)[number];

export const vertical = pgTable("Vertical", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  domain: text("domain"),
  facebookPageId: text("facebookPageId"),
  facebookPageAccessToken: text("facebookPageAccessToken"),
  instagramBusinessAccountId: text("instagramBusinessAccountId"),
  createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
});

export const article = pgTable("Article", {
  id: text("id").primaryKey(),
  verticalId: text("verticalId").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  summary: text("summary").notNull(),
  body: text("body"),
  sourceUrl: text("sourceUrl").notNull(),
  sourceName: text("sourceName").notNull(),
  category: text("category").notNull(),
  status: articleStatusEnum("status").notNull().default("ingested"),
  profanityFlag: boolean("profanityFlag").notNull().default(false),
  profanityDetail: text("profanityDetail"),
  readabilityScore: doublePrecision("readabilityScore"),
  trendingScore: doublePrecision("trendingScore").notNull().default(0),
  reviewedBy: text("reviewedBy"),
  reviewedAt: timestamp("reviewedAt", { precision: 3 }),
  publishedAt: timestamp("publishedAt", { precision: 3 }),
  dedupeHash: text("dedupeHash").notNull().unique(),
  homeCrestUrl: text("homeCrestUrl"),
  awayCrestUrl: text("awayCrestUrl"),
  heroImageUrl: text("heroImageUrl"),
  heroImageCredit: text("heroImageCredit"),
  heroImageCreditUrl: text("heroImageCreditUrl"),
  featured: boolean("featured").notNull().default(false),
  featuredAt: timestamp("featuredAt", { precision: 3 }),
  highlighted: boolean("highlighted").notNull().default(false),
  highlightedAt: timestamp("highlightedAt", { precision: 3 }),
  playerNewsSourced: boolean("playerNewsSourced").notNull().default(false),
  homeTeam: text("homeTeam"),
  awayTeam: text("awayTeam"),
  homeScore: integer("homeScore"),
  awayScore: integer("awayScore"),
  matchStatus: text("matchStatus"),
  kickoffAt: timestamp("kickoffAt", { precision: 3 }),
  homeScoreText: text("homeScoreText"),
  awayScoreText: text("awayScoreText"),
  // Why ingestion/auto-approval rejected it ("source page unreadable (http
  // 403)", "AI returned no write-up", ...), for diagnosing sources.
  rejectionReason: text("rejectionReason"),
  seriesKey: text("seriesKey"),
  seriesLabel: text("seriesLabel"),
  venue: text("venue"),
  // Scoreboard fields (added 2026-09-25 via ALTER TABLE, all nullable, for
  // the standardized score cards / match header — see src/lib/scores/).
  // Written by match-data sources only; null for everything else.
  // "NFL · Week 4", "Premier League", "India v West Indies" — the heading a
  // game is grouped under on /scores.
  leagueLabel: text("leagueLabel"),
  // Live status only ("Q3 · 8:42", "Halftime", "67'"); null before kickoff
  // and after the final, so a stale clock can never outlive the game.
  matchClock: text("matchClock"),
  // One-line situation under the score ("India need 93 runs from 70 balls").
  matchNote: text("matchNote"),
  // Team records at the time of the game ("3-0"), when the source has them.
  homeRecord: text("homeRecord"),
  awayRecord: text("awayRecord"),
  // TV/stream channel for upcoming games ("FOX"), when the source has it.
  broadcast: text("broadcast"),
  // Provider-independent identity: `${category}:${yyyy-mm-dd}:${home}-v-${away}`
  // (slugified). dedupeHash stays provider-specific (espn-nfl-<id>); this is
  // what lets a second provider be compared against, or swapped in for, the
  // first without creating a duplicate match. See lib/scores/matchKey.ts.
  matchKey: text("matchKey"),
  // Added 2026-09-24 ahead of a planned (not yet implemented) Spanish-
  // language content pipeline -- default 'en' means every existing row and
  // every current (English-only) ingestion source is unaffected. Drives the
  // Postgres text-search config choice for `searchVector` below (English
  // stemming is wrong for Spanish text, and vice versa), and is the same
  // field a future <html lang>/hreflang/RSS <language> implementation would
  // need -- cheap to add now, expensive to retrofit once searchVector's
  // GENERATED expression and 18,000+ rows already assume English-only.
  language: text("language").notNull().default("en"),
  // GENERATED ALWAYS AS ... STORED in Postgres itself (see the migration
  // that added this column) -- Postgres maintains it automatically on every
  // insert/update, so it's intentionally NOT a normal Drizzle column here
  // (the app never writes to it directly, only queries against it via raw
  // sql`"searchVector"` fragments, same pattern as titleMatch.ts's regex
  // helper). Declaring it here is just documentation of what really exists
  // in the table -- Drizzle has no native tsvector column type to declare
  // it with anyway.
  // searchVector: tsvector, GENERATED ALWAYS AS (...) STORED — see search/page.tsx
  createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { precision: 3 }).notNull(),
}, (t) => [
  index("Article_status_idx").on(t.status),
  index("Article_category_idx").on(t.category),
  index("Article_matchStatus_kickoffAt_idx").on(t.matchStatus, t.kickoffAt),
  index("Article_seriesKey_idx").on(t.seriesKey),
  index("Article_matchKey_idx").on(t.matchKey),
]);

export const socialPost = pgTable("SocialPost", {
  id: text("id").primaryKey(),
  articleId: text("articleId").notNull(),
  platform: socialPlatformEnum("platform").notNull(),
  status: socialPostStatusEnum("status").notNull().default("queued"),
  externalPostId: text("externalPostId"),
  errorMessage: text("errorMessage"),
  postedAt: timestamp("postedAt", { precision: 3 }),
  createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
});

export const source = pgTable("Source", {
  id: text("id").primaryKey(),
  verticalId: text("verticalId").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  config: jsonb("config").notNull(),
  lastPolledAt: timestamp("lastPolledAt", { precision: 3 }),
  createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
});

// Videos from official league/broadcaster YouTube channels (created
// 2026-09-25 via CREATE TABLE, like the other schema changes). Filled by
// ingestion/youtubeVideos.ts from each channel's public RSS feed — no API
// key, no quota. Only regular videos (not Shorts) that YouTube allows to be
// embedded; played through YouTube's own player, never re-hosted.
// isHighlights + matchArticleId link a highlights video to the match story
// it's about, for the video on that match page.
// Per-event data kept outside articles (events/eventHubs.ts), e.g. a
// Games' medal table — one row per key ("asian-games-2026:medals"), holding
// the last snapshot that passed its checks.
export const eventData = pgTable("EventData", {
  key: text("key").primaryKey(),
  eventKey: text("eventKey").notNull(),
  kind: text("kind").notNull(),
  data: jsonb("data").notNull(),
  sourceUrl: text("sourceUrl").notNull(),
  fetchedAt: timestamp("fetchedAt", { precision: 3 }).notNull().defaultNow(),
}, (t) => [index("EventData_eventKey_idx").on(t.eventKey)]);

// Stored copies of third-party tables shown on the site (standings) —
// written by the ingestion job, read by pages (snapshots/read.ts).
export const dataSnapshot = pgTable("DataSnapshot", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  sourceUrl: text("sourceUrl").notNull(),
  fetchedAt: timestamp("fetchedAt", { precision: 3 }).notNull().defaultNow(),
});

export const video = pgTable("Video", {
  id: text("id").primaryKey(),
  youtubeId: text("youtubeId").notNull(),
  channelId: text("channelId").notNull(),
  channelTitle: text("channelTitle").notNull(),
  title: text("title").notNull(),
  publishedAt: timestamp("publishedAt", { precision: 3 }).notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  // Top-level sport category, same values as Article.category's first part.
  category: text("category").notNull(),
  isHighlights: boolean("isHighlights").notNull().default(false),
  matchArticleId: text("matchArticleId"),
  createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("Video_youtubeId_key").on(t.youtubeId),
  index("Video_matchArticleId_idx").on(t.matchArticleId),
  index("Video_category_publishedAt_idx").on(t.category, t.publishedAt),
]);

// Web Push subscriptions — anonymous, one row per browser that's granted
// notification permission (see ServiceWorkerRegister.tsx/public/sw.js). No
// article/user relation: an admin-triggered push (admin/actions.ts) sends
// to every row here, same "no accounts, anonymous by cookie/endpoint"
// pattern Poll/ArticleReaction already use.
export const pushSubscription = pgTable("PushSubscription", {
  id: text("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
});

export const adminUser = pgTable("AdminUser", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
});

export const poll = pgTable("Poll", {
  id: text("id").primaryKey(),
  articleId: text("articleId").notNull().unique(),
  question: text("question").notNull(),
  createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
});

export const pollOption = pgTable("PollOption", {
  id: text("id").primaryKey(),
  pollId: text("pollId").notNull(),
  text: text("text").notNull(),
}, (t) => [
  index("PollOption_pollId_idx").on(t.pollId),
]);

export const pollVote = pgTable("PollVote", {
  id: text("id").primaryKey(),
  pollId: text("pollId").notNull(),
  optionId: text("optionId").notNull(),
  cookieId: text("cookieId").notNull(),
  ipAddress: text("ipAddress"),
  createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("PollVote_pollId_cookieId_key").on(t.pollId, t.cookieId),
  index("PollVote_optionId_idx").on(t.optionId),
]);

export const articleReaction = pgTable("ArticleReaction", {
  id: text("id").primaryKey(),
  articleId: text("articleId").notNull(),
  type: reactionTypeEnum("type").notNull(),
  cookieId: text("cookieId").notNull(),
  ipAddress: text("ipAddress"),
  createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ArticleReaction_articleId_cookieId_key").on(t.articleId, t.cookieId),
  index("ArticleReaction_articleId_type_idx").on(t.articleId, t.type),
]);

// Relations (mirrors Prisma's implicit relations, needed for Drizzle's
// relational query API — `db.query.article.findMany({ with: {...} })`).
export const articleRelations = relations(article, ({ one, many }) => ({
  vertical: one(vertical, { fields: [article.verticalId], references: [vertical.id] }),
  socialPosts: many(socialPost),
  poll: one(poll, { fields: [article.id], references: [poll.articleId] }),
  reactions: many(articleReaction),
}));

export const verticalRelations = relations(vertical, ({ many }) => ({
  articles: many(article),
  sources: many(source),
}));

export const socialPostRelations = relations(socialPost, ({ one }) => ({
  article: one(article, { fields: [socialPost.articleId], references: [article.id] }),
}));

export const sourceRelations = relations(source, ({ one }) => ({
  vertical: one(vertical, { fields: [source.verticalId], references: [vertical.id] }),
}));

export const pollRelations = relations(poll, ({ one, many }) => ({
  article: one(article, { fields: [poll.articleId], references: [article.id] }),
  options: many(pollOption),
  votes: many(pollVote),
}));

export const pollOptionRelations = relations(pollOption, ({ one, many }) => ({
  poll: one(poll, { fields: [pollOption.pollId], references: [poll.id] }),
  votes: many(pollVote),
}));

export const pollVoteRelations = relations(pollVote, ({ one }) => ({
  poll: one(poll, { fields: [pollVote.pollId], references: [poll.id] }),
  option: one(pollOption, { fields: [pollVote.optionId], references: [pollOption.id] }),
}));

export const articleReactionRelations = relations(articleReaction, ({ one }) => ({
  article: one(article, { fields: [articleReaction.articleId], references: [article.id] }),
}));
