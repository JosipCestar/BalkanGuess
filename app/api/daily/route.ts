import { NextRequest, NextResponse } from "next/server";
import { challengeNumber, getCurrentChallengeDate } from "@/lib/challenge";
import { categoryFrom, CATEGORIES } from "@/lib/categories";
import { getDailySong } from "@/lib/daily";
import { localMode } from "@/lib/runtime";
export async function GET(request: NextRequest) {
  try {
    const category = categoryFrom(request.nextUrl.searchParams.get("category"));
    const date = getCurrentChallengeDate();
    const song = await getDailySong(date, category);
    return NextResponse.json({ challengeNumber: challengeNumber(date), date, category, categories: CATEGORIES, ready: !!song, development: localMode(), attempts: 6 }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not load challenge." }, { status: 503 }); }
}
