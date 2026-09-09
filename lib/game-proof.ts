import { createHmac, timingSafeEqual } from "node:crypto";
import type { Category } from "./categories";
import { CATEGORIES } from "./categories";
import { localMode } from "./runtime";

export type GameProof = {
  v: 1;
  playerId: string;
  date: string;
  category: Category;
  attempt: number;
  completed: boolean;
  won: boolean;
};

const DEV_SECRET = "balkanguess-local-development-proof-key";
const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function gameProofSecret() {
  if (localMode()) return DEV_SECRET;
  const value = process.env.GAME_TOKEN_SECRET;
  if (!value || value.length < 32) throw new Error("GAME_TOKEN_SECRET must contain at least 32 characters.");
  return value;
}

function validProof(value: unknown): value is GameProof {
  if (!value || typeof value !== "object") return false;
  const proof = value as Partial<GameProof>;
  return proof.v === 1
    && typeof proof.playerId === "string"
    && PLAYER_ID.test(proof.playerId)
    && typeof proof.date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(proof.date)
    && CATEGORIES.some(category => category.id === proof.category)
    && Number.isInteger(proof.attempt)
    && Number(proof.attempt) >= 0
    && Number(proof.attempt) <= 6
    && typeof proof.completed === "boolean"
    && typeof proof.won === "boolean"
    && (!proof.won || (proof.completed && Number(proof.attempt) >= 1))
    && (!proof.completed || proof.won || proof.attempt === 6);
}

export function signGameProof(proof: GameProof, secret = gameProofSecret()) {
  const payload = Buffer.from(JSON.stringify(proof)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyGameProof(token: unknown, secret = gameProofSecret()): GameProof | null {
  if (typeof token !== "string" || token.length > 1_024) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return validProof(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function proofMatches(proof: GameProof | null, expected: { playerId: string; date: string; category: Category }): proof is GameProof {
  return !!proof
    && proof.playerId === expected.playerId
    && proof.date === expected.date
    && proof.category === expected.category;
}
