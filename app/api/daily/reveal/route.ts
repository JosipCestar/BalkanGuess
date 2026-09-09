import { categoryFrom } from "@/lib/categories";
import { NextRequest, NextResponse } from "next/server";
import { getDailySong } from "@/lib/daily";
import { getCurrentChallengeDate } from "@/lib/challenge";
import { proofMatches, signGameProof, verifyGameProof } from "@/lib/game-proof";
import { HttpProblem, readJsonBody } from "@/lib/http";
import { requestPlayerId } from "@/lib/player";
import { enforceActorAndIpRateLimits } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceActorAndIpRateLimits(request, "GAME_RATE_LIMITER");
    if (limited) return limited;
    const { date, category: rawCategory, attempt, proof: rawProof } = await readJsonBody<{ date?: string; category?: string; attempt?: number; proof?: string }>(request);
    if (date !== getCurrentChallengeDate() || !Number.isInteger(attempt)) return NextResponse.json({ error: "Invalid challenge state." }, { status: 400 });
    const category = categoryFrom(rawCategory);
    const playerId = requestPlayerId(request);
    const previousProof = verifyGameProof(rawProof);
    if (!playerId || !proofMatches(previousProof, { playerId, date, category })) return NextResponse.json({ error: "Invalid or expired game proof. Reload the challenge." }, { status: 409 });
    if (!previousProof.completed && (attempt !== 6 || attempt < previousProof.attempt)) return NextResponse.json({ error: "The challenge is not complete." }, { status: 409 });
    const proof = previousProof.completed
      ? rawProof as string
      : signGameProof({ v: 1, playerId, date, category, attempt: 6, completed: true, won: false });
    const song = await getDailySong(date, category);
    if (!song) return NextResponse.json({ error: "No songs configured." }, { status: 503 });
    return NextResponse.json({ proof, answer: { artist: song.artist, title: song.title, soundcloudUrl: song.soundcloudUrl, sourceUrl: song.sourceUrl } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof HttpProblem ? error.message : "Could not reveal answer." }, { status: error instanceof HttpProblem ? error.status : 400 });
  }
}
