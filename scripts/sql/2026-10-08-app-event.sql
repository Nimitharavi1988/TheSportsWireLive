-- Install-funnel counters. NOT YET RUN -- review first. Additive, safe to re-run.
-- Rollback: DROP TABLE "AppEvent";
CREATE TABLE IF NOT EXISTS "AppEvent" (
  "day"   text    NOT NULL,
  "kind"  text    NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("day", "kind")
);
