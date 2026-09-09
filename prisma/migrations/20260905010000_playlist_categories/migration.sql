ALTER TABLE "Song" ADD COLUMN "sourceUrl" TEXT, ADD COLUMN "clipKey" TEXT, ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE UNIQUE INDEX "Song_sourceUrl_key" ON "Song"("sourceUrl");
ALTER TABLE "DailySong" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'legacy';
DROP INDEX "DailySong_date_key";
CREATE UNIQUE INDEX "DailySong_date_category_key" ON "DailySong"("date", "category");
ALTER TABLE "DailyResult" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'legacy';
DROP INDEX "DailyResult_date_playerHash_key";
CREATE UNIQUE INDEX "DailyResult_date_category_playerHash_key" ON "DailyResult"("date", "category", "playerHash");
