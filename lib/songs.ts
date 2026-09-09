import type { Category } from "./categories";
import { readRuntimeCatalog } from "./daily";

export async function categorySongs(category: Category) {
  const catalog = await readRuntimeCatalog();
  return catalog.songs.filter(song => song.active && song.categories.includes(category));
}
