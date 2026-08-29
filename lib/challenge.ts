export function getCurrentChallengeDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function stableIndex(date: string, size: number) { let hash = 2166136261; for (const c of date) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619); return size ? (hash >>> 0) % size : -1; }
export function challengeNumber(date: string) { return Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse("2026-01-01T00:00:00Z")) / 86400000) + 1; }
