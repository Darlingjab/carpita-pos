import type { Product, ProductCategory } from "@/lib/types";

/** Tipos de venta del CSV (tickets). Generado por scripts/sync-exports.cjs */
export const importedHistoricalCategories: ProductCategory[] = [
  {
    "id": "cat_hist_tipos_venta",
    "businessId": "biz_imported",
    "name": "Histórico — tipo de venta",
    "parentId": null
  }
];

export const importedHistoricalProducts: Product[] = [
  {
    "id": "prd_hist_delivery",
    "businessId": "biz_imported",
    "categoryId": "cat_hist_tipos_venta",
    "name": "Delivery",
    "sku": "HIST-1",
    "price": 0,
    "isFavorite": false,
    "isActive": true
  },
  {
    "id": "prd_hist_local",
    "businessId": "biz_imported",
    "categoryId": "cat_hist_tipos_venta",
    "name": "Local",
    "sku": "HIST-2",
    "price": 0,
    "isFavorite": false,
    "isActive": true
  },
  {
    "id": "prd_hist_mostrador",
    "businessId": "biz_imported",
    "categoryId": "cat_hist_tipos_venta",
    "name": "Mostrador",
    "sku": "HIST-3",
    "price": 0,
    "isFavorite": false,
    "isActive": true
  }
];
