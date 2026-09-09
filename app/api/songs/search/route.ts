import { NextRequest, NextResponse } from "next/server";
import { categorySongs } from "@/lib/songs";
import { categoryFrom } from "@/lib/categories";
import { normalizeBalkanText } from "@/lib/text";
export async function GET(request: NextRequest) {
  try {
    const q = normalizeBalkanText((request.nextUrl.searchParams.get("q") || "").slice(0, 200));
    if (!q) return NextResponse.json([]);
    const songs = await categorySongs(categoryFrom(request.nextUrl.searchParams.get("category")));
    return NextResponse.json(songs.filter(song => q.split(" ").every(term => normalizeBalkanText(`${song.artist} ${song.title}`).includes(term))).slice(0, 8).map(({ id, title, artist }) => ({ id, title, artist })));
  } catch { return NextResponse.json({ error: "Search unavailable." }, { status: 503 }); }
}
