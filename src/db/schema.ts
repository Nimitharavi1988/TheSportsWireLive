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
  seriesKey: text("seriesKey"),
  seriesLabel: text("seriesLabel"),
  venue: text("venue"),
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
