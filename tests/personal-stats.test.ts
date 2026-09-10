import { describe, expect, it } from "vitest";
import { nextZagrebMidnight, parsePersonalResult, summarizePersonalResults } from "../lib/personal-stats";

describe("personal statistics", () => {
  it("counts each date once and excludes future rounds", () => {
    const result = { date: "2026-09-09", won: true, attempt: 2 };
    expect(summarizePersonalResults([result, result, { ...result, date: "2026-09-11" }], "2026-09-10"))
      .toEqual({ played: 1, winRate: 100, currentStreak: 1, bestStreak: 1, attempts: [0, 1, 0, 0, 0, 0] });
  });
  it("retains yesterday's streak, breaks on a loss or missed day, and preserves the best", () => {
    const wins = ["2026-09-07", "2026-09-08"].map(date => ({ date, won: true, attempt: 6 }));
    expect(summarizePersonalResults(wins, "2026-09-09").currentStreak).toBe(2);
    expect(summarizePersonalResults(wins, "2026-09-10").currentStreak).toBe(0);
    expect(summarizePersonalResults([...wins, { date: "2026-09-09", won: false, attempt: 6 }], "2026-09-09"))
      .toMatchObject({ played: 3, winRate: 67, currentStreak: 0, bestStreak: 2, attempts: [0, 0, 0, 0, 0, 2] });
    expect(summarizePersonalResults([...wins, { date: "2026-09-10", won: true, attempt: 1 }], "2026-09-10").currentStreak).toBe(1);
  });
  it("handles empty history and rejects corrupt or incomplete stored results", () => {
    expect(summarizePersonalResults([], "2026-09-10")).toMatchObject({ played: 0, winRate: 0, currentStreak: 0, bestStreak: 0 });
    for (const raw of [null, "{", "null", '{"date":"2026-02-30","won":true,"attempt":1}', '{"date":"2026-09-10","won":false,"attempt":3}']) expect(parsePersonalResult(raw)).toBeNull();
    expect(parsePersonalResult('{"date":"2026-09-10","won":true,"attempt":1}')).toEqual({ date: "2026-09-10", won: true, attempt: 1 });
  });
});

describe("next Zagreb midnight", () => {
  it.each([
    ["2026-09-09T22:00:00Z", "2026-09-10T22:00:00Z"],
    ["2026-03-28T23:00:00Z", "2026-03-29T22:00:00Z"],
    ["2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z"],
    ["2026-12-31T22:59:59Z", "2026-12-31T23:00:00Z"],
  ])("calculates %s across timezone and daylight-saving boundaries", (now, expected) => {
    expect(new Date(nextZagrebMidnight(new Date(now))).toISOString()).toBe(new Date(expected).toISOString());
  });
});
