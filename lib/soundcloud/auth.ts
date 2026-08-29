import type { TokenResponse } from "./types";
let cached: { accessToken: string; refreshToken?: string; expiresAt: number } | undefined;
const endpoint = "https://secure.soundcloud.com/oauth/token";
function credentials() { const id = process.env.SOUNDCLOUD_CLIENT_ID, secret = process.env.SOUNDCLOUD_CLIENT_SECRET; if (!id || !secret) throw new Error("SoundCloud credentials not configured."); return { id, secret }; }
async function exchange(body: URLSearchParams, basic = false): Promise<TokenResponse> {
  const { id, secret } = credentials();
  const headers: Record<string, string> = { Accept: "application/json; charset=utf-8", "Content-Type": "application/x-www-form-urlencoded" };
  if (basic) headers.Authorization = `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`; else { body.set("client_id", id); body.set("client_secret", secret); }
  const response = await fetch(endpoint, { method: "POST", headers, body, cache: "no-store" });
  if (!response.ok) throw new Error(`SoundCloud authentication failed (${response.status}).`);
  return response.json();
}
export async function getSoundCloudToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;
  const token = cached?.refreshToken ? await exchange(new URLSearchParams({ grant_type: "refresh_token", refresh_token: cached.refreshToken })) : await exchange(new URLSearchParams({ grant_type: "client_credentials" }), true);
  cached = { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000 };
  return cached.accessToken;
}
