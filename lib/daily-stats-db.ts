import type { Category } from "./categories";
import type { Prisma, PrismaClient } from "@prisma/client";

export type DailyStatisticsRow = { won: boolean; attempt: number; count: number };
type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export function readDailyStatistics(client: DatabaseClient, date: string, category: Category) {
  return client.$queryRaw<DailyStatisticsRow[]>`
    SELECT * FROM public.read_daily_statistics(${date}, ${category})
  `;
}

export function recordDailyResult(
  client: DatabaseClient,
  result: { date: string; category: Category; playerHash: string; won: boolean; attempt: number },
) {
  return client.$queryRaw<DailyStatisticsRow[]>`
    SELECT * FROM public.record_daily_result(
      ${result.date}, ${result.category}, ${result.playerHash}, ${result.won}, ${result.attempt}
    )
  `;
}
