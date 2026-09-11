export const CATEGORIES = [
  { id: "club-mix", label: "Balkan Club Mix" },
  { id: "jala-buba", label: "Jala i Buba" },
  { id: "exyu", label: "EXYU" },
] as const;
export type Category = typeof CATEGORIES[number]["id"];
export function categoryOrNull(value: unknown): Category | null {
  if (value == null) return "club-mix";
  return CATEGORIES.some(category => category.id === value) ? value as Category : null;
}
export function categoryFrom(value: unknown): Category {
  const category = categoryOrNull(value);
  if (!category) throw new Error("Unknown category.");
  return category;
}
