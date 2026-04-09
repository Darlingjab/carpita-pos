import { importedSalesSeed } from "@/lib/data/imported-sales-sample";
import { getSales } from "@/lib/store";
import type { Sale } from "@/lib/types";

/**
 * Histórico del archivo (`importedSalesSeed`) + ventas nuevas en memoria (`getSales()`).
 * El store no duplica el CSV; solo cobros de esta sesión.
 */
export function mergeHistoricalSalesWithLive(): Sale[] {
  const byId = new Map<string, Sale>();
  for (const s of importedSalesSeed) byId.set(s.id, s);
  for (const s of getSales()) byId.set(s.id, s);
  return [...byId.values()];
}
