import { NextRequest, NextResponse } from "next/server";
import { challengeNumber, getCurrentChallengeDate } from "@/lib/challenge";
import { categoryOrNull, CATEGORIES } from "@/lib/categories";
import { getDailySong } from "@/lib/daily";
import { localMode } from "@/lib/runtime";
import { getOrCreatePlayer, setPlayerCookie } from "@/lib/player";
import { signGameProof } from "@/lib/game-proof";
import { enforceRateLimit } from "@/lib/rate-limit";
export async function GET(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, "SESSION_RATE_LIMITER", "ip");
    if (limited) return limited;
    const category = categoryOrNull(request.nextUrl.searchParams.get("category"));
    if (!category) return NextResponse.json({ error: "Unknown category." }, { status: 400 });
    const date = getCurrentChallengeDate();
    const song = await getDailySong(date, category);
    const { playerId, isNew } = getOrCreatePlayer(request);
    const proof = signGameProof({ v: 1, playerId, date, category, attempt: 0, completed: false, won: false });
    const audioUrl = song ? `/api/daily/clip?category=${category}&date=${date}` : null;
    const response = NextResponse.json({ challengeNumber: challengeNumber(date), date, category, categories: CATEGORIES, ready: !!song, development: localMode(), attempts: 6, proof, audioUrl }, { headers: { "Cache-Control": "private, no-store" } });
    if (isNew) setPlayerCookie(response, playerId, request.nextUrl.protocol === "https:");
    return response;
  } catch (error) {
    console.error("Could not load daily challenge:", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return NextResponse.json({ error: "Could not load challenge." }, { status: 503 });
  }
}
