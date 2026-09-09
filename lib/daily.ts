import { getCurrentChallengeDate } from "./challenge";
import { localMode } from "./runtime";
import type { Category } from "./categories";
import type { Catalog } from "./catalog";

export async function readRuntimeCatalog(): Promise<Catalog> {
  return localMode()
    ? await (await import("./catalog")).readCatalog()
    : await (await import("./worker-catalog")).readWorkerCatalog();
}

export function dailySongFromCatalog(catalog: Catalog, date: string, category: Category) {
  const id = catalog.days[`${date}:${category}`];
  return catalog.songs.find(song => song.id === id && song.active && song.categories.includes(category) && song.clipKey) ?? null;
}

export async function getDailySong(date = getCurrentChallengeDate(), category: Category = "club-mix") {
  return dailySongFromCatalog(await readRuntimeCatalog(), date, category);
}
