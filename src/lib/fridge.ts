export type Category =
  | "Kylskåp"
  | "Frys"
  | "Skafferi"
  | "Grönsaker"
  | "Frukt"
  | "Mejeri"
  | "Dryck";

export const CATEGORIES: Category[] = [
  "Kylskåp",
  "Frys",
  "Skafferi",
  "Grönsaker",
  "Frukt",
  "Mejeri",
  "Dryck",
];

export type Item = {
  id: string;
  name: string;
  qty: number;
  category: Category;
  addedAt: number;
  finishedAt?: number | undefined;
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

export function clearItems() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function normalize(name: string) {
  return name.trim().toLowerCase();
}
