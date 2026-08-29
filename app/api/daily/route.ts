import { NextResponse } from "next/server";
import { challengeNumber, getCurrentChallengeDate } from "@/lib/challenge";
export async function GET() { const date = getCurrentChallengeDate(); return NextResponse.json({ challengeNumber: challengeNumber(date), date, attempts: 6 }); }
