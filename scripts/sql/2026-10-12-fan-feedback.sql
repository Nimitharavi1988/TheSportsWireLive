-- Fan feedback: match ratings, private site feedback, and moderated Fan Voices.
-- All additive and safe to re-run. Visitors are the anonymous voter cookie id only.
-- Rollback: DROP TABLE "MatchRating"; DROP TABLE "SiteFeedback"; DROP TABLE "FanVoice";
CREATE TABLE IF NOT EXISTS "MatchRating" (
  "id"        text PRIMARY KEY,
  "articleId" text NOT NULL,
  "voterId"   text NOT NULL,
  "rating"    integer NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "MatchRating_articleId_voterId_key" ON "MatchRating" ("articleId", "voterId");

CREATE TABLE IF NOT EXISTS "SiteFeedback" (
  "id"        text PRIMARY KEY,
  "voterId"   text NOT NULL,
  "sentiment" text NOT NULL,
  "note"      text,
  "page"      text,
  "handled"   boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "SiteFeedback_createdAt_idx" ON "SiteFeedback" ("createdAt");

CREATE TABLE IF NOT EXISTS "FanVoice" (
  "id"         text PRIMARY KEY,
  "articleId"  text NOT NULL,
  "voterId"    text NOT NULL,
  "name"       text NOT NULL,
  "country"    text,
  "body"       text NOT NULL,
  "status"     text NOT NULL DEFAULT 'pending',
  "createdAt"  timestamp(3) NOT NULL DEFAULT now(),
  "reviewedAt" timestamp(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "FanVoice_articleId_voterId_key" ON "FanVoice" ("articleId", "voterId");
CREATE INDEX IF NOT EXISTS "FanVoice_status_createdAt_idx" ON "FanVoice" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "FanVoice_articleId_status_idx" ON "FanVoice" ("articleId", "status");
