export const DURATIONS = [1, 2, 4, 7, 11, 16] as const;
export const SCORES = [1000, 800, 600, 400, 250, 100] as const;
export function durationForAttempt(attempt: number) { return DURATIONS[Math.min(Math.max(attempt, 0), 5)]; }
export function scoreForAttempt(attempt: number) { return SCORES[Math.min(Math.max(attempt, 0), 5)]; }
export function canConsumeAttempt(attempt: number, completed: boolean) { return !completed && attempt < 6; }
