import { describe, expect, it } from "vitest";
import { categoryFrom } from "../lib/categories";
import { playlistUrl, parseTrackTitle, dateOffset, automaticStartFromSegments, automaticStartFromSilenceLog } from "../lib/playlist";
describe("playlist import", () => {
  it("preserves collaborations and cleans video labels", () => {
    expect(parseTrackTitle("Jala Brat & Buba Corelli & Baby it's Pablo - Padam (Official Music Video)")).toEqual({ artist: "Jala Brat & Buba Corelli & Baby it's Pablo", title: "Padam" });
    expect(parseTrackTitle("[Deleted video]")).toBeNull();
  });
  it("only accepts YouTube playlist URLs", () => {
    expect(playlistUrl("https://www.youtube.com/playlist?list=PLVQZG1Rymm4U&extra=1")).toBe("https://www.youtube.com/playlist?list=PLVQZG1Rymm4U");
    expect(() => playlistUrl("https://evil.example/playlist?list=abc")).toThrow();
    expect(() => playlistUrl("file:///etc/passwd")).toThrow();
  });
  it("validates category boundaries", () => {
    expect(categoryFrom("club-mix")).toBe("club-mix");
    expect(categoryFrom(undefined)).toBe("club-mix");
    expect(() => categoryFrom("../clips")).toThrow();
  });
  it("advances calendar dates across DST and year boundaries", () => {
    expect(dateOffset("2026-10-25", 1)).toBe("2026-10-26");
    expect(dateOffset("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("moves past contiguous marked intro segments", () => {
    expect(automaticStartFromSegments([
      { category: "intro", segment: [0, 7.1] },
      { category: "selfpromo", segment: [7.2, 12] },
      { category: "outro", segment: [180, 190] },
    ])).toBe(12.25);
    expect(automaticStartFromSegments([{ category: "intro", segment: [15, 20] }])).toBe(0);
  });
  it("uses a short early silence as the IDJ music boundary", () => {
    const log = "silence_start: 7.1\nsilence_end: 8.05 | silence_duration: 0.95\nsilence_start: 35";
    expect(automaticStartFromSilenceLog(log)).toBe(8.25);
  });
});
