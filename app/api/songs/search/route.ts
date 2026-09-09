import { NextRequest, NextResponse } from "next/server";
import { categorySongs } from "@/lib/songs";
import { categoryFrom } from "@/lib/categories";
import { normalizeBalkanText } from "@/lib/text";
import { enforceActorAndIpRateLimits } from "@/lib/rate-limit";

const searchableText = new WeakMap<object, string>();
export async function GET(request: NextRequest) {
  try {
    const limited = await enforceActorAndIpRateLimits(request, "SEARCH_RATE_LIMITER");
    if (limited) return limited;
    const q = normalizeBalkanText((request.nextUrl.searchParams.get("q") || "").slice(0, 200));
    if (q.length < 2) return NextResponse.json([], { headers: { "Cache-Control": "private, max-age=300" } });
    const songs = await categorySongs(categoryFrom(request.nextUrl.searchParams.get("category")));
    return NextResponse.json(songs.filter(song => {
      let text = searchableText.get(song);
      if (!text) {
        text = normalizeBalkanText(`${song.artist} ${song.title}`);
        searchableText.set(song, text);
      }
      return q.split(" ").every(term => text.includes(term));
    }).slice(0, 8).map(({ id, title, artist }) => ({ id, title, artist })), { headers: { "Cache-Control": "private, max-age=300" } });
  } catch { return NextResponse.json({ error: "Search unavailable." }, { status: 503 }); }
}
