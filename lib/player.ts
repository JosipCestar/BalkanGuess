import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { gameProofSecret } from "./game-proof";

export const PLAYER_COOKIE = "balkanguess-player";
export const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function signPlayerId(playerId: string, secret = gameProofSecret()) {
  if (!PLAYER_ID.test(playerId)) throw new Error("Invalid player ID.");
  return `${playerId}.${createHmac("sha256", secret).update(playerId).digest("base64url")}`;
}

export function verifyPlayerCookie(value: unknown, secret = gameProofSecret()) {
  if (typeof value !== "string" || value.length > 128) return null;
  const [playerId, signature, extra] = value.split(".");
  if (!playerId || !signature || extra || !PLAYER_ID.test(playerId)) return null;
  const expected = createHmac("sha256", secret).update(playerId).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? playerId : null;
}

export function requestPlayerId(request: NextRequest) {
  return verifyPlayerCookie(request.cookies.get(PLAYER_COOKIE)?.value);
}

export function getOrCreatePlayer(request: NextRequest) {
  const existing = requestPlayerId(request);
  return existing ? { playerId: existing, isNew: false } : { playerId: randomUUID(), isNew: true };
}

export function setPlayerCookie(response: NextResponse, playerId: string, secure: boolean) {
  response.cookies.set(PLAYER_COOKIE, signPlayerId(playerId), {
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
    sameSite: "strict",
    secure,
  });
}
