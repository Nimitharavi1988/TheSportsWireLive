-- Match predictions: auto-created "Who will win?" polls that resolve after full time.
-- Additive and safe to re-run. Existing editorial polls keep kind = 'editorial'.
-- Rollback:
--   ALTER TABLE "Poll" DROP COLUMN "kind", DROP COLUMN "resolvedOptionId", DROP COLUMN "resolvedAt";
--   ALTER TABLE "PollOption" DROP COLUMN "outcome";
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'editorial';
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "resolvedOptionId" text;
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "resolvedAt" timestamp(3);
ALTER TABLE "PollOption" ADD COLUMN IF NOT EXISTS "outcome" text;
CREATE INDEX IF NOT EXISTS "Poll_kind_resolvedAt_idx" ON "Poll" ("kind", "resolvedAt");
