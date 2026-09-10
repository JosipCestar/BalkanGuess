import { getCurrentChallengeDate } from "./challenge";
import { isValidCompletedResult } from "./daily-stats";

export type PersonalResult = { date: string; won: boolean; attempt: number };
export function parsePersonalResult(raw: string | null): PersonalResult | null {
  try {
    const value = JSON.parse(raw || "null");
    if (!value || typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)
      || !Number.isFinite(Date.parse(value.date)) || new Date(value.date).toISOString().slice(0, 10) !== value.date
      || !isValidCompletedResult(value.won, value.attempt)) return null;
    return { date: value.date, won: value.won, attempt: value.attempt };
  } catch { return null; }
}

export function summarizePersonalResults(results: PersonalResult[], today: string) {
  const unique = new Map<string, PersonalResult>();
  for (const result of results) if (result.date <= today && !unique.has(result.date)) unique.set(result.date, result);
  const days = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
  const attempts = Array<number>(6).fill(0);
  let streak = 0, bestStreak = 0, previous = 0;
  for (const day of days) {
    const timestamp = Date.parse(day.date);
    streak = day.won ? (timestamp - previous === 86400000 ? streak + 1 : 1) : 0;
    bestStreak = Math.max(bestStreak, streak);
    previous = timestamp;
    if (day.won) attempts[day.attempt - 1]++;
  }
  const wins = attempts.reduce((sum, count) => sum + count, 0);
  return { played: days.length, winRate: days.length ? Math.round(wins / days.length * 100) : 0,
    currentStreak: Date.parse(today) - previous <= 86400000 ? streak : 0, bestStreak, attempts };
}

// Find the next local date boundary, including Zagreb's 23- and 25-hour days.
export function nextZagrebMidnight(now: Date): number {
  const today = getCurrentChallengeDate(now);
  let low = now.getTime(), high = low + 26 * 3600000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (getCurrentChallengeDate(new Date(middle)) === today) low = middle;
    else high = middle;
  }
  return high;
}
