"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Package, Star, Trash2 } from "lucide-react";
import { demoCategories, demoProducts } from "@/lib/mock-data";
import { es } from "@/lib/locale";
import type { Product } from "@/lib/types";
import { loadOverrides, mergeAllProducts, saveOverrides, type OverrideMap } from "@/lib/product-overrides";

type MainTab = "productos" | "temporada" | "discontinuos";

const TAB_KEY = "pos_productos_tab_v2";

function productNumericCode(p: Product): string | number {
  const m = /^prd_(\d+)$/i.exec(p.id);
  return m ? Number(m[1]) : p.id;
}

function categoryNameOf(
  categoryId: string,
  categories: { id: string; name: string; parentId: string | null }[],
): string {
  const c = categories.find((x) => x.id === categoryId);
  return c?.name ?? "Sin categoría";
}

export function ProductsAdminView() {
  const [mainTab, setMainTab] = useState<MainTab>(() => {
    if (typeof window === "undefined") return "productos";
    return (localStorage.getItem(TAB_KEY) as MainTab) || "productos";
  });
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [hydrated, setHydrated] = useState(false);

  React.useEffect(() => {
    setOverrides(loadOverrides());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    localStorage.setItem(TAB_KEY, mainTab);
  }, [mainTab]);

  const products = useMemo(() => mergeAllProducts(demoProducts, overrides), [overrides]);

  const cats = useMemo(() => {
    const names = new Set<string>();
    for (const p of products) {
      const cat = categoryNameOf(p.categoryId, demoCategories);
      const inDiscontinued = !!(p.isArchived);
      const seasonal = !!p.isSeasonal;
      const activeRegular = !inDiscontinued && !seasonal;
      if (mainTab === "discontinuos") {
        if (inDiscontinued) names.add(cat);
      } else if (mainTab === "temporada") {
        if (!inDiscontinued && seasonal) names.add(cat);
      } else {
        if (activeRegular) names.add(cat);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  }, [products, mainTab]);

  const [activeCatState, setActiveCatState] = useState("");
  const activeCat = cats.includes(activeCatState) ? activeCatState : (cats[0] ?? "");

  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [editMap, setEditMap] = useState<Record<string, { name: string; price: number; cost: number }>>({});

  React.useEffect(() => {
    setIsEditingCategory(false);
  }, [mainTab, activeCat]);

  const filteredProducts = useMemo(() => {
    if (!activeCat) return [];
    return products.filter((p) => categoryNameOf(p.categoryId, demoCategories) === activeCat);
  }, [products, activeCat]);

  const applyOverrides = useCallback((updater: (m: OverrideMap) => OverrideMap) => {
    setOverrides((prev) => {
      const next = updater(prev);
      saveOverrides(next);
      return next;
    });
  }, []);

  const startMassEdit = () => {
    const map: Record<string, { name: string; price: number; cost: number }> = {};
    filteredProducts.forEach((p) => {
      map[p.id] = { name: p.name, price: p.price, cost: p.cost ?? 0 };
    });
    setEditMap(map);
    setIsEditingCategory(true);
  };

  const saveMassEdit = () => {
    applyOverrides((base) => {
      const next = { ...base };
      Object.entries(editMap).forEach(([id, row]) => {
        next[id] = {
          ...(next[id] || {}),
          name: row.name,
          price: Number(row.price),
          cost: Number(row.cost),
        };
      });
      return next;
    });
    setIsEditingCategory(false);
  };

  const handleArchive = (id: string, name: string) => {
    if (!window.confirm(`${es.productsAdmin.archiveConfirm}\n\n${name}`)) return;
    applyOverrides((base) => ({
      ...base,
      [id]: { ...(base[id] || {}), isArchived: true, isActive: false },
    }));
  };

  const handleMoveCategory = () => {
    const toSeasonal = mainTab === "productos";
    const target = toSeasonal ? "temporada" : "regulares";
    if (
      !window.confirm(
        es.productsAdmin.moveCategoryConfirm.replace("{cat}", activeCat).replace("{target}", target),
      )
    ) {
      return;
    }
    const ids = products
      .filter((p) => categoryNameOf(p.categoryId, demoCategories) === activeCat)
      .map((p) => p.id);
    applyOverrides((base) => {
      const next = { ...base };
      ids.forEach((id) => {
        next[id] = { ...(next[id] || {}), isSeasonal: toSeasonal, isArchived: false };
      });
      return next;
    });
  };

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-slate-500">
        Cargando catálogo…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-[#f8f9fa] shadow-sm">
      {/* Barra tipo app antigua + acento Fudo */}
      <div
        className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-2 text-sm font-semibold text-white"
        style={{ backgroundColor: "#4c4c4c" }}
      >
        <button
          type="button"
          onClick={() => setMainTab("productos")}
          className={`border-b-2 pb-1 transition-colors ${
            mainTab === "productos" ? "border-[var(--pos-primary)] text-white" : "border-transparent text-slate-300"
          }`}
        >
          {es.productsAdmin.tabRegular}
        </button>
        <button
          type="button"
          onClick={() => setMainTab("temporada")}
          className={`border-b-2 pb-1 transition-colors ${
            mainTab === "temporada" ? "border-[var(--pos-primary)] text-white" : "border-transparent text-slate-300"
          }`}
        >
          {es.productsAdmin.tabSeasonal}
        </button>
        <button
          type="button"
          onClick={() => setMainTab("discontinuos")}
          className={`border-b-2 pb-1 transition-colors ${
            mainTab === "discontinuos" ? "border-slate-400 text-slate-200" : "border-transparent text-slate-400"
          }`}
        >
          {es.productsAdmin.tabDiscontinued}
        </button>
      </div>
      <p className="border-b border-white/10 bg-[#3d3d3d] px-4 py-2 text-[0.68rem] leading-snug text-slate-300">
        {es.productsAdmin.catalogHint}
      </p>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className="w-[200px] shrink-0 overflow-y-auto text-white sm:w-[220px]"
          style={{ backgroundColor: "#555555" }}
        >
          <div className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-400">
            {es.productsAdmin.sidebarTitle}
          </div>
          {cats.length > 0 ? (
            cats.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCatState(c)}
                className="w-full border-b border-white/10 px-4 py-3 text-left text-[0.85rem] transition-colors"
                style={{
                  backgroundColor: activeCat === c ? "#e63946" : "transparent",
                }}
              >
                {c}
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-[0.8rem] text-slate-500">{es.productsAdmin.noCategories}</div>
          )}
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {activeCat ? (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 sm:text-2xl">
                    {activeCat}{" "}
                    {mainTab === "discontinuos" && (
                      <span className="text-base font-semibold text-slate-500">{es.productsAdmin.historic}</span>
                    )}
                  </h2>
                  <span className="text-sm text-slate-500">
                    {filteredProducts.length} {es.productsAdmin.productsInSection}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mainTab !== "discontinuos" && (
                    <>
                      <button
                        type="button"
                        onClick={handleMoveCategory}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                      >
                        {mainTab === "productos"
                          ? `📦 ${es.productsAdmin.moveToSeasonal}`
                          : `🔙 ${es.productsAdmin.moveToRegular}`}
                      </button>
                      {isEditingCategory ? (
                        <button
                          type="button"
                          onClick={saveMassEdit}
                          className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm"
                        >
                          💾 {es.productsAdmin.saveChanges}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startMassEdit}
                          className="rounded-md px-4 py-2 text-xs font-bold text-white shadow-sm"
                          style={{ backgroundColor: "var(--pos-primary)" }}
                        >
                          ✏️ {es.productsAdmin.editCategory}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[0.72rem] font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-3 sm:px-4">{es.productsAdmin.code}</th>
                        <th className="px-3 py-3 sm:px-4">{es.productsAdmin.name}</th>
                        <th className="w-28 px-2 py-3 sm:w-32">{es.productsAdmin.price}</th>
                        <th className="w-28 px-2 py-3 sm:w-32">{es.productsAdmin.cost}</th>
                        <th className="w-24 px-2 py-3">{es.productsAdmin.posFavorite}</th>
                        <th className="w-28 px-2 py-3 sm:w-32">
                          {isEditingCategory ? es.productsAdmin.action : es.productsAdmin.status}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-[0.9rem]">
                      {filteredProducts.map((p) => (
                        <tr
                          key={p.id}
                          className={`border-b border-slate-100 ${p.isArchived ? "opacity-75" : ""}`}
                        >
                          <td className="px-3 py-3 text-slate-400 sm:px-4">#{productNumericCode(p)}</td>
                          <td className="px-3 py-3 font-semibold text-slate-900 sm:px-4">
                            {isEditingCategory ? (
                              <input
                                className="w-[95%] rounded border-2 border-slate-200 px-2 py-1.5 text-sm"
                                value={editMap[p.id]?.name ?? ""}
                                onChange={(e) =>
                                  setEditMap((m) => ({
                                    ...m,
                                    [p.id]: { ...m[p.id], name: e.target.value, price: m[p.id]?.price ?? p.price, cost: m[p.id]?.cost ?? (p.cost ?? 0) },
                                  }))
                                }
                              />
                            ) : (
                              p.name
                            )}
                          </td>
                          <td className="px-2 py-3 font-bold text-emerald-700">
                            {isEditingCategory ? (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-24 rounded border-2 border-slate-200 px-2 py-1"
                                  value={editMap[p.id]?.price ?? 0}
                                  onChange={(e) =>
                                    setEditMap((m) => ({
                                      ...m,
                                      [p.id]: {
                                        name: m[p.id]?.name ?? p.name,
                                        price: Number(e.target.value),
                                        cost: m[p.id]?.cost ?? (p.cost ?? 0),
                                      },
                                    }))
                                  }
                                />
                              </div>
                            ) : (
                              `$${p.price.toFixed(2)}`
                            )}
                          </td>
                          <td className="px-2 py-3 font-semibold text-slate-600">
                            {isEditingCategory ? (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-20 rounded border-2 border-slate-200 px-2 py-1"
                                  value={editMap[p.id]?.cost ?? 0}
                                  onChange={(e) =>
                                    setEditMap((m) => ({
                                      ...m,
                                      [p.id]: {
                                        name: m[p.id]?.name ?? p.name,
                                        price: m[p.id]?.price ?? p.price,
                                        cost: Number(e.target.value),
                                      },
                                    }))
                                  }
                                />
                              </div>
                            ) : (
                              `$${(p.cost ?? 0).toFixed(2)}`
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              title={p.isFavorite ? es.restaurant.removeFavorite : es.restaurant.addFavorite}
                              className={`rounded-md p-1.5 transition-colors ${
                                p.isFavorite
                                  ? "text-amber-500 hover:bg-amber-50"
                                  : "text-slate-300 hover:bg-slate-100 hover:text-amber-500"
                              }`}
                              onClick={() =>
                                applyOverrides((base) => ({
                                  ...base,
                                  [p.id]: { ...(base[p.id] || {}), isFavorite: !p.isFavorite },
                                }))
                              }
                            >
                              <Star className="h-5 w-5" fill={p.isFavorite ? "currentColor" : "none"} />
                            </button>
                          </td>
                          <td className="px-2 py-3">
                            {isEditingCategory ? (
                              <button
                                type="button"
                                onClick={() => handleArchive(p.id, p.name)}
                                title="Descontinuar"
                                className="flex rounded bg-red-100 p-2 text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : (
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                                  p.isArchived
                                    ? "bg-red-100 text-red-900"
                                    : p.isActive
                                      ? "bg-emerald-100 text-emerald-900"
                                      : "bg-red-50 text-red-800"
                                }`}
                              >
                                {p.isArchived
                                  ? es.productsAdmin.discontinued
                                  : p.isActive
                                    ? es.productsAdmin.active
                                    : es.productsAdmin.inactive}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-slate-400">
              <Package className="mb-3 h-12 w-12 opacity-50" strokeWidth={1.25} />
              <p className="text-center text-sm">
                {mainTab === "discontinuos"
                  ? es.productsAdmin.emptyDiscontinued
                  : es.productsAdmin.selectCategory}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
