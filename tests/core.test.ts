import { describe, expect, it } from "vitest";
import { getCurrentChallengeDate, stableIndex } from "../lib/challenge";
import { canConsumeAttempt, durationForAttempt, scoreForAttempt } from "../lib/game";
import { normalizeBalkanText } from "../lib/text";
import { getSnippetEnd, hasReachedSnippetEnd, withActualPlaybackStart } from "../lib/audio/snippet";
import { haveMatchingArtistCredit, parseArtistCredits } from "../lib/artist";
import { isValidCompletedResult, summarizeDailyResults } from "../lib/daily-stats";
import { dailySongFromCatalog } from "../lib/daily";
import { canAdvanceProof, canRevealProof, signGameProof, verifyGameProof, type GameProof } from "../lib/game-proof";
import { readJsonBody } from "../lib/http";
import { signPlayerId, verifyPlayerCookie } from "../lib/player";
import { validateCatalog } from "../lib/catalog";
import { missingCatalogCoverage } from "../lib/readiness";
describe("Balkan text normalization", () => { it("normalizes diacritics and punctuation", () => { expect(normalizeBalkanText(" Željko Joksimović ")).toBe("zeljko joksimovic"); expect(normalizeBalkanText("Đurđevdan")).toBe("djurdjevdan"); }); });
describe("artist credit matching", () => {
  it("parses the collaboration styles used by the song catalog", () => {
    expect(parseArtistCredits("Tanja Savić feat. Corona x Rimski")).toEqual(["tanja savic", "corona", "rimski"]);
    expect(parseArtistCredits("Jala Brat & Buba Corelli")).toEqual(["jala brat", "buba corelli"]);
    expect(parseArtistCredits("Coby i Rimski")).toEqual(["coby", "rimski"]);
  });
  it("matches any credited artist without using partial names", () => {
    expect(haveMatchingArtistCredit("Jala Brat x Buba Corelli", "Jala Brat")).toBe(true);
    expect(haveMatchingArtistCredit("Corona x Rimski", "Rimski x Corona")).toBe(true);
    expect(haveMatchingArtistCredit("Elena Kitić feat. Buba Corelli", "Buba Corelli")).toBe(true);
    expect(haveMatchingArtistCredit("Maya Berović", "Maya")).toBe(false);
  });
});
describe("daily challenge", () => { it("uses Zagreb date instead of browser offset", () => { expect(getCurrentChallengeDate(new Date("2026-08-28T22:30:00.000Z"))).toBe("2026-08-29"); }); it("chooses deterministic fallback", () => { expect(stableIndex("2026-08-29", 10)).toBe(stableIndex("2026-08-29", 10)); }); });
describe("daily catalog lookup", () => {
  it("uses an already loaded catalog without another backend read", () => {
    const song = { id: 7, title: "Song", artist: "Artist", categories: ["club-mix"], sourceUrl: null, clipKey: "clip.mp3", previewStart: 0, soundcloudTrackId: null, soundcloudUrl: null, active: true };
    expect(dailySongFromCatalog({ songs: [song], days: { "2026-08-29:club-mix": 7 } }, "2026-08-29", "club-mix")).toBe(song);
  });
});
describe("signed game proof", () => {
  const secret = "test-secret-that-is-longer-than-thirty-two-characters";
  const proof: GameProof = { v: 1, playerId: "35d31996-b273-4169-92ce-d286cafa2518", date: "2026-08-29", category: "club-mix", attempt: 3, completed: false, won: false };
  it("round-trips valid server state and rejects tampering", () => {
    const token = signGameProof(proof, secret);
    expect(verifyGameProof(token, secret)).toEqual(proof);
    expect(verifyGameProof(`${token.slice(0, -1)}x`, secret)).toBeNull();
  });
  it("only advances the exact signed attempt and reveals completed proofs", () => {
    expect(canAdvanceProof(proof, 3)).toBe(true);
    expect(canAdvanceProof(proof, 4)).toBe(false);
    expect(canRevealProof(proof, 3)).toBe(false);
    expect(canRevealProof({ ...proof, attempt: 6, completed: true }, 6)).toBe(true);
  });
});
describe("signed anonymous player cookie", () => {
  const secret = "test-secret-that-is-longer-than-thirty-two-characters";
  const playerId = "35d31996-b273-4169-92ce-d286cafa2518";
  it("accepts a server cookie and rejects a caller-invented identity", () => {
    expect(verifyPlayerCookie(signPlayerId(playerId, secret), secret)).toBe(playerId);
    expect(verifyPlayerCookie(playerId, secret)).toBeNull();
  });
});
describe("bounded JSON bodies", () => {
  it("parses JSON and rejects oversized declared bodies", async () => {
    await expect(readJsonBody<{ ok: boolean }>(new Request("https://example.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"ok":true}' }))).resolves.toEqual({ ok: true });
    await expect(readJsonBody(new Request("https://example.test", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "3000" }, body: "{}" }))).rejects.toEqual(expect.objectContaining({ status: 413 }));
  });
});
describe("game scoring and attempts", () => { it("progresses predictably", () => { expect(durationForAttempt(0)).toBe(1); expect(durationForAttempt(5)).toBe(16); expect(scoreForAttempt(0)).toBe(1000); expect(scoreForAttempt(5)).toBe(100); expect(canConsumeAttempt(5, false)).toBe(true); expect(canConsumeAttempt(6, false)).toBe(false); }); });
describe("daily player statistics", () => {
  it("summarizes wins by attempt and losses", () => {
    expect(summarizeDailyResults([
      { won: true, attempt: 1, count: 2 },
      { won: true, attempt: 4, count: 3 },
      { won: false, attempt: 6, count: 1 },
    ])).toEqual({ totalPlayers: 6, solvedPlayers: 5, attempts: [2, 0, 0, 3, 0, 0], losses: 1 });
  });
  it("accepts only completed round results", () => {
    expect(isValidCompletedResult(true, 1)).toBe(true);
    expect(isValidCompletedResult(false, 6)).toBe(true);
    expect(isValidCompletedResult(false, 5)).toBe(false);
    expect(isValidCompletedResult(true, 7)).toBe(false);
  });
});
describe("snippet boundaries", () => {
  it("stops at the configured media-time boundary", () => {
    expect(getSnippetEnd(30, 1)).toBe(31);
    expect(hasReachedSnippetEnd(30.999, 30, 1)).toBe(false);
    expect(hasReachedSnippetEnd(31, 30, 1)).toBe(true);
  });
  it("limits elapsed audio even when SoundCloud has not applied the requested seek", () => {
    const active = withActualPlaybackStart({ url: "stream", start: 30, duration: 1 }, 0);
    expect(getSnippetEnd(active.start, active.duration)).toBe(1);
    expect(hasReachedSnippetEnd(1, active.start, active.duration)).toBe(true);
  });
});
describe("catalog validation and readiness", () => {
  const song = { id: 1, title: "Song", artist: "Artist", categories: ["club-mix", "jala-buba", "exyu"], sourceUrl: null, clipKey: "clip.mp3", previewStart: 0, soundcloudTrackId: null, soundcloudUrl: null, active: true };
  it("rejects invalid clip keys and dangling assignments", () => {
    expect(() => validateCatalog({ songs: [{ ...song, clipKey: "../clip.mp3" }], days: {} })).toThrow();
    expect(() => validateCatalog({ songs: [song], days: { "2026-09-11:club-mix": 2 } })).toThrow();
  });
  it("reports missing category coverage", () => {
    const catalog = validateCatalog({ songs: [song], days: { "2026-09-11:club-mix": 1, "2026-09-11:jala-buba": 1, "2026-09-11:exyu": 1 } });
    expect(missingCatalogCoverage(catalog, "2026-09-11", 1)).toEqual([]);
    expect(missingCatalogCoverage(catalog, "2026-09-11", 2)).toHaveLength(3);
  });
});
