import type { Catalog } from "./catalog";

const CATALOG_CACHE_MS = 60_000;
let cachedCatalog: { value: Catalog; expiresAt: number } | undefined;
let catalogRequest: Promise<Catalog> | undefined;

export async function readWorkerCatalog(): Promise<Catalog> {
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.value;

  if (!catalogRequest) {
    catalogRequest = (async () => {
      const { env } = await import("cloudflare:workers");
      const object = await env.AUDIO_BUCKET.get("state/catalog.json");
      if (!object) throw new Error("The R2 playlist catalog has not been published.");
      const value = await object.json<Catalog>();
      cachedCatalog = { value, expiresAt: Date.now() + CATALOG_CACHE_MS };
      return value;
    })();
  }

  try {
    return await catalogRequest;
  } finally {
    catalogRequest = undefined;
  }
}
