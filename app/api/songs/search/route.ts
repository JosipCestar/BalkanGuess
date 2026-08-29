import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeBalkanText } from "@/lib/text";
export async function GET(request: NextRequest) { const q = normalizeBalkanText(request.nextUrl.searchParams.get("q") || ""); if (!q) return NextResponse.json([]); const terms = q.split(" "); const songs = await prisma.song.findMany({ where: { active: true, AND: terms.map(term => ({ OR: [{ normalizedTitle: { contains: term } }, { normalizedArtist: { contains: term } }] })) }, select: { id: true, title: true, artist: true }, take: 8 }); return NextResponse.json(songs); }
