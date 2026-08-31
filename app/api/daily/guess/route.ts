import { NextRequest, NextResponse } from "next/server";
import { getDailySong } from "@/lib/daily";
import { getCurrentChallengeDate } from "@/lib/challenge";
import { haveMatchingArtistCredit } from "@/lib/artist";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { date?: string; guessedSongId?: number };
    if (body.date !== getCurrentChallengeDate() || !Number.isInteger(body.guessedSongId)) {
      return NextResponse.json({ error: "Invalid daily guess." }, { status: 400 });
    }

    const daily = await getDailySong(body.date);
    if (!daily) return NextResponse.json({ error: "No songs configured." }, { status: 503 });

    const correct = daily.id === body.guessedSongId;
    if (correct) {
      return NextResponse.json({
        correct,
        artistMatch: true,
        answer: { artist: daily.artist, title: daily.title, soundcloudUrl: daily.soundcloudUrl },
      });
    }

    const guessed = await prisma.song.findUnique({
      where: { id: body.guessedSongId },
      select: { artist: true, active: true },
    });
    if (!guessed?.active) return NextResponse.json({ error: "Invalid song selection." }, { status: 400 });

    return NextResponse.json({
      correct,
      artistMatch: haveMatchingArtistCredit(daily.artist, guessed.artist),
    });
  } catch {
    return NextResponse.json({ error: "Could not validate guess." }, { status: 400 });
  }
}
