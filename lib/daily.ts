import { getCurrentChallengeDate } from "./challenge";
import { localMode } from "./runtime";
import type { Category } from "./categories";
export async function getDailySong(date = getCurrentChallengeDate(), category: Category = "club-mix") {
  const catalog = localMode()
    ? await (await import("./catalog")).readCatalog()
    : await (await import("./worker-catalog")).readWorkerCatalog();
  const id = catalog.days[`${date}:${category}`];
  return catalog.songs.find(song => song.id === id && song.active && song.categories.includes(category) && song.clipKey) ?? null;
}
