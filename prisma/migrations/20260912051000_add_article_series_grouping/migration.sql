-- Groups cricket articles into a shared series (e.g. "India vs Afghanistan, T20I")
ALTER TABLE "Article" ADD COLUMN "seriesKey" TEXT;
ALTER TABLE "Article" ADD COLUMN "seriesLabel" TEXT;

CREATE INDEX "Article_seriesKey_idx" ON "Article"("seriesKey");
