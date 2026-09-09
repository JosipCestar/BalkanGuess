CREATE TABLE public."DailyAggregate" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "won" BOOLEAN NOT NULL,
    "attempt" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DailyAggregate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyAggregate_date_category_won_attempt_key"
ON public."DailyAggregate"("date", "category", "won", "attempt");

INSERT INTO public."DailyAggregate" ("date", "category", "won", "attempt", "count")
SELECT "date", "category", "won", "attempt", COUNT(*)::INTEGER
FROM public."DailyResult"
GROUP BY "date", "category", "won", "attempt";

ALTER TABLE public."DailyResult"
  ADD CONSTRAINT "DailyResult_date_format_check" CHECK ("date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  ADD CONSTRAINT "DailyResult_category_check" CHECK ("category" IN ('legacy', 'club-mix', 'jala-buba', 'exyu')),
  ADD CONSTRAINT "DailyResult_player_hash_check" CHECK ("playerHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "DailyResult_attempt_check" CHECK ("attempt" BETWEEN 1 AND 6),
  ADD CONSTRAINT "DailyResult_completion_check" CHECK ("won" OR "attempt" = 6);

ALTER TABLE public."DailyAggregate"
  ADD CONSTRAINT "DailyAggregate_date_format_check" CHECK ("date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  ADD CONSTRAINT "DailyAggregate_category_check" CHECK ("category" IN ('legacy', 'club-mix', 'jala-buba', 'exyu')),
  ADD CONSTRAINT "DailyAggregate_attempt_check" CHECK ("attempt" BETWEEN 1 AND 6),
  ADD CONSTRAINT "DailyAggregate_completion_check" CHECK ("won" OR "attempt" = 6),
  ADD CONSTRAINT "DailyAggregate_count_check" CHECK ("count" > 0);

DROP INDEX IF EXISTS public."DailyResult_date_idx";

ALTER TABLE public."DailyAggregate" ENABLE ROW LEVEL SECURITY;
