CREATE TABLE "DailyResult" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "playerHash" TEXT NOT NULL,
    "won" BOOLEAN NOT NULL,
    "attempt" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyResult_date_playerHash_key" ON "DailyResult"("date", "playerHash");
CREATE INDEX "DailyResult_date_idx" ON "DailyResult"("date");
