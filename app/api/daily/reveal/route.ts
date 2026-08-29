import { NextRequest, NextResponse } from "next/server";
import { getDailySong } from "@/lib/daily";
import { getCurrentChallengeDate } from "@/lib/challenge";
export async function POST(request: NextRequest) { try { const { date } = await request.json() as { date?: string }; if (date !== getCurrentChallengeDate()) return NextResponse.json({ error: "Invalid challenge date." }, { status: 400 }); const song = await getDailySong(date); if (!song) return NextResponse.json({ error: "No songs configured." }, { status: 503 }); return NextResponse.json({ answer: { artist: song.artist, title: song.title, soundcloudUrl: song.soundcloudUrl } }); } catch { return NextResponse.json({ error: "Could not reveal answer." }, { status: 400 }); } }
