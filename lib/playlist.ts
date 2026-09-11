export function playlistUrl(value: string) {
  const url = new URL(value);
  if (!["www.youtube.com", "youtube.com", "music.youtube.com"].includes(url.hostname) || url.protocol !== "https:" || url.pathname !== "/playlist" || !/^[\w-]+$/.test(url.searchParams.get("list") || "")) throw new Error("Provide an HTTPS YouTube or YouTube Music playlist URL.");
  return `https://www.youtube.com/playlist?list=${url.searchParams.get("list")}`;
}
export function parseTrackTitle(value: string) {
  const cleaned = value.replace(/\s*[([](?:official[^)\]]*|music video|audio|video|lyrics|novo)[)\]]/gi, "").trim();
  const parts = cleaned.split(/\s+[-–—]\s+/);
  if (parts.length < 2) return null;
  return { artist: parts.shift()!.trim(), title: parts.join(" - ").trim() };
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
