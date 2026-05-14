"use client";

import { useState } from "react";
import type { DiscountType } from "@/lib/types";
import { es } from "@/lib/locale";

export type DiscountApplyPayload = {
  discountAmount: number;
  discountPercent: number;
  discountType: DiscountType;
  discountDescription: string;
};

type Props = {
  subtotal: number;
  onApply: (p: DiscountApplyPayload) => void;
  onClose: () => void;
};

export function DiscountModal({ subtotal, onApply, onClose }: Props) {
  const [discountType, setDiscountType] = useState<DiscountType>("employee");
  const [description, setDescription] = useState("");
  const [percent, setPercent] = useState("");
  const [amountCustom, setAmountCustom] = useState("");
  const [mode, setMode] = useState<"percent" | "amount">("percent");

  function applyPreset(p: number) {
    setMode("percent");
    setPercent(String(p));
    setAmountCustom("");
  }

  function submit() {
    let discountAmount = 0;
    let discountPercent = 0;
    if (mode === "percent") {
      const p = Math.min(100, Math.max(0, Number(percent) || 0));
      discountPercent = p;
      discountAmount = Math.round(subtotal * (p / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(subtotal, Math.max(0, Number(amountCustom) || 0));
      discountPercent =
        subtotal > 0 ? Math.round((discountAmount / subtotal) * 10000) / 100 : 0;
    }
    const desc = description.trim();
    if (!desc) return; // botón deshabilitado cuando descripción vacía
    onApply({
      discountAmount,
      discountPercent,
      discountType,
      discountDescription: desc,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-3"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
        <h2 className="text-base font-black text-slate-900">{es.discountModal.title}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {es.discountModal.subtotalLabel}: ${subtotal.toFixed(2)}
        </p>

        <p className="mt-3 text-[0.65rem] font-bold uppercase text-slate-500">
          {es.discountModal.typeLabel}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {(
            [
              ["employee", es.discountModal.typeEmployee],
              ["owner", es.discountModal.typeOwner],
              ["custom", es.discountModal.typeCustom],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`rounded-lg border px-2 py-1.5 text-xs font-bold ${
                discountType === k
                  ? "border-[var(--pos-primary)] bg-orange-50 text-slate-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
              onClick={() => setDiscountType(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[0.65rem] font-bold uppercase text-slate-500">
          {es.discountModal.modeLabel}
        </p>
        <div className="mt-1 flex gap-1">
          <button
            type="button"
            className={`rounded-lg border px-2 py-1 text-xs font-bold ${
              mode === "percent" ? "bg-slate-800 text-white" : "bg-white text-slate-700"
            }`}
            onClick={() => setMode("percent")}
          >
            %
          </button>
          <button
            type="button"
            className={`rounded-lg border px-2 py-1 text-xs font-bold ${
              mode === "amount" ? "bg-slate-800 text-white" : "bg-white text-slate-700"
            }`}
            onClick={() => setMode("amount")}
          >
            $
          </button>
        </div>

        {mode === "percent" ? (
          <>
            <p className="mt-2 text-[0.65rem] font-bold text-slate-500">
              {es.discountModal.presets}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
 {[5, 10, 15, 50, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold"
                  onClick={() => applyPreset(p)}
                >
                  {p}%
                </button>
              ))}
            </div>
            <label className="mt-2 block text-xs text-slate-600">{es.discountModal.percentInput}</label>
            <input
              type="number"
              min={0}
              max={100}
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-base"
              value={percent}
              onChange={(e) => {
                setPercent(e.target.value);
                setAmountCustom("");
              }}
            />
          </>
        ) : (
          <>
            <label className="mt-2 block text-xs text-slate-600">{es.discountModal.amountInput}</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-base"
              value={amountCustom}
              onChange={(e) => {
                setAmountCustom(e.target.value);
                setPercent("");
              }}
            />
          </>
        )}

        <label className="mt-3 block text-xs font-bold text-slate-600">
          {es.discountModal.descriptionLabel}
        </label>
        <input
          type="text"
          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1.5 text-base"
          placeholder={es.discountModal.descriptionPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            onClick={onClose}
          >
            {es.restaurant.cancelOpen}
          </button>
          <button
            type="button"
            disabled={!description.trim()}
            className="btn-pos-primary flex-1 py-2.5 text-sm font-extrabold uppercase disabled:opacity-40"
            onClick={submit}
          >
            {es.discountModal.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
