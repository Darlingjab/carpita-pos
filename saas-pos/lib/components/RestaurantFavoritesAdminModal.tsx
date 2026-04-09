"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { loadOverrides, saveOverrides } from "@/lib/product-overrides";
import {
  appearanceForSlot,
  clampFavoriteColorIndex,
  clampFavoriteGridColumns,
  FAVORITE_COLOR_PRESETS,
  FAVORITE_GRID_COLS_MAX,
  FAVORITE_GRID_COLS_MIN,
  loadFavoriteGridColumns,
  notifyRestaurantFavoritesUpdated,
  saveFavoriteGridColumns,
  saveFavoriteSlotIds,
} from "@/lib/restaurant-favorites-config";
import { es } from "@/lib/locale";

type Props = {
  open: boolean;
  onClose: () => void;
  saleCatalog: Product[];
};

const PREVIEW_CHIP =
  "rounded border px-0.5 py-1 text-left text-[0.58rem] font-semibold leading-[1.08] shadow-sm transition min-h-[2.6rem] border-2";

export function RestaurantFavoritesAdminModal({ open, onClose, saleCatalog }: Props) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [previewGridCols, setPreviewGridCols] = useState(() => loadFavoriteGridColumns());

  useEffect(() => {
    if (!open) return;
    saveFavoriteSlotIds(null);
    notifyRestaurantFavoritesUpdated();
    setSelectedProductId(null);
    setPreviewGridCols(loadFavoriteGridColumns());
  }, [open]);

  function setGridColumns(n: number) {
    const cols = clampFavoriteGridColumns(n);
    setPreviewGridCols(cols);
    saveFavoriteGridColumns(cols);
    notifyRestaurantFavoritesUpdated();
  }

  const previewEntries = useMemo(
    () =>
      saleCatalog
        .filter((p) => p.isFavorite && !p.isArchived && p.isActive)
        .map((product) => ({ product, colorIndex: product.favoriteColorIndex ?? 0 })),
    [saleCatalog],
  );

  useEffect(() => {
    if (!open) return;
    const ids = new Set(previewEntries.map((e) => e.product.id));
    setSelectedProductId((cur) => (cur && ids.has(cur) ? cur : null));
  }, [open, previewEntries]);

  const selectedProduct = selectedProductId
    ? previewEntries.find((e) => e.product.id === selectedProductId)?.product ?? null
    : null;

  function setFavoriteColor(productId: string, colorIndex: number) {
    const idx = clampFavoriteColorIndex(colorIndex);
    const base = loadOverrides();
    saveOverrides({
      ...base,
      [productId]: { ...(base[productId] || {}), favoriteColorIndex: idx },
    });
  }

  function persistAndClose() {
    saveFavoriteSlotIds(null);
    notifyRestaurantFavoritesUpdated();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/45 p-3">
      <div
        className="flex max-h-[min(92dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-labelledby="fav-admin-title"
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 id="fav-admin-title" className="text-base font-black text-slate-900">
            {es.restaurant.favoritesAdminTitle}
          </h2>
          <p className="mt-1 text-xs text-slate-600">{es.restaurant.favoritesAdminLead}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-wide text-slate-600">
              {es.restaurant.favoritesGridColumns}
            </p>
            <p className="mt-1 text-[0.65rem] text-slate-600">{es.restaurant.favoritesGridColumnsHint}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from(
                { length: FAVORITE_GRID_COLS_MAX - FAVORITE_GRID_COLS_MIN + 1 },
                (_, i) => FAVORITE_GRID_COLS_MIN + i,
              ).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`min-w-[2.5rem] rounded-lg border px-2.5 py-1.5 text-xs font-black tabular-nums ${
                    previewGridCols === n
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                  onClick={() => setGridColumns(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[0.7rem] font-extrabold uppercase tracking-wide text-slate-600">
              {es.restaurant.favoritesPreviewTitle}
            </p>
            <p className="mt-1 text-[0.7rem] text-slate-600">{es.restaurant.favoritesPickButtonHint}</p>
            {previewEntries.length === 0 ? (
              <p className="mt-3 text-center text-xs text-slate-500">{es.restaurant.favoritesNoPreview}</p>
            ) : (
              <div
                className="mt-2 grid gap-0.5"
                style={{
                  gridTemplateColumns: `repeat(${previewGridCols}, minmax(0, 1fr))`,
                }}
              >
                {previewEntries.map(({ product: p, colorIndex }, gi) => {
                  const col = appearanceForSlot(colorIndex);
                  const sel = selectedProductId === p.id;
                  return (
                    <button
                      key={`${p.id}-${gi}`}
                      type="button"
                      className={`${PREVIEW_CHIP} text-left ${
                        sel ? "ring-2 ring-slate-900 ring-offset-1" : "hover:brightness-[0.97]"
                      }`}
                      style={{
                        backgroundColor: col.background,
                        borderColor: col.border,
                        color: col.text,
                      }}
                      title={p.name}
                      onClick={() => setSelectedProductId(p.id)}
                    >
                      <span className="line-clamp-3">{p.name}</span>
                      <span className="block text-[0.5rem] opacity-80">${p.price.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="text-[0.65rem] font-bold text-slate-700">{es.restaurant.favoritesPickColor}</p>
              {selectedProduct ? (
                <>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-900" title={selectedProduct.name}>
                    {selectedProduct.name}
                  </p>
                  <p className="mt-1 text-[0.65rem] text-slate-500">{es.restaurant.favoritesApplyColorHint}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {FAVORITE_COLOR_PRESETS.map((preset, idx) => {
                      const active =
                        clampFavoriteColorIndex(selectedProduct.favoriteColorIndex ?? 0) === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          title={`${es.restaurant.favoritesColorN} ${idx + 1}`}
                          className={`h-8 w-8 shrink-0 rounded-full border-2 transition ${
                            active ? "ring-2 ring-slate-900 ring-offset-2" : "opacity-85 hover:opacity-100"
                          }`}
                          style={{
                            backgroundColor: preset.background,
                            borderColor: preset.border,
                          }}
                          onClick={() => setFavoriteColor(selectedProduct.id, idx)}
                        />
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-500">{es.restaurant.favoritesSelectFirst}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
            onClick={onClose}
          >
            {es.restaurant.cancel}
          </button>
          <button
            type="button"
            className="btn-pos-primary ml-auto px-4 py-2 text-sm font-extrabold uppercase"
            onClick={persistAndClose}
          >
            {es.restaurant.favoritesSave}
          </button>
        </div>
      </div>
    </div>
  );
}
