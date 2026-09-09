import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requestPlayerId } from "./player";
import { localMode } from "./runtime";

export type RateLimitBindingName =
  | "SESSION_RATE_LIMITER"
  | "GAME_RATE_LIMITER"
  | "SEARCH_RATE_LIMITER"
  | "MEDIA_RATE_LIMITER"
  | "ABUSE_IP_RATE_LIMITER"
  | "STATS_READ_RATE_LIMITER"
  | "STATS_USER_RATE_LIMITER"
  | "STATS_IP_RATE_LIMITER";

type RateLimitBinding = { limit(options: { key: string }): Promise<{ success: boolean }> };

function clientIp(request: NextRequest) {
  return request.headers.get("cf-connecting-ip") || "unknown";
}

export async function enforceActorAndIpRateLimits(request: NextRequest, bindingName: RateLimitBindingName) {
  return await enforceRateLimit(request, bindingName) ?? await enforceRateLimit(request, "ABUSE_IP_RATE_LIMITER", "ip");
}

export async function enforceRateLimit(
  request: NextRequest,
  bindingName: RateLimitBindingName,
  identity: "player" | "ip" = "player",
) {
  if (localMode()) return null;
  const { env } = await import("cloudflare:workers");
  const binding = (env as unknown as Record<string, RateLimitBinding | undefined>)[bindingName];
  if (!binding) {
    console.error(`Missing Cloudflare rate-limit binding: ${bindingName}`);
    return NextResponse.json({ error: "Service protection is unavailable." }, { status: 503 });
  }
  const playerId = requestPlayerId(request);
  const key = identity === "ip" ? `ip:${clientIp(request)}` : playerId ? `player:${playerId}` : `ip:${clientIp(request)}`;
  const { success } = await binding.limit({ key });
  return success ? null : NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
  );
}
