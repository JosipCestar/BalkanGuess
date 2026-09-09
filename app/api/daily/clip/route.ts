import { NextRequest } from "next/server";
import { categoryFrom } from "@/lib/categories";
import { getDailySong } from "@/lib/daily";
import { getCurrentChallengeDate } from "@/lib/challenge";
import { localMode } from "@/lib/runtime";

const VALID_CLIP_KEY = /^[a-zA-Z0-9_-]+\.mp3$/;

function parseRange(value: string | null, size: number) {
  if (!value) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(value);
  const start = match ? Number(match[1]) : -1;
  const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start >= 0 && start < size && end >= start ? { start, end } : undefined;
}

function audioHeaders(length: number) {
  return new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
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
  const head = await env.AUDIO_BUCKET.head(key);
  if (!head) return new Response(null, { status: 404 });
  const range = parseRange(rangeHeader, head.size);
  if (range === undefined) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${head.size}` } });
  const object = await env.AUDIO_BUCKET.get(
    key,
    range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined,
  );
  if (!object) return new Response(null, { status: 404 });
  const headers = audioHeaders(range ? range.end - range.start + 1 : object.size);
  if (range) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${head.size}`);
  return new Response(object.body, { status: range ? 206 : 200, headers });
}

export async function GET(request: NextRequest) {
  try {
    const date = getCurrentChallengeDate();
    if (request.nextUrl.searchParams.get("date") !== date) return new Response(null, { status: 409 });
    const song = await getDailySong(date, categoryFrom(request.nextUrl.searchParams.get("category")));
    if (!song?.clipKey || !VALID_CLIP_KEY.test(song.clipKey)) return new Response(null, { status: 404 });
    return localMode()
      ? localClip(song.clipKey, request.headers.get("range"))
      : workerClip(song.clipKey, request.headers.get("range"));
  } catch { return new Response(null, { status: 503 }); }
}
