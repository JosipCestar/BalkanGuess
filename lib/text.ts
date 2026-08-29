export function normalizeBalkanText(value: string) {
  return value.toLowerCase().trim().replace(/đ/g, "dj").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
