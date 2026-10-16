-- Decision log: one row per reel/Short decision (posted, failed or skipped, and why) with the features it was made
-- with, so the automation's choices can be analysed against the engagement numbers. Additive; nothing else changes.
CREATE TABLE IF NOT EXISTS "PostDecision" (
  "id" text PRIMARY KEY,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "articleId" text,
  "platform" text NOT NULL,
  "destination" text NOT NULL,
  "kind" text NOT NULL,
  "outcome" text NOT NULL,
  "reason" text,
  "features" jsonb,
  "externalPostId" text
);
CREATE INDEX IF NOT EXISTS "PostDecision_createdAt_idx" ON "PostDecision" ("createdAt");
CREATE INDEX IF NOT EXISTS "PostDecision_article_idx" ON "PostDecision" ("articleId");
CREATE INDEX IF NOT EXISTS "PostDecision_stream_idx" ON "PostDecision" ("platform", "destination", "createdAt");
