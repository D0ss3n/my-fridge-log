export type Category = "Kylskåp" | "Frys" | "Skafferi";

export const CATEGORIES: Category[] = ["Kylskåp", "Frys", "Skafferi"];

export type Item = {
  id: string;
  name: string;
  qty: number;
  category: Category;
  addedAt: number;
  finishedAt?: number;
};

const KEY = "kylkoll.items.v1";

export function loadItems(): Item[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Item[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveItems(items: Item[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

export function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function normalize(name: string) {
  return name.trim().toLowerCase();
}
