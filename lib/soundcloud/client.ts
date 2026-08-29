import { getSoundCloudToken } from "./auth";
export class SoundCloudClient {
  async get<T>(path: string) { const token = await getSoundCloudToken(); const response = await fetch(`https://api.soundcloud.com${path}`, { headers: { Accept: "application/json; charset=utf-8", Authorization: `OAuth ${token}` }, cache: "no-store" }); if (!response.ok) { if (response.status === 429) throw new Error("SoundCloud is rate limiting requests. Try again shortly."); throw new Error(`SoundCloud request failed (${response.status}).`); } return response.json() as Promise<T>; }
  async getStreamUrl(path: string) {
    const token = await getSoundCloudToken();
    const response = await fetch(`https://api.soundcloud.com${path}`, { headers: { Accept: "application/json; charset=utf-8", Authorization: `OAuth ${token}` }, redirect: "manual", cache: "no-store" });
    if (!response.ok && response.status !== 301 && response.status !== 302 && response.status !== 307 && response.status !== 308) {
      if (response.status === 429) throw new Error("SoundCloud is rate limiting requests. Try again shortly.");
      throw new Error(`SoundCloud stream request failed (${response.status}).`);
    }
    const url = response.headers.get("location");
    if (!url) throw new Error("SoundCloud did not return a stream URL.");
    return url;
  }
}
