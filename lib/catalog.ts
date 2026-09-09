import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { putR2Object, readR2Text, remoteCatalogEnabled } from "./r2";
export type CatalogSong = {
  id: number; title: string; artist: string; categories: string[];
  sourceUrl: string | null; clipKey: string | null; previewStart: number;
  soundcloudTrackId: string | null; soundcloudUrl: string | null; active: boolean;
};
export type Catalog = { songs: CatalogSong[]; days: Record<string, number> };
export const dataDir = () => path.resolve(/* turbopackIgnore: true */ process.env.AUDIO_DATA_DIR || "data");
export async function readCatalog(): Promise<Catalog> {
  if (remoteCatalogEnabled()) {
    const stored = await readR2Text("state/catalog.json");
    return stored ? JSON.parse(stored) : { songs: [], days: {} };
  }
  try { return JSON.parse(await readFile(path.join(dataDir(), "catalog.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { songs: [], days: {} }; throw error; }
}
export async function writeCatalog(catalog: Catalog) {
  const serialized = JSON.stringify(catalog, null, 2);
  await mkdir(dataDir(), { recursive: true });
  const temp = path.join(dataDir(), `catalog-${randomUUID()}.tmp`);
  await writeFile(temp, serialized);
  await rename(temp, path.join(dataDir(), "catalog.json"));
  if (remoteCatalogEnabled()) await putR2Object("state/catalog.json", serialized, "application/json");
}
