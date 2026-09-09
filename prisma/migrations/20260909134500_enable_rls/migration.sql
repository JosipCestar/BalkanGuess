-- The application accesses PostgreSQL only through its server-side Prisma client.
-- No anon or authenticated Data API policies are intentionally created.
ALTER TABLE public."Song" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DailySong" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DailyResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
