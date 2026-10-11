-- One row per anonymous visitor (voter cookie id) per day they were active.
-- Drives streaks, fan-card badges and the return-rate report. Additive, safe to re-run.
-- Rollback: DROP TABLE "FanVisit";
CREATE TABLE IF NOT EXISTS "FanVisit" (
  "voterId"   text NOT NULL,
  "day"       text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("voterId", "day")
);
CREATE INDEX IF NOT EXISTS "FanVisit_day_idx" ON "FanVisit" ("day");
