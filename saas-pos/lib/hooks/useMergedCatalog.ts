"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { loadOverrides, mergeAllProducts } from "@/lib/product-overrides";

/** Catálogo fusionado con overrides en localStorage (misma fuente que la pestaña Productos). */
export function useMergedCatalog(base: Product[]): Product[] {
  const [list, setList] = useState<Product[]>(() => mergeAllProducts(base, loadOverrides()));

  useEffect(() => {
    const sync = () => setList(mergeAllProducts(base, loadOverrides()));
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("pos-catalog-updated", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("pos-catalog-updated", sync);
    };
  }, [base]);

  return list;
}
