ALTER TABLE public."DailyResult" DROP CONSTRAINT "DailyResult_category_check";
ALTER TABLE public."DailyResult"
  ADD CONSTRAINT "DailyResult_category_check" CHECK ("category" IN ('legacy', 'club-mix', 'jala-buba', 'exyu', 'trap'));

ALTER TABLE public."DailyAggregate" DROP CONSTRAINT "DailyAggregate_category_check";
ALTER TABLE public."DailyAggregate"
  ADD CONSTRAINT "DailyAggregate_category_check" CHECK ("category" IN ('legacy', 'club-mix', 'jala-buba', 'exyu', 'trap'));
