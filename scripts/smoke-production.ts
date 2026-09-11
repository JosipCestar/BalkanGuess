export {};
import { CATEGORIES } from "../lib/categories";

const rawBaseUrl = process.argv[2] || process.env.PRODUCTION_URL;
if (!rawBaseUrl) throw new Error("Usage: npm run smoke:production -- https://your-worker.example");
const baseUrl = new URL(rawBaseUrl);
if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "127.0.0.1" && baseUrl.hostname !== "localhost") throw new Error("Production smoke tests require HTTPS.");

async function get(path: string, headers?: HeadersInit) {
  const response = await fetch(new URL(path, baseUrl), { headers, redirect: "error", signal: AbortSignal.timeout(10_000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${body.slice(0, 300)}`);
  return { response, body };
}

async function requireByteRange(path: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const clip = await get(path, { Range: "bytes=0-0" });
    if (clip.response.status === 206 && clip.response.headers.get("content-range")?.startsWith("bytes 0-0/")) return;
  }
  throw new Error(`${path} does not honor byte ranges after a bounded retry.`);
}

const health = await get("/api/health");
if (JSON.parse(health.body).status !== "ok") throw new Error("Liveness check returned an unexpected response.");
const readiness = await get("/api/readiness");
if (JSON.parse(readiness.body).status !== "ok") throw new Error("Readiness check returned an unexpected response.");

const skipped: string[] = [];
let checked = 0;
for (const category of CATEGORIES) {
  const daily = await get(`/api/daily?category=${category.id}`);
  const challenge = JSON.parse(daily.body) as { ready?: boolean; date?: string; audioUrl?: string };
  if (!challenge.ready && !category.required) { skipped.push(category.id); continue; }
  if (!challenge.ready || !challenge.date || !challenge.audioUrl) throw new Error(`${category.id} is not ready.`);
  checked += 1;
  await get(`/api/daily/stats?category=${category.id}&date=${challenge.date}`);
  await requireByteRange(challenge.audioUrl);
}

if (!checked) throw new Error("No prepared categories were available.");
console.log(`Production smoke checks passed for ${baseUrl.origin}.${skipped.length ? ` Awaiting content: ${skipped.join(", ")}.` : ""}`);
