import { withPrisma } from "@/lib/prisma-client";
import { getCurrentChallengeDate } from "./challenge";
import { localMode } from "./runtime";
import type { Category } from "./categories";
export async function getDailySong(date = getCurrentChallengeDate(), category: Category = "club-mix") {
  if (localMode()) {
    const { readCatalog } = await import("./catalog");
    const catalog = await readCatalog();
    const id = catalog.days[`${date}:${category}`];
    return catalog.songs.find(song => song.id === id && song.active && song.categories.includes(category) && song.clipKey) ?? null;
  }
  return withPrisma(async prisma => {
    const daily = await prisma.dailySong.findUnique({ where: { date_category: { date, category } }, include: { song: true } });
    return daily?.song.active && daily.song.categories.includes(category) ? daily.song : null;
  });
}
