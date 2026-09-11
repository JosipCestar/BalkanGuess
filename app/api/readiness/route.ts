import { getCurrentChallengeDate } from "@/lib/challenge";
import { readRuntimeCatalog } from "@/lib/daily";
import { withPrisma } from "@/lib/prisma-worker-client";
import { missingCatalogCoverage, REQUIRED_COVERAGE_DAYS } from "@/lib/readiness";
import { NextResponse } from "next/server";

const CACHE_MS = 30_000;
type Check = { status: "ok" | "not_ready"; catalog: boolean; database: boolean; coverage: boolean; coverageDays: number; missing: string[] };
let cached: { expiresAt: number; request: Promise<Check> } | undefined;

async function checkReadiness(): Promise<Check> {
  const date = getCurrentChallengeDate();
  const [catalogResult, databaseResult] = await Promise.allSettled([
    readRuntimeCatalog(),
    withPrisma(prisma => prisma.dailyAggregate.findFirst({ select: { id: true } })),
  ]);
  const missing = catalogResult.status === "fulfilled" ? missingCatalogCoverage(catalogResult.value, date) : [];
  const catalog = catalogResult.status === "fulfilled";
  const database = databaseResult.status === "fulfilled";
  const coverage = catalog && missing.length === 0;
  return { status: catalog && database && coverage ? "ok" : "not_ready", catalog, database, coverage, coverageDays: REQUIRED_COVERAGE_DAYS, missing };
}

function readCheck() {
  if (cached && cached.expiresAt > Date.now()) return cached.request;
  const request = checkReadiness();
  cached = { expiresAt: Date.now() + CACHE_MS, request };
  return request;
}

export async function GET() {
  const result = await readCheck();
  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "public, max-age=15, s-maxage=15" },
  });
}
