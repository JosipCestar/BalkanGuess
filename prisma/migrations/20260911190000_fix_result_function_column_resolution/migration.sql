-- RETURNS TABLE creates PL/pgSQL variables named won, attempt, and count.
-- Prefer table columns when those names appear in INSERT conflict targets.
CREATE OR REPLACE FUNCTION public.record_daily_result(
  p_date TEXT,
  p_category TEXT,
  p_player_hash TEXT,
  p_won BOOLEAN,
  p_attempt INTEGER
)
RETURNS TABLE (won BOOLEAN, attempt INTEGER, count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
#variable_conflict use_column
DECLARE
  inserted_rows INTEGER;
BEGIN
  IF p_date <> (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zagreb')::DATE::TEXT THEN
    RAISE EXCEPTION 'Only the current Zagreb challenge date can be recorded' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public."DailyResult" ("date", "category", "playerHash", "won", "attempt")
  VALUES (p_date, p_category, p_player_hash, p_won, p_attempt)
  ON CONFLICT ("date", "category", "playerHash") DO NOTHING;

  GET DIAGNOSTICS inserted_rows = ROW_COUNT;
  IF inserted_rows = 1 THEN
    INSERT INTO public."DailyAggregate" ("date", "category", "won", "attempt", "count")
    VALUES (p_date, p_category, p_won, p_attempt, 1)
    ON CONFLICT ("date", "category", "won", "attempt") DO UPDATE
      SET "count" = public."DailyAggregate"."count" + 1;
  END IF;

  RETURN QUERY
    SELECT aggregate."won", aggregate."attempt", aggregate."count"
    FROM public."DailyAggregate" AS aggregate
    WHERE aggregate."date" = p_date AND aggregate."category" = p_category;
END;
$$;

REVOKE ALL ON FUNCTION public.record_daily_result(TEXT, TEXT, TEXT, BOOLEAN, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_daily_result(TEXT, TEXT, TEXT, BOOLEAN, INTEGER) TO balkanguess_runtime;
