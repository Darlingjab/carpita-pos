import type { Product, ProductCategory } from "@/lib/types";
import { importedMenuCategories, importedMenuProducts } from "./imported-catalog-menu";
import { importedHistoricalCategories, importedHistoricalProducts } from "./imported-catalog-historical";

/**
 * Catálogo completo para el POS:
 * - Menú operativo: imported-catalog-menu.ts — fuente principal `exports/productos 2.xls` → `npm run import:productos`
 *   o `npm run import:exports` si el archivo está en exports/. Alternativa: `npm run import:fudo-md` (markdown).
 * - Histórico por ticket: imported-catalog-historical.ts (`npm run import:exports` con CSV por tickets).
 */
export const importedCategories: ProductCategory[] = [
  ...importedMenuCategories,
  ...importedHistoricalCategories,
];

export const importedProducts: Product[] = [...importedMenuProducts, ...importedHistoricalProducts];
