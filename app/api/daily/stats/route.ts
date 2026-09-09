import { categoryFrom, type Category } from "@/lib/categories";
import { localMode } from "@/lib/runtime";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentChallengeDate } from "@/lib/challenge";
import { isValidCompletedResult, summarizeDailyResults } from "@/lib/daily-stats";
import { withPrisma } from "@/lib/prisma-client";
import type { PrismaClient } from "@prisma/client";

const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getStats(prisma: PrismaClient, date: string, category: Category) {
  const groups = await prisma.dailyResult.groupBy({
    by: ["won", "attempt"],
    where: { date, category },
    _count: { _all: true },
  });

  return summarizeDailyResults(groups.map(group => ({
    won: group.won,
    attempt: group.attempt,
    count: group._count._all,
  })));
}
function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    if (date !== getCurrentChallengeDate()) return response({ error: "Invalid challenge date." }, 400);
    if (localMode()) return response({ ...summarizeDailyResults([]), development: true });
    return response(await withPrisma(prisma => getStats(prisma, date, categoryFrom(request.nextUrl.searchParams.get("category")))));
  } catch (error) {
    console.error("Could not load daily statistics:", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return response({ error: "Could not load daily statistics." }, 500);
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { date?: string; category?: string; playerId?: string; won?: boolean; attempt?: number };
    const date = body.date;
    if (date !== getCurrentChallengeDate()
      || typeof body.playerId !== "string"
      || !PLAYER_ID.test(body.playerId)
      || !isValidCompletedResult(body.won, body.attempt)) {
      return response({ error: "Invalid completed result." }, 400);
    }

    if (localMode()) return response({ ...summarizeDailyResults([]), development: true });
    const category = categoryFrom(body.category);
    const won = body.won as boolean;
    const attempt = body.attempt as number;
    const playerHash = createHash("sha256").update(body.playerId).digest("hex");
    const statistics = await withPrisma(async prisma => {
      await prisma.dailyResult.upsert({
        where: { date_category_playerHash: { date, category, playerHash } },
        update: {},
        create: { date, category, playerHash, won, attempt },
      });
      return getStats(prisma, date, category);
    });

    return response(statistics);
  } catch (error) {
    console.error("Could not save daily statistics:", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return response({ error: "Could not save daily statistics." }, 500);
  }
}
