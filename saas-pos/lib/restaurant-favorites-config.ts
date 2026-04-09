const KEY_SLOTS = "pos_restaurant_favorite_slots_v1";
const KEY_GRID_COLS = "pos_restaurant_favorite_grid_cols_v1";

/** Mínimo / máximo / valor por defecto para columnas de la grilla de favoritos en venta. */
export const FAVORITE_GRID_COLS_MIN = 3;
export const FAVORITE_GRID_COLS_MAX = 8;
export const FAVORITE_GRID_COLS_DEFAULT = 6;

export function clampFavoriteGridColumns(n: number): number {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return FAVORITE_GRID_COLS_DEFAULT;
  return Math.min(FAVORITE_GRID_COLS_MAX, Math.max(FAVORITE_GRID_COLS_MIN, x));
}

export function loadFavoriteGridColumns(): number {
  try {
    const raw = localStorage.getItem(KEY_GRID_COLS);
    if (raw === null) return FAVORITE_GRID_COLS_DEFAULT;
    const parsed = JSON.parse(raw) as unknown;
    const n = typeof parsed === "number" ? parsed : Number(raw);
    return clampFavoriteGridColumns(n);
  } catch {
    return FAVORITE_GRID_COLS_DEFAULT;
  }
}

export function saveFavoriteGridColumns(n: number): void {
  try {
    localStorage.setItem(KEY_GRID_COLS, JSON.stringify(clampFavoriteGridColumns(n)));
  } catch {
    /* ignore */
  }
}

export type FavoriteButtonAppearance = {
  background: string;
  border: string;
  text: string;
};

/** Seis estilos fijos para botones de favoritos (índice 0–5). */
export const FAVORITE_COLOR_PRESETS: FavoriteButtonAppearance[] = [
  { background: "#fffbeb", border: "#fcd34d", text: "#1e293b" },
  { background: "#fff1f2", border: "#fb7185", text: "#881337" },
  { background: "#eff6ff", border: "#60a5fa", text: "#1e3a8a" },
  { background: "#ecfdf5", border: "#34d399", text: "#064e3b" },
  { background: "#f5f3ff", border: "#a78bfa", text: "#4c1d95" },
  { background: "#fff7ed", border: "#fb923c", text: "#7c2d12" },
];

export const DEFAULT_FAVORITE_APPEARANCE: FavoriteButtonAppearance = FAVORITE_COLOR_PRESETS[0];

function parseSlotIds(parsed: unknown): string[] | null {
  if (!Array.isArray(parsed)) return null;
  if (parsed.length === 0) return [];
  if (typeof parsed[0] === "string") return parsed as string[];
  const ids: string[] = [];
  for (const x of parsed) {
    if (typeof x === "string") ids.push(x);
    else if (typeof x === "object" && x !== null && "productId" in x) {
      const id = (x as { productId: unknown }).productId;
      if (typeof id === "string") ids.push(id);
    }
  }
  return ids;
}

/** `null` = no hay lista fija: se usan favoritos del catálogo (Productos). */
export function loadFavoriteSlotIds(): string[] | null {
  try {
    const raw = localStorage.getItem(KEY_SLOTS);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parseSlotIds(parsed);
  } catch {
    return null;
  }
}

export function saveFavoriteSlotIds(ids: string[] | null): void {
  try {
    if (ids === null) localStorage.removeItem(KEY_SLOTS);
    else localStorage.setItem(KEY_SLOTS, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function clampFavoriteColorIndex(n: number): number {
  return Math.min(5, Math.max(0, Math.floor(n)));
}

export function appearanceForSlot(colorIndex: number): FavoriteButtonAppearance {
  return FAVORITE_COLOR_PRESETS[clampFavoriteColorIndex(colorIndex)] ?? FAVORITE_COLOR_PRESETS[0];
}

export function notifyRestaurantFavoritesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pos-restaurant-favorites-updated"));
}
