import { categoryFrom } from "@/lib/categories";
import { getCurrentChallengeDate } from "@/lib/challenge";
import { canAdvanceProof, proofMatches, signGameProof, verifyGameProof } from "@/lib/game-proof";
import { HttpProblem, readJsonBody } from "@/lib/http";
import { requestPlayerId } from "@/lib/player";
import { enforceActorAndIpRateLimits } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceActorAndIpRateLimits(request, "GAME_RATE_LIMITER");
    if (limited) return limited;
    const body = await readJsonBody<{ date?: string; category?: string; attempt?: number; proof?: string }>(request);
    if (body.date !== getCurrentChallengeDate() || !Number.isInteger(body.attempt)) return NextResponse.json({ error: "Invalid challenge state." }, { status: 400 });
    const category = categoryFrom(body.category);
    const playerId = requestPlayerId(request);
    const previousProof = verifyGameProof(body.proof);
    if (!playerId || !proofMatches(previousProof, { playerId, date: body.date, category }) || !canAdvanceProof(previousProof, body.attempt)) {
      return NextResponse.json({ error: "Invalid or expired game proof. Reload the challenge." }, { status: 409 });
    }
    const attempt = previousProof.attempt + 1;
    return NextResponse.json({
      proof: signGameProof({ v: 1, playerId, date: body.date, category, attempt, completed: attempt === 6, won: false }),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof HttpProblem ? error.message : "Could not skip attempt." }, { status: error instanceof HttpProblem ? error.status : 400 });
  }
}
