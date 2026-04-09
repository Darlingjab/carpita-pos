/**
 * Agregador de ventas importadas (5 trozos). Generado por scripts/sync-exports.cjs.
 * No editar a mano.
 */
import type { Sale } from "@/lib/types";
import { importedSalesSeedPart1 } from "./imported-sales-sample-part-1";
import { importedSalesSeedPart2 } from "./imported-sales-sample-part-2";
import { importedSalesSeedPart3 } from "./imported-sales-sample-part-3";
import { importedSalesSeedPart4 } from "./imported-sales-sample-part-4";
import { importedSalesSeedPart5 } from "./imported-sales-sample-part-5";

export const importedSalesSeed: Sale[] = [
  ...importedSalesSeedPart1,
  ...importedSalesSeedPart2,
  ...importedSalesSeedPart3,
  ...importedSalesSeedPart4,
  ...importedSalesSeedPart5,
];
