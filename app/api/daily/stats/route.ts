import { categoryFrom, type Category } from "@/lib/categories";
import { localMode } from "@/lib/runtime";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentChallengeDate } from "@/lib/challenge";
import { summarizeDailyResults } from "@/lib/daily-stats";
import { withPrisma } from "@/lib/prisma-client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { proofMatches, verifyGameProof } from "@/lib/game-proof";
import { HttpProblem, readJsonBody } from "@/lib/http";
import { requestPlayerId } from "@/lib/player";
import { enforceActorAndIpRateLimits, enforceRateLimit } from "@/lib/rate-limit";

async function getStats(prisma: PrismaClient | Prisma.TransactionClient, date: string, category: Category) {
  const groups = await prisma.dailyAggregate.findMany({
    where: { date, category },
    select: { won: true, attempt: true, count: true },
  });

  return summarizeDailyResults(groups.map(group => ({
    won: group.won,
    attempt: group.attempt,
    count: group.count,
  })));
}
function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": status === 200 ? "public, max-age=30, s-maxage=30, stale-while-revalidate=60" : "no-store" } });
}
export async function GET(request: NextRequest) {
  try {
    const limited = await enforceActorAndIpRateLimits(request, "STATS_READ_RATE_LIMITER");
    if (limited) return limited;
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
    const limitedUser = await enforceRateLimit(request, "STATS_USER_RATE_LIMITER");
    if (limitedUser) return limitedUser;
    const limitedIp = await enforceRateLimit(request, "STATS_IP_RATE_LIMITER", "ip");
    if (limitedIp) return limitedIp;
    const body = await readJsonBody<{ proof?: string }>(request);
    const proof = verifyGameProof(body.proof);
    const playerId = requestPlayerId(request);
    if (!proof || !proof.completed || !playerId || proof.date !== getCurrentChallengeDate()
      || !proofMatches(proof, { playerId, date: proof.date, category: proof.category })) return response({ error: "Invalid completed result proof." }, 400);

    if (localMode()) return response({ ...summarizeDailyResults([]), development: true });
    const { date, category, won, attempt } = proof;
    const playerHash = createHash("sha256").update(playerId).digest("hex");
    const statistics = await withPrisma(async prisma => {
      return prisma.$transaction(async transaction => {
        const inserted = await transaction.dailyResult.createMany({
          data: [{ date, category, playerHash, won, attempt }],
          skipDuplicates: true,
        });
        if (inserted.count) {
          await transaction.dailyAggregate.upsert({
            where: { date_category_won_attempt: { date, category, won, attempt } },
            update: { count: { increment: 1 } },
            create: { date, category, won, attempt, count: 1 },
          });
        }
        return getStats(transaction, date, category);
      });
    });

    return NextResponse.json(statistics, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not save daily statistics:", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return response({ error: error instanceof HttpProblem ? error.message : "Could not save daily statistics." }, error instanceof HttpProblem ? error.status : 500);
  }
}
