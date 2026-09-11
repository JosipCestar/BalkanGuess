import { NextRequest, NextResponse } from "next/server";
import { dailySongFromCatalog, readRuntimeCatalog } from "@/lib/daily";
import { getCurrentChallengeDate } from "@/lib/challenge";
import { haveMatchingArtistCredit } from "@/lib/artist";
import { categoryFrom } from "@/lib/categories";
import { canAdvanceProof, proofMatches, signGameProof, verifyGameProof } from "@/lib/game-proof";
import { HttpProblem, readJsonBody } from "@/lib/http";
import { requestPlayerId } from "@/lib/player";
import { enforceActorAndIpRateLimits } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceActorAndIpRateLimits(request, "GAME_RATE_LIMITER");
    if (limited) return limited;
    const body = await readJsonBody<{ date?: string; category?: string; guessedSongId?: number; attempt?: number; proof?: string }>(request);
    if (body.date !== getCurrentChallengeDate() || !Number.isInteger(body.guessedSongId) || !Number.isInteger(body.attempt)) {
      return NextResponse.json({ error: "Invalid daily guess." }, { status: 400 });
    }

    const category = categoryFrom(body.category);
    const playerId = requestPlayerId(request);
    const previousProof = verifyGameProof(body.proof);
    if (!playerId || !proofMatches(previousProof, { playerId, date: body.date, category })
      || !canAdvanceProof(previousProof, body.attempt)) {
      return NextResponse.json({ error: "Invalid or expired game proof. Reload the challenge." }, { status: 409 });
    }
    const catalog = await readRuntimeCatalog();
    const daily = dailySongFromCatalog(catalog, body.date, category);
    if (!daily) return NextResponse.json({ error: "No songs configured." }, { status: 503 });

    const correct = daily.id === body.guessedSongId;
    const attempt = Number(body.attempt) + 1;
    const completed = correct || attempt === 6;
    const proof = signGameProof({ v: 1, playerId, date: body.date, category, attempt, completed, won: correct });
    if (correct) {
      return NextResponse.json({
        correct,
        artistMatch: true,
        proof,
        answer: { artist: daily.artist, title: daily.title, soundcloudUrl: daily.soundcloudUrl, sourceUrl: daily.sourceUrl },
      });
    }

    const guessed = catalog.songs.find(song => song.id === body.guessedSongId && song.categories.includes(category));
    if (!guessed?.active) return NextResponse.json({ error: "Invalid song selection." }, { status: 400 });

    return NextResponse.json({
      correct,
      artistMatch: haveMatchingArtistCredit(daily.artist, guessed.artist),
      proof,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof HttpProblem ? error.message : "Could not validate guess." }, { status: error instanceof HttpProblem ? error.status : 400 });
  }
}
