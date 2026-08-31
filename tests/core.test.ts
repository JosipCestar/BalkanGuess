import { describe, expect, it } from "vitest";
import { getCurrentChallengeDate, stableIndex } from "../lib/challenge";
import { canConsumeAttempt, durationForAttempt, scoreForAttempt } from "../lib/game";
import { normalizeBalkanText } from "../lib/text";
import { getSnippetEnd, hasReachedSnippetEnd, withActualPlaybackStart } from "../lib/audio/snippet";
import { haveMatchingArtistCredit, parseArtistCredits } from "../lib/artist";
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
describe("game scoring and attempts", () => { it("progresses predictably", () => { expect(durationForAttempt(0)).toBe(1); expect(durationForAttempt(5)).toBe(16); expect(scoreForAttempt(0)).toBe(1000); expect(scoreForAttempt(5)).toBe(100); expect(canConsumeAttempt(5, false)).toBe(true); expect(canConsumeAttempt(6, false)).toBe(false); }); });
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
