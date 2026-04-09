import type { Product } from "@/lib/types";

export const PRODUCT_OVERRIDES_KEY = "pos_product_overrides_v1";

export type ProductOverride = Partial<
  Pick<Product, "name" | "price" | "cost" | "isActive" | "isSeasonal" | "isArchived" | "isFavorite">
> & {
  favoriteColorIndex?: number;
};

export type OverrideMap = Record<string, ProductOverride>;

export function loadOverrides(): OverrideMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PRODUCT_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as OverrideMap) : {};
  } catch {
    return {};
  }
}

export function saveOverrides(map: OverrideMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRODUCT_OVERRIDES_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent("pos-catalog-updated"));
}

export function mergeProduct(base: Product, overrides: OverrideMap): Product {
  const o = overrides[base.id];
  if (!o) return { ...base, cost: base.cost ?? 0 };
  const favColor =
    o.favoriteColorIndex !== undefined
      ? Math.min(5, Math.max(0, Math.floor(Number(o.favoriteColorIndex) || 0)))
      : base.favoriteColorIndex;
  return {
    ...base,
    ...o,
    id: base.id,
    cost: o.cost ?? base.cost ?? 0,
    isSeasonal: o.isSeasonal !== undefined ? o.isSeasonal : (base.isSeasonal ?? false),
    isArchived: o.isArchived !== undefined ? o.isArchived : (base.isArchived ?? false),
    isFavorite: o.isFavorite !== undefined ? o.isFavorite : base.isFavorite,
    isActive: o.isActive !== undefined ? o.isActive : base.isActive,
    favoriteColorIndex: favColor,
  };
}

export function mergeAllProducts(base: Product[], overrides: OverrideMap): Product[] {
  return base.map((p) => mergeProduct(p, overrides));
}
