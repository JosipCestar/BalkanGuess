import { categoryOrNull, type Category } from "@/lib/categories";
import { localMode } from "@/lib/runtime";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentChallengeDate } from "@/lib/challenge";
import { summarizeDailyResults } from "@/lib/daily-stats";
import { withPrisma } from "@/lib/prisma-worker-client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { proofMatches, verifyGameProof } from "@/lib/game-proof";
import { HttpProblem, readJsonBody } from "@/lib/http";
import { requestPlayerId } from "@/lib/player";
import { enforceActorAndIpRateLimits, enforceRateLimit } from "@/lib/rate-limit";
import { readDailyStatistics, recordDailyResult } from "@/lib/daily-stats-db";

const STATS_CACHE_MS = 30_000;
type Stats = ReturnType<typeof summarizeDailyResults>;
const statsCache = new Map<string, { expiresAt: number; request: Promise<Stats> }>();

async function getStats(prisma: PrismaClient | Prisma.TransactionClient, date: string, category: Category) {
  return summarizeDailyResults(await readDailyStatistics(prisma, date, category));
}
function readCachedStats(date: string, category: Category) {
  const key = `${date}:${category}`;
  const cached = statsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.request;
  const request = withPrisma(prisma => getStats(prisma, date, category));
  statsCache.set(key, { expiresAt: Date.now() + STATS_CACHE_MS, request });
  void request.catch(() => { if (statsCache.get(key)?.request === request) statsCache.delete(key); });
  return request;
}
function cacheStats(date: string, category: Category, statistics: Stats) {
  statsCache.set(`${date}:${category}`, { expiresAt: Date.now() + STATS_CACHE_MS, request: Promise.resolve(statistics) });
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
    const category = categoryOrNull(request.nextUrl.searchParams.get("category"));
    if (!category) return response({ error: "Unknown category." }, 400);
    if (localMode()) return response({ ...summarizeDailyResults([]), development: true });
    return response(await readCachedStats(date, category));
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
    if (!body || typeof body !== "object" || Array.isArray(body)) return response({ error: "Request body must be a JSON object." }, 400);
    const proof = verifyGameProof(body.proof);
    const playerId = requestPlayerId(request);
    if (!proof || !proof.completed || !playerId || proof.date !== getCurrentChallengeDate()
      || !proofMatches(proof, { playerId, date: proof.date, category: proof.category })) return response({ error: "Invalid completed result proof." }, 400);

    if (localMode()) return response({ ...summarizeDailyResults([]), development: true });
    const { date, category, won, attempt } = proof;
    const playerHash = createHash("sha256").update(playerId).digest("hex");
    const statistics = summarizeDailyResults(await withPrisma(prisma => recordDailyResult(
      prisma,
      { date, category, playerHash, won, attempt },
    )));

    cacheStats(date, category, statistics);
    return NextResponse.json(statistics, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not save daily statistics:", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return response({ error: error instanceof HttpProblem ? error.message : "Could not save daily statistics." }, error instanceof HttpProblem ? error.status : 500);
  }
}
