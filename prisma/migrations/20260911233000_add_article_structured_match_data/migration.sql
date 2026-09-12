ALTER TABLE "Article" ADD COLUMN "homeTeam" TEXT;
ALTER TABLE "Article" ADD COLUMN "awayTeam" TEXT;
ALTER TABLE "Article" ADD COLUMN "homeScore" INTEGER;
ALTER TABLE "Article" ADD COLUMN "awayScore" INTEGER;
ALTER TABLE "Article" ADD COLUMN "matchStatus" TEXT;
ALTER TABLE "Article" ADD COLUMN "kickoffAt" TIMESTAMP(3);

CREATE INDEX "Article_matchStatus_kickoffAt_idx" ON "Article"("matchStatus", "kickoffAt");
