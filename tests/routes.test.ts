import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as loadDaily } from "../app/api/daily/route";
import { POST as guess } from "../app/api/daily/guess/route";
import { POST as reveal } from "../app/api/daily/reveal/route";
import { POST as skip } from "../app/api/daily/skip/route";
import { parseRange } from "../app/api/daily/clip/route";
import { getCurrentChallengeDate } from "../lib/challenge";
import { signGameProof, verifyGameProof } from "../lib/game-proof";
import { PLAYER_COOKIE, signPlayerId } from "../lib/player";

const previousMode = process.env.PLAYLIST_DEV;
const playerId = "35d31996-b273-4169-92ce-d286cafa2518";
const category = "club-mix" as const;

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `${PLAYER_COOKIE}=${signPlayerId(playerId)}` },
    body: JSON.stringify(body),
  });
}

describe("daily route state enforcement", () => {
  beforeAll(() => { process.env.PLAYLIST_DEV = "1"; });
  afterAll(() => {
    if (previousMode === undefined) delete process.env.PLAYLIST_DEV;
    else process.env.PLAYLIST_DEV = previousMode;
  });

  it("returns 400 for an unknown category", async () => {
    const response = await loadDaily(new NextRequest("http://localhost/api/daily?category=unknown"));
    expect(response.status).toBe(400);
  });

  it("rejects jumping a guess from attempt zero to attempt five", async () => {
    const date = getCurrentChallengeDate();
    const proof = signGameProof({ v: 1, playerId, date, category, attempt: 0, completed: false, won: false });
    const response = await guess(post("/api/daily/guess", { date, category, guessedSongId: 1, attempt: 5, proof }));
    expect(response.status).toBe(409);
  });

  it("rejects immediate reveal and advances skips one at a time", async () => {
    const date = getCurrentChallengeDate();
    const proof = signGameProof({ v: 1, playerId, date, category, attempt: 0, completed: false, won: false });
    expect((await reveal(post("/api/daily/reveal", { date, category, attempt: 6, proof }))).status).toBe(409);
    const response = await skip(post("/api/daily/skip", { date, category, attempt: 0, proof }));
    expect(response.status).toBe(200);
    const payload = await response.json() as { proof?: string };
    const next = verifyGameProof(payload.proof);
    expect(next).toMatchObject({ attempt: 1, completed: false, won: false });
  });
});

describe("media byte ranges", () => {
  it("accepts bounded ranges and rejects malformed or unsatisfiable ranges", () => {
    expect(parseRange("bytes=0-0", 100)).toEqual({ start: 0, end: 0 });
    expect(parseRange("bytes=10-", 100)).toEqual({ start: 10, end: 99 });
    expect(parseRange("bytes=100-", 100)).toBeUndefined();
    expect(parseRange("items=0-1", 100)).toBeUndefined();
  });
});
