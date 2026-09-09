import { NextRequest, NextResponse } from "next/server";
import { getDailySong } from "@/lib/daily";
import { SoundCloudAudioProvider } from "@/lib/soundcloud/provider";
import { categoryFrom } from "@/lib/categories";
import { getCurrentChallengeDate } from "@/lib/challenge";
export async function GET(request: NextRequest) {
  try {
    const category = categoryFrom(request.nextUrl.searchParams.get("category"));
    const date = getCurrentChallengeDate();
    if (request.nextUrl.searchParams.get("date") !== date) return NextResponse.json({ error: "A new daily challenge is available. Reload the page." }, { status: 409 });
    const song = await getDailySong(date, category);
    if (!song) return NextResponse.json({ error: "This category has no prepared song yet." }, { status: 503 });
    if (song.clipKey) {
      const url = `/api/daily/clip?category=${category}&date=${date}`;
      return NextResponse.json({ url, previewStart: 0 }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const source = await new SoundCloudAudioProvider().getPlayableSource(song);
    return NextResponse.json({ ...source, previewStart: song.previewStart });
  } catch { return NextResponse.json({ error: "Audio is unavailable." }, { status: 503 }); }
}
