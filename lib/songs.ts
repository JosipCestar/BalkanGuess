import type { Category } from "./categories";
import { withPrisma } from "./prisma-client";
import { localMode } from "./runtime";

export async function categorySongs(category: Category) {
  if (localMode()) {
    const { readCatalog } = await import("./catalog");
    return (await readCatalog()).songs.filter(song => song.active && song.categories.includes(category));
  }

  return withPrisma(prisma => prisma.song.findMany({
    where: { active: true, categories: { has: category } },
    orderBy: { id: "asc" },
  }));
}
