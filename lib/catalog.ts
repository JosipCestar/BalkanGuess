import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { putR2Object, readR2Text, remoteCatalogEnabled } from "./r2";
import { CATEGORIES } from "./categories";
export type CatalogSong = {
  id: number; title: string; artist: string; categories: string[];
  sourceUrl: string | null; clipKey: string | null; previewStart: number;
  soundcloudTrackId: string | null; soundcloudUrl: string | null; active: boolean;
};
export type Catalog = { songs: CatalogSong[]; days: Record<string, number> };
const CLIP_KEY = /^[a-zA-Z0-9_-]+\.mp3$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const CATALOG_CATEGORIES = new Set(["legacy", ...CATEGORIES.map(category => category.id)]);

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function validateCatalog(value: unknown): Catalog {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Catalog must be an object.");
  const candidate = value as { songs?: unknown; days?: unknown };
  if (!Array.isArray(candidate.songs) || !candidate.days || typeof candidate.days !== "object" || Array.isArray(candidate.days)) {
    throw new Error("Catalog songs or assignments are invalid.");
  }

  const ids = new Set<number>();
  const songs = candidate.songs.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Catalog song ${index} is invalid.`);
    const song = raw as Partial<CatalogSong>;
    if (!Number.isInteger(song.id) || Number(song.id) < 1 || ids.has(Number(song.id))
      || typeof song.title !== "string" || !song.title.trim()
      || typeof song.artist !== "string" || !song.artist.trim()
      || !Array.isArray(song.categories) || !song.categories.every(category => typeof category === "string" && CATALOG_CATEGORIES.has(category))
      || !nullableString(song.sourceUrl) || !nullableString(song.soundcloudTrackId) || !nullableString(song.soundcloudUrl)
      || !nullableString(song.clipKey) || (song.clipKey !== null && !CLIP_KEY.test(song.clipKey))
      || typeof song.previewStart !== "number" || !Number.isFinite(song.previewStart) || song.previewStart < 0 || song.previewStart > 3600
      || typeof song.active !== "boolean") throw new Error(`Catalog song ${index} has invalid fields.`);
    ids.add(Number(song.id));
    return song as CatalogSong;
  });

  const days: Record<string, number> = {};
  for (const [key, rawId] of Object.entries(candidate.days as Record<string, unknown>)) {
    const [date, category, extra] = key.split(":");
    if (extra !== undefined || !DATE_KEY.test(date) || !CATALOG_CATEGORIES.has(category)
      || !Number.isInteger(rawId) || !ids.has(Number(rawId))) throw new Error(`Catalog assignment ${key} is invalid.`);
    days[key] = Number(rawId);
  }
  return { songs, days };
}

export function parseCatalogJson(serialized: string) {
  return validateCatalog(JSON.parse(serialized));
}
export const dataDir = () => path.resolve(/* turbopackIgnore: true */ process.env.AUDIO_DATA_DIR || "data");
export async function readCatalog(): Promise<Catalog> {
  if (remoteCatalogEnabled()) {
    const stored = await readR2Text("state/catalog.json");
    return stored ? parseCatalogJson(stored) : { songs: [], days: {} };
  }
  try { return parseCatalogJson(await readFile(path.join(dataDir(), "catalog.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { songs: [], days: {} }; throw error; }
}
export async function writeCatalog(catalog: Catalog) {
  validateCatalog(catalog);
  const serialized = JSON.stringify(catalog, null, 2);
  await mkdir(dataDir(), { recursive: true });
  const temp = path.join(dataDir(), `catalog-${randomUUID()}.tmp`);
  await writeFile(temp, serialized);
  await rename(temp, path.join(dataDir(), "catalog.json"));
  if (remoteCatalogEnabled()) await putR2Object("state/catalog.json", serialized, "application/json");
}
