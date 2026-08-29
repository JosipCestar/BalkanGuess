import { NextResponse } from "next/server";
import { getDailySong } from "@/lib/daily";
import { SoundCloudAudioProvider } from "@/lib/soundcloud/provider";
export async function GET() { try { const song = await getDailySong(); if (!song) return NextResponse.json({ error: "No songs configured." }, { status: 503 }); const source = await new SoundCloudAudioProvider().getPlayableSource(song); return NextResponse.json({ ...source, previewStart: song.previewStart }); } catch (error) { console.error("Daily audio unavailable", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Audio is unavailable." }, { status: 503 }); } }
