import { NextRequest, NextResponse } from "next/server";
import { getDailySong } from "@/lib/daily";
import { getCurrentChallengeDate } from "@/lib/challenge";
import { haveMatchingArtistCredit } from "@/lib/artist";
import { categorySongs } from "@/lib/songs";
import { categoryFrom } from "@/lib/categories";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { date?: string; category?: string; guessedSongId?: number };
    if (body.date !== getCurrentChallengeDate() || !Number.isInteger(body.guessedSongId)) {
      return NextResponse.json({ error: "Invalid daily guess." }, { status: 400 });
    }

    const category = categoryFrom(body.category);
    const daily = await getDailySong(body.date, category);
    if (!daily) return NextResponse.json({ error: "No songs configured." }, { status: 503 });

    const correct = daily.id === body.guessedSongId;
    if (correct) {
      return NextResponse.json({
        correct,
        artistMatch: true,
        answer: { artist: daily.artist, title: daily.title, soundcloudUrl: daily.soundcloudUrl, sourceUrl: daily.sourceUrl },
      });
    }

    const guessed = (await categorySongs(category)).find(song => song.id === body.guessedSongId);
    if (!guessed?.active) return NextResponse.json({ error: "Invalid song selection." }, { status: 400 });

    return NextResponse.json({
      correct,
      artistMatch: haveMatchingArtistCredit(daily.artist, guessed.artist),
    });
  } catch {
    return NextResponse.json({ error: "Could not validate guess." }, { status: 400 });
  }
}
