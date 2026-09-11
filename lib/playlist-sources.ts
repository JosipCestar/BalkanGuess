import type { Category } from "./categories";

export const PLAYLIST_SOURCES = [
  { category: "club-mix", url: "https://www.youtube.com/playlist?list=PLJ14wpRv6ztY" },
  { category: "jala-buba", url: "https://www.youtube.com/playlist?list=PLVQZG1Rymm4U" },
  { category: "exyu", url: "https://www.youtube.com/playlist?list=PLEENVhYLmeNM" },
  { category: "trap", url: "https://www.youtube.com/watch?v=2kvZgvR6ctk&list=PLX9fzSi3XuA4" },
] as const satisfies ReadonlyArray<{ category: Category; url: string }>;
