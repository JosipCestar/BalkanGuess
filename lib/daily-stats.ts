export type DailyStats = {
  totalPlayers: number;
  solvedPlayers: number;
  attempts: number[];
  losses: number;
};

export function summarizeDailyResults(groups: Array<{ won: boolean; attempt: number; count: number }>): DailyStats {
  const attempts = Array.from({ length: 6 }, () => 0);
  let losses = 0;

  for (const group of groups) {
    if (group.won && group.attempt >= 1 && group.attempt <= 6) attempts[group.attempt - 1] += group.count;
    else if (!group.won) losses += group.count;
  }

  const solvedPlayers = attempts.reduce((sum, count) => sum + count, 0);
  return { totalPlayers: solvedPlayers + losses, solvedPlayers, attempts, losses };
}

export function isValidCompletedResult(won: unknown, attempt: unknown) {
  return typeof won === "boolean"
    && Number.isInteger(attempt)
    && Number(attempt) >= 1
    && Number(attempt) <= 6
    && (won || attempt === 6);
}
