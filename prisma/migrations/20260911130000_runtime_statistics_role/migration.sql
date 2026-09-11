-- The public Worker receives only EXECUTE on these narrowly scoped functions.
-- Migrations and playlist maintenance continue to use the administrative role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'balkanguess_runtime') THEN
    CREATE ROLE balkanguess_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM balkanguess_runtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM balkanguess_runtime;
GRANT USAGE ON SCHEMA public TO balkanguess_runtime;

CREATE OR REPLACE FUNCTION public.read_daily_statistics(p_date TEXT, p_category TEXT)
RETURNS TABLE (won BOOLEAN, attempt INTEGER, count INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT aggregate."won", aggregate."attempt", aggregate."count"
  FROM public."DailyAggregate" AS aggregate
  WHERE aggregate."date" = p_date AND aggregate."category" = p_category;
$$;

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

REVOKE ALL ON FUNCTION public.read_daily_statistics(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_daily_result(TEXT, TEXT, TEXT, BOOLEAN, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_daily_statistics(TEXT, TEXT) TO balkanguess_runtime;
GRANT EXECUTE ON FUNCTION public.record_daily_result(TEXT, TEXT, TEXT, BOOLEAN, INTEGER) TO balkanguess_runtime;

CREATE INDEX IF NOT EXISTS "DailyResult_date_idx" ON public."DailyResult"("date");
