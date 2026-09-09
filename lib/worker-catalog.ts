import type { Catalog } from "./catalog";

export async function readWorkerCatalog(): Promise<Catalog> {
  const { env } = await import("cloudflare:workers");
  const object = await env.AUDIO_BUCKET.get("state/catalog.json");
  if (!object) throw new Error("The R2 playlist catalog has not been published.");
  return object.json<Catalog>();
}
