export function playlistUrl(value: string) {
  const url = new URL(value);
  const list = url.searchParams.get("list") || "";
  const video = url.searchParams.get("v") || "";
  const supportedHost = ["www.youtube.com", "youtube.com", "music.youtube.com"].includes(url.hostname);
  const supportedPath = url.pathname === "/playlist" || url.pathname === "/watch";
  if (!supportedHost || url.protocol !== "https:" || !supportedPath || !/^[\w-]+$/.test(list)) throw new Error("Provide an HTTPS YouTube or YouTube Music playlist URL.");
  if (url.pathname === "/watch") {
    if (!/^[\w-]{11}$/.test(video)) throw new Error("A YouTube watch playlist URL must include a valid video ID.");
    return `https://www.youtube.com/watch?v=${video}&list=${list}`;
  }
  return `https://www.youtube.com/playlist?list=${list}`;
}
function cleanTrackText(value: string) {
  return value.replace(/\s*[([](?:official[^)\]]*|music video|audio|video|lyrics|novo)[)\]]/gi, "").trim();
}
export function parseTrackTitle(value: string) {
  const cleaned = cleanTrackText(value);
  const parts = cleaned.split(/\s+[-–—]\s+/);
  if (parts.length < 2) return null;
  return { artist: parts.shift()!.trim(), title: parts.join(" - ").trim() };
}
type PlaylistEntry = {
  artist?: unknown;
  channel?: unknown;
  title?: unknown;
  track?: unknown;
  uploader?: unknown;
};
export function parsePlaylistEntry(entry: PlaylistEntry) {
  const rawTitle = typeof entry.track === "string" && entry.track.trim()
    ? entry.track
    : typeof entry.title === "string" ? entry.title : "";
  const combined = parseTrackTitle(rawTitle);
  if (combined) return combined;
  const title = cleanTrackText(rawTitle);
  if (!title || /^\[(?:deleted|private) video\]$/i.test(title)) return null;
  const artist = [entry.artist, entry.uploader, entry.channel]
    .find(value => typeof value === "string" && value.trim());
  if (typeof artist !== "string") return null;
  const cleanedArtist = artist
    .replace(/\s+-\s+Topic$/i, "")
    .replace(/VEVO$/i, "")
    .trim();
  if (!cleanedArtist || /^(?:YouTube|Various Artists)$/i.test(cleanedArtist)) return null;
  return { artist: cleanedArtist, title };
}
export function dateOffset(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

type SkipSegment = { category?: string; segment?: number[] };
const INTRO_CATEGORIES = new Set(["intro", "selfpromo", "music_offtopic"]);

export function automaticStartFromSegments(segments: SkipSegment[]) {
  const candidates = segments
    .filter(item => item.category && INTRO_CATEGORIES.has(item.category) && item.segment?.length === 2)
    .map(item => item.segment as number[])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= 90)
    .sort((a, b) => a[0] - b[0]);
  let end = 0;
  for (const [segmentStart, segmentEnd] of candidates) {
    if (segmentStart > end + 1.5) break;
    end = Math.max(end, segmentEnd);
  }
  return end > 0 ? Math.round((end + 0.25) * 100) / 100 : 0;
}

export function automaticStartFromSilenceLog(log: string) {
  const events = [...log.matchAll(/silence_(start|end):\s*([0-9.]+)/g)];
  let start: number | null = null;
  let best = 0;
  for (const event of events) {
    const value = Number(event[2]);
    if (event[1] === "start") start = value;
    else if (start !== null && start <= 20 && value <= 30 && value - start >= 0.4) {
      best = Math.max(best, value + 0.2);
      start = null;
    }
  }
  return Math.round(best * 100) / 100;
}
