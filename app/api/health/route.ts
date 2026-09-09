import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } });
}
