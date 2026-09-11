import type { Catalog } from "./catalog";
import { CATEGORIES } from "./categories";
import { dailySongFromCatalog } from "./daily";

export const REQUIRED_COVERAGE_DAYS = 3;

function dateOffset(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function missingCatalogCoverage(catalog: Catalog, startDate: string, days = REQUIRED_COVERAGE_DAYS) {
  const missing: string[] = [];
  const enabledCategories = CATEGORIES.filter(category => category.required
    || catalog.songs.some(song => song.active && song.categories.includes(category.id)));
  for (let offset = 0; offset < days; offset++) {
    const date = dateOffset(startDate, offset);
    for (const category of enabledCategories) if (!dailySongFromCatalog(catalog, date, category.id)) missing.push(`${date}:${category.id}`);
  }
  return missing;
}
