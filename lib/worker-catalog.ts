import { validateCatalog, type Catalog } from "./catalog";

// Assignments are prepared days ahead and normally change once per day. A longer
// per-isolate cache cuts repeated R2 reads while keeping manual repairs responsive.
const CATALOG_CACHE_MS = 5 * 60_000;
let cachedCatalog: { value: Catalog; expiresAt: number } | undefined;
let catalogRequest: Promise<Catalog> | undefined;

export async function readWorkerCatalog(): Promise<Catalog> {
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.value;

  if (!catalogRequest) {
    catalogRequest = (async () => {
      const { env } = await import("cloudflare:workers");
      const object = await env.AUDIO_BUCKET.get("state/catalog.json");
      if (!object) throw new Error("The R2 playlist catalog has not been published.");
      const value = validateCatalog(await object.json<unknown>());
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
