import { NextRequest } from "next/server";
import { categoryOrNull } from "@/lib/categories";
import { getDailySong } from "@/lib/daily";
import { getCurrentChallengeDate } from "@/lib/challenge";
import { localMode } from "@/lib/runtime";
import { enforceActorAndIpRateLimits } from "@/lib/rate-limit";

const VALID_CLIP_KEY = /^[a-zA-Z0-9_-]+\.mp3$/;

export function parseRange(value: string | null, size: number) {
  if (!value) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(value);
  const start = match ? Number(match[1]) : -1;
  const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start >= 0 && start < size && end >= start ? { start, end } : undefined;
}

function audioHeaders(length: number, cacheControl = "private, no-store") {
  return new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
    "CDN-Cache-Control": "no-store",
    "Content-Length": String(length),
    "Content-Type": "audio/mpeg",
  });
}

async function localClip(clipKey: string, rangeHeader: string | null) {
  const [{ readFile }, path, { dataDir }] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
    import("@/lib/catalog"),
  ]);
  const audio = await readFile(path.join(dataDir(), "clips", clipKey));
  const range = parseRange(rangeHeader, audio.length);
  if (range === undefined) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${audio.length}` } });
  if (range) {
    const body = new Uint8Array(audio.subarray(range.start, range.end + 1));
    const headers = audioHeaders(body.length);
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${audio.length}`);
    return new Response(body, { status: 206, headers });
  }
  return new Response(new Uint8Array(audio), { headers: audioHeaders(audio.length) });
}

async function workerClip(clipKey: string, rangeHeader: string | null) {
  const { env } = await import("cloudflare:workers");
  const key = `clips/${clipKey}`;
  if (rangeHeader) {
    const object = await env.AUDIO_BUCKET.get(key, { range: new Headers({ Range: rangeHeader }) });
    if (!object) return new Response(null, { status: 404 });
    const range = parseRange(rangeHeader, object.size);
    if (!range) return new Response(null, { status: 416, headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes */${object.size}` } });
    const headers = audioHeaders(range.end - range.start + 1, "private, max-age=86400, immutable");
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${object.size}`);
    headers.set("ETag", object.httpEtag);
    headers.set("Last-Modified", object.uploaded.toUTCString());
    return new Response(object.body, { status: 206, headers });
  }
  const object = await env.AUDIO_BUCKET.get(key);
  if (!object) return new Response(null, { status: 404 });
  const headers = audioHeaders(object.size, "private, max-age=86400, immutable");
  headers.set("ETag", object.httpEtag);
  headers.set("Last-Modified", object.uploaded.toUTCString());
  return new Response(object.body, { headers });
}

export async function GET(request: NextRequest) {
  try {
    const limited = await enforceActorAndIpRateLimits(request, "MEDIA_RATE_LIMITER");
    if (limited) return limited;
    const date = getCurrentChallengeDate();
    if (request.nextUrl.searchParams.get("date") !== date) return new Response(null, { status: 409 });
    const category = categoryOrNull(request.nextUrl.searchParams.get("category"));
    if (!category) return new Response(null, { status: 400 });
    const song = await getDailySong(date, category);
    if (!song?.clipKey || !VALID_CLIP_KEY.test(song.clipKey)) return new Response(null, { status: 404 });
    return localMode()
      ? localClip(song.clipKey, request.headers.get("range"))
      : workerClip(song.clipKey, request.headers.get("range"));
  } catch (error) {
    console.error("Could not load daily clip:", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return new Response(null, { status: 503 });
  }
}
