import type { Category } from "./categories";
import { localMode } from "./runtime";

export async function categorySongs(category: Category) {
  const catalog = localMode()
    ? await (await import("./catalog")).readCatalog()
    : await (await import("./worker-catalog")).readWorkerCatalog();
  return catalog.songs.filter(song => song.active && song.categories.includes(category));
}
