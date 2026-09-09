export const CATEGORIES = [
  { id: "club-mix", label: "Balkan Club Mix" },
  { id: "jala-buba", label: "Jala i Buba" },
  { id: "exyu", label: "EXYU" },
] as const;
export type Category = typeof CATEGORIES[number]["id"];
export function categoryFrom(value: unknown): Category {
  if (value == null) return "club-mix";
  if (!CATEGORIES.some(category => category.id === value)) throw new Error("Unknown category.");
  return value as Category;
}
