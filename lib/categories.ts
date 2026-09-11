export const CATEGORIES = [
  { id: "club-mix", label: "Balkan Club Mix", required: true },
  { id: "jala-buba", label: "Jala i Buba", required: true },
  { id: "exyu", label: "EXYU", required: true },
  { id: "trap", label: "Trap", required: false },
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
